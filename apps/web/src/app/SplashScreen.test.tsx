import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SplashScreen } from './SplashScreen';

describe('SplashScreen', () => {
  it('shows the logo and tells assistive technology the app is loading', () => {
    render(<SplashScreen />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading ACME People…');
    expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByTestId('logo')).toHaveAttribute('aria-hidden', 'true');
  });
});
