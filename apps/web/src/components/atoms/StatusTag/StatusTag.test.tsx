import { render, screen } from '../../../test/render';
import { describe, expect, it } from 'vitest';
import { StatusTag } from './StatusTag';

describe('StatusTag', () => {
  it('states the status in text', () => {
    render(
      <StatusTag tone="success" dot>
        Active
      </StatusTag>,
    );

    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('keeps the decorative dot out of the accessible text', () => {
    const { container } = render(
      <StatusTag tone="danger" dot>
        Terminated
      </StatusTag>,
    );

    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
    expect(screen.getByText('Terminated')).toHaveTextContent(/^Terminated$/);
  });
});
