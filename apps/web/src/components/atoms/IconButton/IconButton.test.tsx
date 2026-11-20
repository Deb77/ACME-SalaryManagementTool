import { render, screen } from '../../../test/render';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { IconButton } from './IconButton';

describe('IconButton', () => {
  it('is a button named by its label', async () => {
    const onClick = vi.fn();
    render(<IconButton label="Export CSV" icon="↓" onClick={onClick} />);

    await userEvent.click(screen.getByRole('button', { name: 'Export CSV' }));

    expect(onClick).toHaveBeenCalledOnce();
  });

  it('renders a link when given an href', () => {
    render(<IconButton label="Import from Excel" icon="↑" href="/employees/import" />);

    expect(screen.getByRole('link', { name: 'Import from Excel' })).toHaveAttribute(
      'href',
      '/employees/import',
    );
  });
});
