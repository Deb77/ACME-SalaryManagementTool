import { render, screen, within } from '../../../test/render';
import { describe, expect, it } from 'vitest';
import { AppShell, type NavGroup } from './AppShell';

const navGroups: NavGroup[] = [
  { label: 'People', items: [{ key: 'employees', label: 'Employees', href: '/employees' }] },
  {
    label: 'Analytics',
    items: [
      { key: 'insights', label: 'Insights', href: '/insights' },
      { key: 'ask', label: 'Ask AI', href: '/ask' },
    ],
  },
];

function renderShell() {
  render(
    <AppShell
      productName="ACME People"
      navGroups={navGroups}
      activeKey="insights"
      user={{ name: 'Riya Kapoor', role: 'Global HR' }}
      topBarStart="Insights"
    >
      <h1>How ACME pays people</h1>
    </AppShell>,
  );
}

describe('AppShell', () => {
  it('marks the active page in the main navigation', () => {
    renderShell();

    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Insights' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: 'Employees' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('groups navigation links under their area', () => {
    renderShell();

    expect(screen.getByRole('list', { name: 'Analytics' }).children).toHaveLength(2);
  });

  it('renders the page inside the main landmark with a skip link to it', () => {
    renderShell();

    expect(screen.getByRole('main')).toContainElement(
      screen.getByRole('heading', { name: 'How ACME pays people' }),
    );
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute(
      'href',
      '#main-content',
    );
  });

  it('shows who is signed in and their role', () => {
    renderShell();

    expect(screen.getByText('Riya Kapoor')).toBeInTheDocument();
    expect(screen.getByText('Global HR')).toBeInTheDocument();
  });
});
