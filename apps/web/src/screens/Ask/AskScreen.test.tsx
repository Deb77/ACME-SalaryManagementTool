import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiStreamEvent } from '@acme/shared';
import { askAi } from '../../api/askStream';
import { ApiError } from '../../api/client';
import { createSalaryChange, getEmployee, listEmployees } from '../../api/endpoints';
import { createSession, SessionContext } from '../../session/SessionContext';
import {
  sampleDraft,
  sampleEmployees,
  sampleMeCountry,
  sampleMeGlobal,
  sampleMeta,
} from '../../stories/screenSampleData';
import { render, screen, waitFor } from '../../test/render';
import { AskScreen } from './AskScreen';
import { askStore } from './askStore';

vi.mock('../../api/askStream', () => ({ askAi: vi.fn() }));
vi.mock('../../api/endpoints', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/endpoints')>()),
  listEmployees: vi.fn(),
  getEmployee: vi.fn(),
  createSalaryChange: vi.fn(),
}));

const ask = vi.mocked(askAi);
const employee = sampleEmployees[3]!;

/** Plays the given events as one streamed answer. */
function streams(events: AiStreamEvent[]) {
  ask.mockImplementationOnce(async (_body, onEvent) => {
    events.forEach(onEvent);
  });
}

function renderScreen(me = sampleMeGlobal) {
  return render(
    <SessionContext.Provider value={createSession(me, sampleMeta)}>
      <AskScreen />
    </SessionContext.Provider>,
  );
}

async function askQuestion(text = 'Who is underpaid?') {
  await userEvent.type(screen.getByRole('textbox'), text);
  await userEvent.keyboard('{Enter}');
}

describe('AskScreen', () => {
  beforeEach(() => {
    askStore.reset(undefined);
    ask.mockReset();
    vi.mocked(listEmployees).mockReset();
    vi.mocked(getEmployee).mockReset();
    vi.mocked(createSalaryChange).mockReset();
  });

  it('says when Ask AI is unavailable (503)', async () => {
    ask.mockRejectedValueOnce(new ApiError(503, 'ai_unavailable', 'Down'));
    renderScreen();
    await askQuestion();
    expect(await screen.findByRole('region', { name: 'The answer stopped' })).toHaveTextContent(
      'Ask AI is unavailable right now',
    );
  });

  it('says the answer was cut off when the stream ends before it is done', async () => {
    // The server restarted mid-answer: some text and a step, then the connection closed.
    streams([
      { type: 'conversation', conversationId: 'c1' },
      { type: 'text', delta: 'Salaries are in different currencies.' },
      { type: 'tool_call', callId: 't1', tool: 'run_sql', summary: 'Find the top earners' },
      { type: 'tool_result', callId: 't1', rowCount: 3 },
    ]);
    renderScreen();
    await askQuestion();
    expect(await screen.findByRole('region', { name: 'The answer was cut off' })).toHaveTextContent(
      'Ask the question again',
    );
    expect(screen.getByRole('textbox')).toBeEnabled();
  });

  it('asks the user to slow down when rate limited (429)', async () => {
    ask.mockRejectedValueOnce(new ApiError(429, 'rate_limited', 'Too many'));
    renderScreen();
    await askQuestion();
    expect(await screen.findByRole('region', { name: 'Slow down' })).toHaveTextContent(
      'Wait a minute',
    );
  });

  it('offers a new conversation when the budget is used up', async () => {
    ask.mockRejectedValueOnce(
      new ApiError(
        429,
        'ai_budget_exceeded',
        'This conversation has reached its length limit. Start a new conversation.',
      ),
    );
    renderScreen();
    await askQuestion();
    const notice = await screen.findByRole('region', { name: 'Limit reached' });
    expect(notice).toHaveTextContent('Start a new conversation');
    await userEvent.click(screen.getByRole('button', { name: 'Start a new conversation' }));
    expect(screen.queryByRole('region', { name: 'Limit reached' })).not.toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Suggested questions' })).toBeInTheDocument();
  });

  it('shows the name next to an employee code, looked up through the employees API', async () => {
    vi.mocked(listEmployees).mockResolvedValue({
      items: [employee],
      total: 1,
      page: 1,
      pageSize: 5,
    });
    streams([
      { type: 'conversation', conversationId: sampleDraft.draftId },
      { type: 'text', delta: `The lowest paid is ${employee.employeeCode}.` },
      { type: 'done' },
    ]);
    renderScreen();
    await askQuestion();
    const link = await screen.findByRole('link', {
      name: `${employee.firstName} ${employee.lastName} (${employee.employeeCode})`,
    });
    expect(link).toHaveAttribute('href', `/employees/${employee.id}`);
    expect(listEmployees).toHaveBeenCalledWith(
      expect.objectContaining({ q: employee.employeeCode, status: 'all' }),
    );
  });

  it('shows the steps in plain English, never SQL', async () => {
    streams([
      { type: 'conversation', conversationId: sampleDraft.draftId },
      {
        type: 'tool_call',
        callId: 'c1',
        tool: 'run_sql',
        summary: 'Headcount',
      },
      { type: 'tool_result', callId: 'c1', rowCount: 1 },
      { type: 'text', delta: 'There are 40.' },
      { type: 'done' },
    ]);
    renderScreen();
    await askQuestion();
    expect(await screen.findByText('Headcount')).toBeVisible();
    expect(screen.queryByText(/select/i)).not.toBeInTheDocument();
  });

  it('says a stale draft is out of date instead of applying it', async () => {
    vi.mocked(listEmployees).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 5 });
    vi.mocked(getEmployee).mockResolvedValue(employee);
    vi.mocked(createSalaryChange).mockRejectedValue(
      new ApiError(409, 'draft_stale', 'This draft is out of date — ask again.'),
    );
    streams([
      { type: 'conversation', conversationId: sampleDraft.draftId },
      { type: 'text', delta: 'Here is a draft.' },
      { type: 'draft_salary_change', draft: sampleDraft },
      { type: 'done' },
    ]);
    renderScreen();
    await askQuestion();
    await userEvent.click(await screen.findByRole('button', { name: 'Review draft' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Save change' }));
    await waitFor(() => expect(createSalaryChange).toHaveBeenCalled());
    expect(vi.mocked(createSalaryChange).mock.calls[0]![1]).toMatchObject({
      aiDraftId: sampleDraft.draftId,
    });
    expect(await screen.findByText('This draft is out of date — ask again.')).toBeInTheDocument();
  });

  it('keeps the conversation after leaving the screen and coming back', async () => {
    streams([
      { type: 'conversation', conversationId: sampleDraft.draftId },
      { type: 'text', delta: 'There are 40.' },
      { type: 'done' },
    ]);
    const { unmount } = renderScreen();
    await askQuestion('How many?');
    expect(await screen.findByText('There are 40.')).toBeInTheDocument();
    unmount();

    renderScreen();
    expect(screen.getByText('There are 40.')).toBeInTheDocument();
    expect(screen.getByText('How many?')).toBeInTheDocument();
  });

  it("never shows another user's conversation", async () => {
    streams([{ type: 'text', delta: 'There are 40.' }, { type: 'done' }]);
    const { unmount } = renderScreen(sampleMeGlobal);
    await askQuestion('How many?');
    await screen.findByText('There are 40.');
    unmount();

    renderScreen(sampleMeCountry);
    expect(screen.queryByText('There are 40.')).not.toBeInTheDocument();
    expect(askStore.get()).toMatchObject({ userId: sampleMeCountry.id, turns: [] });
  });
});
