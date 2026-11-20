import { useRef, useState } from 'react';
import { askAi } from '../../api/askStream';
import { describeError } from '../../api/client';
import { useSession } from '../../session/SessionContext';
import { SalaryChangeDialogContainer } from '../SalaryChange/SalaryChangeDialogContainer';
import { applyStreamEvent, askScopeLabel, type AskTurn } from './Ask.utils';
import { AskView } from './AskView';

/** Container: streams answers from `POST /api/ai/messages` and opens drafts in the dialog. */
export function AskScreen() {
  const { me, can, countryName } = useSession();
  const [conversationId, setConversationId] = useState<string>();
  const [turns, setTurns] = useState<AskTurn[]>([]);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [savedDraftIds, setSavedDraftIds] = useState<ReadonlySet<string>>(new Set());
  const [reviewQueue, setReviewQueue] = useState<AskTurn['drafts']>([]);
  const abort = useRef<AbortController | null>(null);

  const ask = async (text: string) => {
    const id = crypto.randomUUID();
    const update = (fn: (turn: AskTurn) => AskTurn) =>
      setTurns((current) => current.map((turn) => (turn.id === id ? fn(turn) : turn)));
    setTurns((current) => [
      ...current,
      { id, question: text, answer: '', steps: [], drafts: [], status: 'streaming' },
    ]);
    setQuestion('');
    setBusy(true);
    abort.current = new AbortController();
    try {
      await askAi(
        { conversationId, message: text },
        (event) => {
          if (event.type === 'conversation') setConversationId(event.conversationId);
          update((turn) => applyStreamEvent(turn, event));
        },
        abort.current.signal,
      );
      update((turn) => (turn.status === 'streaming' ? { ...turn, status: 'done' } : turn));
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        update((turn) => ({ ...turn, status: 'error', error: describeError(error) }));
      }
    } finally {
      setBusy(false);
    }
  };

  const scopeLabel = askScopeLabel(me, countryName);
  const current = reviewQueue[0];

  return (
    <>
      <AskView
        turns={turns}
        question={question}
        onQuestionChange={setQuestion}
        onAsk={(text) => void ask(text)}
        onNewChat={() => {
          abort.current?.abort();
          setTurns([]);
          setConversationId(undefined);
        }}
        busy={busy}
        canReviewDrafts={can('salary:change')}
        savedDraftIds={savedDraftIds}
        onReviewDrafts={(turnId) =>
          setReviewQueue(
            turns
              .find((turn) => turn.id === turnId)
              ?.drafts.filter((draft) => !savedDraftIds.has(draft.draftId)) ?? [],
          )
        }
        scopeLabel={scopeLabel}
      />
      {current && (
        <SalaryChangeDialogContainer
          key={current.draftId}
          employeeId={current.employeeId}
          draft={current}
          onClose={() => setReviewQueue([])}
          onSaved={() => {
            setSavedDraftIds((ids) => new Set([...ids, current.draftId]));
            setReviewQueue((queue) => queue.slice(1));
          }}
        />
      )}
    </>
  );
}
