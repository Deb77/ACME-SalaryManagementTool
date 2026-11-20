import { render, screen } from '../../../test/render';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ChatComposer } from './ChatComposer';

function Harness({ onSubmit, busy = false }: { onSubmit: (m: string) => void; busy?: boolean }) {
  const [value, setValue] = useState('');
  return (
    <ChatComposer
      value={value}
      onChange={setValue}
      onSubmit={onSubmit}
      busy={busy}
      hint="Answers use only the salary data you can see."
    />
  );
}

describe('ChatComposer', () => {
  it('sends the trimmed question with Enter', async () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);

    await userEvent.type(
      screen.getByRole('textbox', { name: 'Ask a question about pay' }),
      '  Median pay in India? {Enter}',
    );

    expect(onSubmit).toHaveBeenCalledWith('Median pay in India?');
  });

  it('cannot send an empty question or while an answer is streaming', async () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} busy />);

    await userEvent.type(screen.getByRole('textbox'), 'Hello');

    expect(screen.getByRole('button', { name: 'Send question' })).toBeDisabled();
  });

  it('links the caveat to the input', () => {
    render(<Harness onSubmit={vi.fn()} />);

    expect(screen.getByRole('textbox')).toHaveAccessibleDescription(
      'Answers use only the salary data you can see.',
    );
  });
});
