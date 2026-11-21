import type { AiStreamEvent, SalaryChangeDraft } from '@acme/shared';
import type { QueryStep } from '../../components';

export interface AskStep extends QueryStep {
  callId: string;
}

export interface AskTurn {
  id: string;
  question: string;
  /** Streamed answer text so far. */
  answer: string;
  steps: AskStep[];
  drafts: SalaryChangeDraft[];
  status: 'streaming' | 'done' | 'error';
  error?: string;
  /** The API error code when the turn failed, e.g. `ai_budget_exceeded`. */
  errorCode?: string;
}

/** An employee an answer mentions by code, resolved for the signed-in user. */
export interface MentionedPerson {
  id: string;
  name: string;
}

/**
 * Employee codes in an answer (ACM-000123). The model only ever sees codes; the screen looks the
 * names up through the normal employees API, so it shows only people the user may see.
 */
export const EMPLOYEE_CODE = /\b[A-Z]{2,5}-\d{3,8}\b/g;

export function employeeCodesIn(text: string): string[] {
  return [...new Set(text.match(EMPLOYEE_CODE) ?? [])];
}

/** Splits text into plain parts and employee codes, for rendering codes as links with names. */
export function splitByCodes(text: string): { text: string; code?: string }[] {
  const parts: { text: string; code?: string }[] = [];
  let last = 0;
  for (const match of text.matchAll(EMPLOYEE_CODE)) {
    if (match.index > last) parts.push({ text: text.slice(last, match.index) });
    parts.push({ text: match[0], code: match[0] });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

/** Folds one stream event into the turn being answered (pure, so it is easy to test). */
export function applyStreamEvent(turn: AskTurn, event: AiStreamEvent): AskTurn {
  switch (event.type) {
    case 'text':
      return { ...turn, answer: turn.answer + event.delta };
    case 'tool_call':
      return {
        ...turn,
        steps: [
          ...turn.steps,
          {
            callId: event.callId,
            label: event.summary,
            result: 'Running…',
          },
        ],
      };
    case 'tool_result':
      return {
        ...turn,
        steps: turn.steps.map((step) =>
          step.callId === event.callId
            ? {
                ...step,
                result: event.error
                  ? `Failed: ${event.error}`
                  : `${event.rowCount} ${event.rowCount === 1 ? 'row' : 'rows'}`,
              }
            : step,
        ),
      };
    case 'draft_salary_change':
      return { ...turn, drafts: [...turn.drafts, event.draft] };
    case 'done':
      return { ...turn, status: 'done' };
    case 'error':
      return { ...turn, status: 'error', error: event.message, errorCode: event.code };
    case 'conversation':
      return turn;
  }
}

/** What the answers cover, e.g. "all countries" or "India, Singapore". */
export function askScopeLabel(
  me: { role: { countryScope: string }; countries: readonly string[] },
  countryName: (code: string) => string,
): string {
  return me.role.countryScope === 'all'
    ? 'all countries'
    : me.countries.map(countryName).join(', ');
}

/**
 * Starter questions that the user's data can answer: comparing India with the US and UK means
 * nothing to someone who only sees India.
 */
export function askSuggestions(
  me: { role: { countryScope: string }; countries: readonly string[] },
  countryName: (code: string) => string,
): string[] {
  if (me.role.countryScope === 'all' || me.countries.length === 0) {
    return [
      'What do we pay Data Analysts in India compared with the US and UK?',
      'Who is paid below the median for their role in my countries?',
      'How did payroll change after the April review?',
    ];
  }
  const names = me.countries.map(countryName);
  const first = names[0]!;
  if (names.length === 1) {
    return [
      `What do we pay Data Analysts in ${first}?`,
      `Who is paid below the median for their role in ${first}?`,
      `How did payroll in ${first} change after the April review?`,
    ];
  }
  const rest = names.slice(1);
  const others =
    rest.length === 1 ? rest[0]! : `${rest.slice(0, -1).join(', ')} and ${rest.at(-1)}`;
  return [
    `What do we pay Data Analysts in ${first} compared with ${others}?`,
    'Who is paid below the median for their role in my countries?',
    'How did payroll change after the April review?',
  ];
}

/** Inline text in an answer: plain, **bold** or `code`. */
export interface InlinePart {
  kind: 'text' | 'strong' | 'code';
  text: string;
}

export type TableAlign = 'left' | 'right' | 'center';

/** One block of an answer, from the small Markdown subset the model writes. */
export type AnswerBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'heading'; text: string }
  | { kind: 'list'; ordered: boolean; items: string[] }
  | { kind: 'table'; header: string[]; align: TableAlign[]; rows: string[][] };

const BULLET = /^\s*[-*•]\s+/;
const NUMBERED = /^\s*\d+[.)]\s+/;
const HEADING = /^\s*#{1,6}\s+/;
const TABLE_ROW = /^\s*\|.*\|\s*$/;
const TABLE_RULE = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;
/** A cell that is a figure: optional sign or currency, then a digit (₹1,830,000, -3%, 298). */
const FIGURE = /^[-+−]?[^\s\dA-Za-z]{0,3}\s?\d/;

