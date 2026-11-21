import { Table } from '@mantine/core';
import { IconMessagePlus } from '@tabler/icons-react';
import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import {
  AppLink,
  ChatComposer,
  ChatMessage,
  EmptyState,
  MoneyText,
  Notice,
  PageHeader,
  PillButton,
  QuerySteps,
  Skeleton,
} from '../../components';
import { formatDate } from '../../lib/format';
import styles from './Ask.module.css';
import {
  askSuggestions,
  parseAnswer,
  parseInline,
  splitByCodes,
  type AskTurn,
  type MentionedPerson,
} from './Ask.utils';

export interface AskViewProps {
  turns: readonly AskTurn[];
  question: string;
  onQuestionChange: (value: string) => void;
  onAsk: (question: string) => void;
  onNewChat: () => void;
  busy: boolean;
  /** `salary:change`: drafts can be opened in the salary change dialog. */
  canReviewDrafts: boolean;
  /** Draft ids already saved through the dialog. */
  savedDraftIds: ReadonlySet<string>;
  onReviewDrafts: (turnId: string) => void;
  /** e.g. "India" or "all countries", shown so people know what the answers cover. */
  scopeLabel: ReactNode;
  /** Names for the employee codes in answers, looked up for this user. */
  people?: ReadonlyMap<string, MentionedPerson>;
  /** Starter questions for the empty state; see `askSuggestions`. */
  suggestions?: readonly string[];
}

const NO_PEOPLE: ReadonlyMap<string, MentionedPerson> = new Map();

const DEFAULT_SUGGESTIONS = askSuggestions(
  { role: { countryScope: 'all' }, countries: [] },
  (code) => code,
);

type People = ReadonlyMap<string, MentionedPerson>;

/** One line of answer text: **bold**, `code`, and each employee code as a link with the name. */
function Inline({ text, people }: { text: string; people: People }) {
  return parseInline(text).map((part, index) => {
    if (part.kind === 'code') {
      return (
        <code key={index} className={styles.code}>
          {part.text}
        </code>
      );
    }
    const content = splitByCodes(part.text).map((piece, pieceIndex) => {
      const person = piece.code ? people.get(piece.code) : undefined;
      return person ? (
        <AppLink key={pieceIndex} href={`/employees/${person.id}`} className={styles.person}>
          {person.name} ({piece.code})
        </AppLink>
      ) : (
        piece.text
      );
    });
    return part.kind === 'strong' ? <strong key={index}>{content}</strong> : content;
  });
}

