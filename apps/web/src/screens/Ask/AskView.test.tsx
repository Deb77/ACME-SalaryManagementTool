import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { sampleDraft } from '../../stories/screenSampleData';
import { render, screen } from '../../test/render';
import type { AskTurn } from './Ask.utils';
import { AskView, type AskViewProps } from './AskView';

const answered: AskTurn = {
  id: 't1',
  question: 'Who is underpaid?',
  answer: 'Nine analysts.',
  steps: [{ callId: 'c', label: 'Looked up pay', result: '3 rows' }],
  drafts: [sampleDraft],
  status: 'done',
};

const props = (overrides: Partial<AskViewProps> = {}): AskViewProps => ({
  turns: [],
  question: '',
  onQuestionChange: vi.fn(),
  onAsk: vi.fn(),
  onNewChat: vi.fn(),
  busy: false,
  canReviewDrafts: true,
  savedDraftIds: new Set(),
  onReviewDrafts: vi.fn(),
  scopeLabel: 'India',
  ...overrides,
});

describe('AskView', () => {
  it('asks a suggested question', async () => {
    const onAsk = vi.fn();
    render(<AskView {...props({ onAsk })} />);

    const suggestions = screen.getByRole('list', { name: 'Suggested questions' });
    await userEvent.click(suggestions.querySelector('button')!);
    expect(onAsk).toHaveBeenCalledWith(expect.any(String));
  });

  it('shows the answer, the approval card and the folded steps', async () => {
    const onReviewDrafts = vi.fn();
    render(<AskView {...props({ turns: [answered], onReviewDrafts })} />);

    expect(screen.getByText('Nine analysts.')).toBeInTheDocument();
    expect(screen.getByText(/How I worked this out · 1 step/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Review draft' }));
    expect(onReviewDrafts).toHaveBeenCalledWith('t1');
  });

  it('does not offer review without salary:change, or once drafts are saved', () => {
    const { rerender } = render(
      <AskView {...props({ turns: [answered], canReviewDrafts: false })} />,
    );
    expect(screen.queryByRole('button', { name: 'Review draft' })).not.toBeInTheDocument();

    rerender(
      <AskView {...props({ turns: [answered], savedDraftIds: new Set([sampleDraft.draftId]) })} />,
    );
    expect(screen.queryByRole('button', { name: 'Review draft' })).not.toBeInTheDocument();
  });

  it('says when an answer stopped', () => {
    render(
      <AskView
        {...props({ turns: [{ ...answered, drafts: [], status: 'error', error: 'Down for now' }] })}
      />,
    );

    expect(screen.getByRole('region', { name: 'The answer stopped' })).toHaveTextContent(
      'Down for now',
    );
  });

  it('renders tables, lists and bold text from the answer, never its HTML', () => {
    const answer = [
      'Compared:',
      '',
      '| Country | Median |',
      '|---|---|',
      '| India | ₹1,830,000 |',
      '',
      '- **Email:** not visible <img src=x onerror=alert(1)>',
    ].join('\n');
    const { container } = render(
      <AskView {...props({ turns: [{ ...answered, answer, drafts: [] }] })} />,
    );

    const table = screen.getByRole('table');
    expect(table).toHaveTextContent('India');
    expect(screen.getByRole('cell', { name: '₹1,830,000' })).toHaveStyle({ textAlign: 'right' });
    expect(screen.getByText('Email:').tagName).toBe('STRONG');
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByRole('listitem')).toHaveTextContent('<img src=x onerror=alert(1)>');
  });
});
