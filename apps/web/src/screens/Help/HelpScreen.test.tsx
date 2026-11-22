import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '../../test/render';
import { HelpScreen } from './HelpScreen';

afterEach(() => window.localStorage.clear());

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="help" element={<HelpScreen />} />
        <Route path="help/:topic" element={<HelpScreen />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('HelpScreen', () => {
  it('lists the topics and filters them by search', () => {
    renderAt('/help');
    expect(screen.getByRole('heading', { level: 1, name: 'Help & guide' })).toBeInTheDocument();
    const cards = screen.getByRole('list', { name: 'Help topics' });
    expect(within(cards).getAllByRole('link')).toHaveLength(11);

    fireEvent.change(screen.getByLabelText('Search the guide'), { target: { value: 'undo' } });
    expect(
      within(screen.getByRole('list', { name: 'Help topics' })).getAllByRole('link'),
    ).toHaveLength(1);

    fireEvent.change(screen.getByLabelText('Search the guide'), { target: { value: 'zzz' } });
    expect(screen.getByText('Nothing matches that search')).toBeInTheDocument();
  });

  it('shows one topic with its screenshot, steps, tips and neighbours', () => {
    renderAt('/help/change-pay');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Change someone’s pay' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Record salary change dialog/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'How to' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Good to know' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Change someone’s pay' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    const pager = screen.getByRole('navigation', { name: 'More help topics' });
    expect(within(pager).getByRole('link', { name: /Previous/ })).toHaveAttribute(
      'href',
      '/help/add-employee',
    );
    expect(within(pager).getByRole('link', { name: /Next/ })).toHaveAttribute(
      'href',
      '/help/leavers',
    );
    expect(document.title).toBe('Change someone’s pay · Help · ACME People');
  });

  it('says so for a topic that does not exist', () => {
    renderAt('/help/nope');
    expect(screen.getByText('That help topic doesn’t exist')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See all help topics' })).toHaveAttribute(
      'href',
      '/help',
    );
  });

  it('offers sign-in to a visitor and the way back to someone signed in', () => {
    const { unmount } = renderAt('/help');
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/sign-in');
    unmount();

    window.localStorage.setItem('acme.signedIn', '1');
    renderAt('/help');
    expect(screen.getByRole('link', { name: 'Back to ACME People' })).toHaveAttribute('href', '/');
  });
});