function cells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function startsBlock(line: string, next: string | undefined): boolean {
  return (
    BULLET.test(line) ||
    NUMBERED.test(line) ||
    HEADING.test(line) ||
    (TABLE_ROW.test(line) && next !== undefined && TABLE_RULE.test(next))
  );
}

/**
 * Splits an answer into paragraphs, headings, lists and tables. Only this subset is understood;
 * anything else stays text, and nothing is ever turned into HTML, so an answer cannot inject
 * markup. Half-streamed tables and lists simply render as what has arrived so far.
 */
export function parseAnswer(text: string): AnswerBlock[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const blocks: AnswerBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    const next = lines[i + 1];
    if (line.trim() === '') {
      i += 1;
    } else if (TABLE_ROW.test(line) && next !== undefined && TABLE_RULE.test(next)) {
      const header = cells(line);
      const align = cells(next).map((rule): TableAlign | undefined =>
        rule.startsWith(':') && rule.endsWith(':')
          ? 'center'
          : rule.endsWith(':')
            ? 'right'
            : rule.startsWith(':')
              ? 'left'
              : undefined,
      );
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && TABLE_ROW.test(lines[i]!)) {
        const row = cells(lines[i]!);
        rows.push(header.map((_, column) => row[column] ?? ''));
        i += 1;
      }
      blocks.push({
        kind: 'table',
        header,
        rows,
        // Unmarked columns of figures line up on the right, like the app's other tables.
        align: header.map((_, column) => {
          const marked = align[column];
          if (marked) return marked;
          const values = rows.map((row) => row[column]!).filter((value) => value !== '');
          return values.length > 0 && values.every((value) => FIGURE.test(value))
            ? 'right'
            : 'left';
        }),
      });
    } else if (BULLET.test(line) || NUMBERED.test(line)) {
      const ordered = NUMBERED.test(line);
      const marker = ordered ? NUMBERED : BULLET;
      const items: string[] = [];
      while (i < lines.length && marker.test(lines[i]!)) {
        items.push(lines[i]!.replace(marker, ''));
        i += 1;
      }
      blocks.push({ kind: 'list', ordered, items });
    } else if (HEADING.test(line)) {
      blocks.push({ kind: 'heading', text: line.replace(HEADING, '') });
      i += 1;
    } else {
      const paragraph = [line];
      i += 1;
      while (i < lines.length && lines[i]!.trim() !== '' && !startsBlock(lines[i]!, lines[i + 1])) {
        paragraph.push(lines[i]!);
        i += 1;
      }
      blocks.push({ kind: 'paragraph', text: paragraph.join('\n') });
    }
  }
  return blocks;
}

/** Splits a line into plain text, **bold** and `code`; an unclosed marker stays as text. */
export function parseInline(text: string): InlinePart[] {
  const parts: InlinePart[] = [];
  let last = 0;
  for (const match of text.matchAll(/\*\*([^*\n]+?)\*\*|`([^`\n]+)`/g)) {
    if (match.index > last) parts.push({ kind: 'text', text: text.slice(last, match.index) });
    parts.push(
      match[1] !== undefined
        ? { kind: 'strong', text: match[1] }
        : { kind: 'code', text: match[2]! },
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ kind: 'text', text: text.slice(last) });
  return parts;
}
