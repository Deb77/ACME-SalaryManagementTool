import { render, screen } from '../../../test/render';
import { describe, expect, it } from 'vitest';
import { MeterBar } from './MeterBar';

describe('MeterBar', () => {
  it('fills in proportion to the maximum and is decorative', () => {
    const { container } = render(<MeterBar value={25} max={100} />);

    expect(screen.getByTestId('meter-fill').style.width).toBe('25%');
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });
});
