import { describe, expect, it } from 'vitest';
import { render } from '../../../test/render';
import { Skeleton } from './Skeleton';

describe('Skeleton', () => {
  it('is hidden from assistive technology', () => {
    const { container } = render(<Skeleton width={120} />);

    const bone = container.querySelector('[data-skeleton]');
    expect(bone).toHaveAttribute('aria-hidden', 'true');
    expect(bone).toHaveStyle({ width: '120px', height: '14px' });
  });

  it('uses the height as the diameter of a circle', () => {
    const { container } = render(<Skeleton circle height={32} width={200} />);

    expect(container.querySelector('[data-skeleton]')).toHaveStyle({
      width: '32px',
      height: '32px',
    });
  });
});
