import { render, screen } from '../../../test/render';
import { describe, expect, it } from 'vitest';
import { Stepper } from './Stepper';

const steps = ['Upload', 'Match columns', 'Review', 'Import'];

describe('Stepper', () => {
  it('lists every step in order', () => {
    render(<Stepper label="Import steps" steps={steps} current={2} />);

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(4);
    expect(screen.getByRole('list', { name: 'Import steps' })).toBeInTheDocument();
  });

  it('marks the current step and announces finished ones', () => {
    render(<Stepper label="Import steps" steps={steps} current={2} />);

    const [upload, , review, importStep] = screen.getAllByRole('listitem');
    expect(review).toHaveAttribute('aria-current', 'step');
    expect(upload).toHaveTextContent('Upload (done)');
    expect(importStep).not.toHaveAttribute('aria-current');
  });
});