/** The answer's text: paragraphs, lists and tables from the Markdown the model writes. */
function AnswerText({ text, people }: { text: string; people: People }) {
  return parseAnswer(text).map((block, index) => {
    switch (block.kind) {
      case 'heading':
        return (
          <p key={index} className={`${styles.paragraph} ${styles.heading}`}>
            <Inline text={block.text} people={people} />
          </p>
        );
      case 'list': {
        const List = block.ordered ? 'ol' : 'ul';
        return (
          <List key={index} className={styles.list}>
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>
                <Inline text={item} people={people} />
              </li>
            ))}
          </List>
        );
      }
      case 'table':
        return (
          <Table.ScrollContainer
            key={index}
            minWidth={0}
            type="native"
            className={styles.tableScroll}
          >
            <Table className={styles.table} withTableBorder verticalSpacing={6}>
              <Table.Thead>
                <Table.Tr>
                  {block.header.map((cell, column) => (
                    <Table.Th key={column} style={{ textAlign: block.align[column] }}>
                      <Inline text={cell} people={people} />
                    </Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {block.rows.map((row, rowIndex) => (
                  <Table.Tr key={rowIndex}>
                    {row.map((cell, column) => (
                      <Table.Td key={column} style={{ textAlign: block.align[column] }}>
                        <Inline text={cell} people={people} />
                      </Table.Td>
                    ))}
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        );
      default:
        return (
          <p key={index} className={styles.paragraph}>
            <Inline text={block.text} people={people} />
          </p>
        );
    }
  });
}

const ANSWER_LINES = ['94%', '86%', '52%'];

/** The answer while it is worked out: paragraph lines at the answer text's own line height. */
function AnswerSkeleton() {
  return (
    <div role="status" aria-live="polite" aria-label="Working it out…">
      <p className={styles.paragraph}>
        {ANSWER_LINES.map((width) => (
          <span key={width} className={styles.answerLine}>
            <Skeleton inline width={width} height={14} />
          </span>
        ))}
      </p>
    </div>
  );
}

/**
 * Under an answer that is still being worked out: what is happening now, so a pause between steps
 * never reads as finished or stuck.
 */
function WorkingNote({ turn }: { turn: AskTurn }) {
  const running = turn.steps.some((step) => step.result === 'Running…');
  return (
    <p className={styles.working} role="status">
      <span className={styles.workingDots} aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      {running ? 'Running a query…' : turn.steps.length > 0 ? 'Writing the answer…' : 'Thinking…'}
    </p>
  );
}

/**
 * Keeps the newest answer in view above the sticky question box: a new question scrolls to the
 * end, and a streaming answer follows only while the reader is already at the end (scrolling
 * up to reread stops it).
 */
function useFollowLatest(turns: readonly AskTurn[]) {
  const endRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const atEnd = useRef(true);
  const count = useRef(turns.length);

  const measure = () => {
    const end = endRef.current;
    const composer = composerRef.current;
    if (!end || !composer) return;
    atEnd.current = end.getBoundingClientRect().top <= composer.getBoundingClientRect().top + 48;
  };

  useEffect(() => {
    // Phones scroll the window; desktop scrolls AppShell's <main>. Capture catches both.
    document.addEventListener('scroll', measure, { capture: true, passive: true });
    return () => document.removeEventListener('scroll', measure, { capture: true });
  }, []);

  useLayoutEffect(() => {
    const added = turns.length > count.current;
    count.current = turns.length;
    const end = endRef.current;
    const composer = composerRef.current;
    if (!end || !composer || !(added || atEnd.current)) return;
    // Stop the end just above the question box (and the phone tab bar under it).
    end.style.scrollMarginBottom = `${Math.max(0, window.innerHeight - composer.getBoundingClientRect().top)}px`;
    end.scrollIntoView?.({ block: 'end', behavior: added ? 'smooth' : 'auto' });
    atEnd.current = true;
  }, [turns]);

  return { endRef, composerRef };
}

/** Ask AI: one column of questions and answers, the steps behind each answer, and drafts to review. */
export function AskView({
  turns,
  question,
  onQuestionChange,
  onAsk,
  onNewChat,
  busy,
  canReviewDrafts,
  savedDraftIds,
  onReviewDrafts,
  scopeLabel,
  people = NO_PEOPLE,
  suggestions = DEFAULT_SUGGESTIONS,
}: AskViewProps) {
  const { endRef, composerRef } = useFollowLatest(turns);
  return (
    <div className={styles.page}>
      <PageHeader
        title="Ask AI"
        description={<>Questions about pay, answered from the data you can see ({scopeLabel}).</>}
        actions={
          turns.length > 0 && (
            <PillButton icon={<IconMessagePlus size={16} />} onClick={onNewChat} disabled={busy}>
              New chat
            </PillButton>
          )
        }
      />
      <div className={styles.conversation} aria-live="polite">
        {turns.length === 0 ? (
          <div className={styles.intro}>
            <EmptyState
              title="Ask a question about pay"
              description="Every answer shows the steps behind its numbers. Suggested changes are drafts until you save them."
            />
            <ul className={styles.suggestions} aria-label="Suggested questions">
              {suggestions.map((suggestion) => (
                <li key={suggestion}>
                  <button
                    type="button"
                    className={styles.suggestion}
                    onClick={() => onAsk(suggestion)}
                  >
                    {suggestion}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          turns.map((turn) => {
            const pending = turn.drafts.filter((draft) => !savedDraftIds.has(draft.draftId));
            const first = turn.drafts[0];
            return (
              <div key={turn.id} className={styles.turn}>
                <ChatMessage from="user">{turn.question}</ChatMessage>
                <ChatMessage from="assistant">
                  {turn.answer ? (
                    <AnswerText text={turn.answer} people={people} />
                  ) : turn.status === 'streaming' ? (
                    <AnswerSkeleton />
                  ) : null}
                  {turn.status === 'error' && (
                    <Notice
                      tone="warning"
                      title={
                        turn.errorCode === 'ai_budget_exceeded'
                          ? 'Limit reached'
                          : turn.errorCode === 'rate_limited'
                            ? 'Slow down'
                            : turn.errorCode === 'interrupted'
                              ? 'The answer was cut off'
                              : turn.errorCode === 'ai_no_answer'
                                ? 'No answer'
                                : 'The answer stopped'
                      }
                      action={
                        turn.errorCode === 'ai_budget_exceeded' ? (
                          <PillButton onClick={onNewChat} disabled={busy}>
                            Start a new conversation
                          </PillButton>
                        ) : undefined
                      }
                    >
                      {turn.error ?? 'Ask AI is unavailable right now. Try again in a minute.'}
                    </Notice>
                  )}
                  {turn.drafts.length > 0 && first && (
                    <Notice
                      tone="accent"
                      title={
                        turn.drafts.length === 1 ? (
                          <>
                            Change {first.employeeName}&rsquo;s salary to{' '}
                            <MoneyText {...first.proposedAmount} />?
                          </>
                        ) : (
                          `${turn.drafts.length} draft salary changes`
                        )
                      }
                      action={
                        canReviewDrafts && pending.length > 0 ? (
                          <PillButton tone="primary" onClick={() => onReviewDrafts(turn.id)}>
                            {turn.drafts.length === 1 ? 'Review draft' : 'Review drafts'}
                          </PillButton>
                        ) : undefined
                      }
                    >
                      {pending.length === 0
                        ? 'All drafts are saved to salary history.'
                        : canReviewDrafts
                          ? `Effective ${formatDate(first.effectiveDate)}. Nothing is saved until you approve each one.`
                          : 'You can see these drafts but not record salary changes. Ask someone who can.'}
                    </Notice>
                  )}
                  {turn.status === 'streaming' && turn.answer && <WorkingNote turn={turn} />}
                  {turn.steps.length > 0 && (
                    <QuerySteps
                      title={`How I worked this out · ${turn.steps.length} ${turn.steps.length === 1 ? 'step' : 'steps'}`}
                      steps={turn.steps}
                    />
                  )}
                </ChatMessage>
              </div>
            );
          })
        )}
        <div ref={endRef} aria-hidden="true" />
      </div>
      <div ref={composerRef} className={styles.composer}>
        <ChatComposer
          value={question}
          onChange={onQuestionChange}
          onSubmit={onAsk}
          busy={busy}
          placeholder={turns.length ? 'Ask a follow-up…' : 'Ask about pay…'}
          hint="Answers use only the salary data you can see. Check figures before acting."
        />
      </div>
    </div>
  );
}
