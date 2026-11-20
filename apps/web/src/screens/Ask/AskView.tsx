import { IconMessagePlus } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import {
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
import type { AskTurn } from './Ask.utils';

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
}

const SUGGESTIONS = [
  'What do we pay Data Analysts in India compared with the US and UK?',
  'Who is paid below the median for their role in my countries?',
  'How did payroll change after the April review?',
];

function Paragraphs({ text }: { text: string }) {
  return (
    <>
      {text
        .split(/\n{2,}/)
        .filter((paragraph) => paragraph.trim() !== '')
        .map((paragraph, index) => (
          <p key={index} className={styles.paragraph}>
            {paragraph}
          </p>
        ))}
    </>
  );
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

/** Ask AI: one column of questions and answers, the queries behind each answer, and drafts to review. */
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
}: AskViewProps) {
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
              description="Every answer shows the queries behind its numbers. Suggested changes are drafts until you save them."
            />
            <ul className={styles.suggestions} aria-label="Suggested questions">
              {SUGGESTIONS.map((suggestion) => (
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
                    <Paragraphs text={turn.answer} />
                  ) : turn.status === 'streaming' ? (
                    <AnswerSkeleton />
                  ) : null}
                  {turn.status === 'error' && (
                    <Notice tone="warning" title="The answer stopped">
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
                  {turn.steps.length > 0 && (
                    <QuerySteps
                      title={`How I worked this out · ${turn.steps.length} ${turn.steps.length === 1 ? 'query' : 'queries'}`}
                      steps={turn.steps}
                      defaultExpanded={false}
                    />
                  )}
                </ChatMessage>
              </div>
            );
          })
        )}
      </div>
      <div className={styles.composer}>
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
