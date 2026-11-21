import { useEffect, useState, useSyncExternalStore } from 'react';
import { askAi } from '../../api/askStream';
import { ApiError, describeError } from '../../api/client';
import { listEmployees } from '../../api/endpoints';
import { useSession } from '../../session/SessionContext';
import { SalaryChangeDialogContainer } from '../SalaryChange/SalaryChangeDialogContainer';
import {
  applyStreamEvent,
  askScopeLabel,
  askSuggestions,
  employeeCodesIn,
  type AskTurn,
} from './Ask.utils';
import { askStore, type AskState } from './askStore';
import { AskView } from './AskView';

const BLANK: AskState = {
  turns: [],
  question: '',
  busy: false,
  savedDraftIds: new Set(),
  people: new Map(),
};

/**
 * Container: streams answers from `POST /api/ai/messages` and opens drafts in the dialog. The
 * conversation lives in `askStore`, so it is still there after visiting another tab.
 */
export function AskScreen() {
  const { me, can, countryName } = useSession();
  const stored = useSyncExternalStore(askStore.subscribe, askStore.get);
  // Someone else's conversation (a different user signed in) is never shown, and is dropped.
  const mine = stored.userId === me.id;
  useEffect(() => {
    if (!mine) askStore.reset(me.id);
  }, [mine, me.id]);
  const { turns, question, busy, savedDraftIds, people } = mine ? stored : BLANK;
  const [reviewQueue, setReviewQueue] = useState<AskTurn['drafts']>([]);

  // Answers name employees by code only. Look each new code up through the employees API, which
  // returns only people this user may see, and show the name next to it.
  useEffect(() => {
    const codes = turns
      .filter((turn) => turn.status !== 'streaming')
      .flatMap((turn) => employeeCodesIn(turn.answer))
      .filter((code) => askStore.claimLookup(code))
      .slice(0, 25);
    for (const code of codes) {
      listEmployees({ q: code, status: 'all', page: 1, pageSize: 5 })
        .then((page) => {
          const match = page.items.find((employee) => employee.employeeCode === code);
          if (!match) return;
          askStore.update((current) => ({
            people: new Map(current.people).set(code, {
              id: match.id,
              name: `${match.firstName} ${match.lastName}`,
            }),
          }));
        })
        .catch(() => {
          // Leave the bare code; it is still a correct answer.
        });
    }
  }, [turns]);

  const ask = async (text: string) => {
    const id = crypto.randomUUID();
    const update = (fn: (turn: AskTurn) => AskTurn) =>
      askStore.update((current) => ({
        turns: current.turns.map((turn) => (turn.id === id ? fn(turn) : turn)),
      }));
    askStore.update((current) => ({
      turns: [
        ...current.turns,
        { id, question: text, answer: '', steps: [], drafts: [], status: 'streaming' },
      ],
      question: '',
      busy: true,
    }));
    const signal = askStore.startStream();
    try {
      await askAi(
        { conversationId: askStore.get().conversationId, message: text },
        (event) => {
          if (event.type === 'conversation') {
            askStore.update({ conversationId: event.conversationId });
          }
          update((turn) => applyStreamEvent(turn, event));
        },
        signal,
      );
      update((turn) => (turn.status === 'streaming' ? { ...turn, status: 'done' } : turn));
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        update((turn) => ({
          ...turn,
          status: 'error',
          error: describeError(error),
          errorCode: error instanceof ApiError ? error.code : undefined,
        }));
      }
    } finally {
      // A newer question (or New chat) owns `busy` once this stream was replaced.
      if (!signal.aborted) askStore.update({ busy: false });
    }
  };

  const scopeLabel = askScopeLabel(me, countryName);
  const current = reviewQueue[0];

  return (
    <>
      <AskView
        turns={turns}
        question={question}
        onQuestionChange={(value) => askStore.update({ question: value })}
        onAsk={(text) => void ask(text)}
        onNewChat={() => askStore.reset()}
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
        people={people}
        suggestions={askSuggestions(me, countryName)}
      />
      {current && (
        <SalaryChangeDialogContainer
          key={current.draftId}
          employeeId={current.employeeId}
          draft={current}
          onClose={() => setReviewQueue([])}
          onSaved={() => {
            askStore.update((state) => ({
              savedDraftIds: new Set([...state.savedDraftIds, current.draftId]),
            }));
            setReviewQueue((queue) => queue.slice(1));
          }}
        />
      )}
    </>
  );
}
