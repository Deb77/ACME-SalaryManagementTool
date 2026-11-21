import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listEmployees } from '../../api/endpoints';
import { sampleEmployees, sampleMeGlobal, sampleMeta } from '../../stories/screenSampleData';
import { createSession, SessionContext } from '../../session/SessionContext';
import { act, fireEvent, render, screen } from '../../test/render';
import { EmployeesScreen } from './EmployeesScreen';

vi.mock('../../api/endpoints', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/endpoints')>()),
  listEmployees: vi.fn(),
}));

const list = vi.mocked(listEmployees);

/** One change event per keystroke, as the input sees typing. */
function typeInto(input: HTMLElement, text: string) {
  input.focus();
  for (let i = 1; i <= text.length; i += 1) {
    fireEvent.change(input, { target: { value: text.slice(0, i) } });
    act(() => vi.advanceTimersByTime(50));
  }
}

function renderScreen() {
  render(
    <SessionContext.Provider value={createSession(sampleMeGlobal, sampleMeta)}>
      <EmployeesScreen />
    </SessionContext.Provider>,
  );
}

describe('EmployeesScreen', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    list.mockReset();
    list.mockResolvedValue({
      items: sampleEmployees,
      total: sampleEmployees.length,
      page: 1,
      pageSize: 25,
    });
  });
  afterEach(() => vi.useRealTimers());

  it('debounces the search: typing a word makes one request after 300 ms', async () => {
    renderScreen();
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(list).toHaveBeenCalledTimes(1);

    const input = screen.getByLabelText('Search employees');
    typeInto(input, 'priya');
    expect(input).toHaveValue('priya');
    expect(list).toHaveBeenCalledTimes(1);

    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(list).toHaveBeenCalledTimes(2);
    expect(list).toHaveBeenLastCalledWith(
      expect.objectContaining({ q: 'priya', page: 1 }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('keeps the search focused and shows skeleton rows while the search loads', async () => {
    renderScreen();
    await act(() => vi.advanceTimersByTimeAsync(0));
    list.mockReturnValueOnce(new Promise(() => {}));

    const input = screen.getByLabelText('Search employees');
    typeInto(input, 'pr');
    await act(() => vi.advanceTimersByTimeAsync(300));

    expect(screen.getByRole('status')).toHaveTextContent('Loading employees…');
    expect(screen.queryByRole('list', { name: 'Employees' })).not.toBeInTheDocument();
    expect(input).toHaveFocus();
  });
});
