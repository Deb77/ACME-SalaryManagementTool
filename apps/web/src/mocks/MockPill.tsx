/**
 * A tiny dev-only pill in the bottom-right corner that says which fake user the mock API
 * is signed in as and links to the others. Plain DOM and inline styles on purpose: it sits
 * outside the app tree (and Mantine) so it cannot affect screen layout or styling.
 * Mounted by `browser.ts` into its own root.
 */
import type { CSSProperties } from 'react';
import { mockUserKeys, mockUserLabels, type MockUserKey } from './mockUser';

const pillStyle: CSSProperties = {
  position: 'fixed',
  right: 12,
  bottom: 12,
  zIndex: 2147483000,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 10px 6px 12px',
  borderRadius: 999,
  background: 'rgba(20, 20, 24, 0.86)',
  color: '#f4f4f5',
  font: '500 12px/1 system-ui, -apple-system, "Segoe UI", sans-serif',
  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
  backdropFilter: 'blur(6px)',
};

const linkStyle: CSSProperties = {
  color: '#c4b5fd',
  textDecoration: 'none',
  padding: '4px 6px',
  borderRadius: 999,
  whiteSpace: 'nowrap',
};

export function MockPill({ current }: { current: MockUserKey }) {
  const switchHref = (key: MockUserKey) => `${window.location.pathname}?as=${key}`;
  return (
    <div style={pillStyle} role="status" aria-label="Mock API user">
      <span style={{ opacity: 0.7 }}>Mock API</span>
      <span aria-hidden="true" style={{ opacity: 0.4 }}>
        ·
      </span>
      <strong style={{ fontWeight: 600 }}>{mockUserLabels[current]}</strong>
      <span aria-hidden="true" style={{ opacity: 0.4 }}>
        |
      </span>
      {mockUserKeys
        .filter((key) => key !== current)
        .map((key) => (
          <a
            key={key}
            href={switchHref(key)}
            style={linkStyle}
            title={`Reload as ${mockUserLabels[key]}`}
          >
            {mockUserLabels[key]}
          </a>
        ))}
    </div>
  );
}
