import { render, screen } from '../../../test/render';
import { describe, expect, it } from 'vitest';
import { AppLink, LinkProvider } from './AppLink';
import type { LinkComponentProps } from './AppLink.utils';

describe('AppLink', () => {
  it('renders a plain anchor when no link component is provided', () => {
    render(<AppLink href="/employees">Employees</AppLink>);

    expect(screen.getByRole('link', { name: 'Employees' })).toHaveAttribute('href', '/employees');
  });

  it('renders the provided link component, e.g. the router link', () => {
    const RouterLink = ({ href, children }: LinkComponentProps) => (
      <a href={href} data-router="yes">
        {children}
      </a>
    );
    render(
      <LinkProvider component={RouterLink}>
        <AppLink href="/insights">Insights</AppLink>
      </LinkProvider>,
    );

    expect(screen.getByRole('link', { name: 'Insights' })).toHaveAttribute('data-router', 'yes');
  });
});
