import { render, screen } from '../../../test/render';
import { describe, expect, it } from 'vitest';
import { Notice } from './Notice';

describe('Notice', () => {
  it('is a region named by its title, with the explanation and action', () => {
    render(
      <Notice tone="accent" title="3 draft salary changes" action={<button>Review drafts</button>}>
        Nothing is saved until you approve each one.
      </Notice>,
    );

    const notice = screen.getByRole('region', { name: '3 draft salary changes' });
    expect(notice).toHaveTextContent('Nothing is saved until you approve each one.');
    expect(screen.getByRole('button', { name: 'Review drafts' })).toBeInTheDocument();
  });

  it('falls back to a generic name when there is no title', () => {
    render(<Notice>You can import India only.</Notice>);

    expect(screen.getByRole('region', { name: 'Note' })).toHaveTextContent(
      'You can import India only.',
    );
  });
});
