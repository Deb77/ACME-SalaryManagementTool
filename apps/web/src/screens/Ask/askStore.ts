import type { AskTurn, MentionedPerson } from './Ask.utils';

/**
 * The Ask AI conversation, kept outside the screen so it survives moving to another tab and back,
 * and an answer keeps streaming while the user is elsewhere. Memory only: nothing about salaries
 * is written to browser storage. Signing out reloads the page, which clears it; a different user
 * signing in (say, after the session expired) starts from scratch.
 */
export interface AskState {
  /** Whose conversation this is; another user starts from scratch. */
  userId?: string;
  conversationId?: string;
  turns: AskTurn[];
  /** The question being typed. */
  question: string;
  busy: boolean;
  savedDraftIds: ReadonlySet<string>;
  /** Names for the employee codes in answers, looked up for this user. */
  people: ReadonlyMap<string, MentionedPerson>;
}

const empty = (userId?: string): AskState => ({
  userId,
  turns: [],
  question: '',
  busy: false,
  savedDraftIds: new Set(),
  people: new Map(),
});

let state: AskState = empty();
let controller: AbortController | null = null;
/** Codes already looked up (found or not), so each is fetched once per conversation. */
let lookedUp = new Set<string>();
const listeners = new Set<() => void>();

export const askStore = {
  get: (): AskState => state,

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  update(change: Partial<AskState> | ((current: AskState) => Partial<AskState>)): void {
    state = { ...state, ...(typeof change === 'function' ? change(state) : change) };
    for (const listener of listeners) listener();
  },

  /** A fresh signal for the next answer; aborts any answer still streaming. */
  startStream(): AbortSignal {
    controller?.abort();
    controller = new AbortController();
    return controller.signal;
  },

  /** Marks a code as looked up; false when it already was. */
  claimLookup(code: string): boolean {
    if (lookedUp.has(code)) return false;
    lookedUp.add(code);
    return true;
  },

  /** Stops any answer and forgets the conversation, keeping (or setting) the owner. */
  reset(userId: string | undefined = state.userId): void {
    controller?.abort();
    controller = null;
    lookedUp = new Set();
    state = empty(userId);
    for (const listener of listeners) listener();
  },
};
