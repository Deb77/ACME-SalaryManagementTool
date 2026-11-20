import { describe, expect, it } from 'vitest';
import { formatDate, formatRelative, percentChange, salaryReasonLabel, todayIso } from './format';

describe('formatDate', () => {
  it('formats a calendar date without shifting the day', () => {
    expect(formatDate('2026-04-01')).toBe('1 Apr 2026');
  });
});

describe('todayIso', () => {
  it('returns the date part only', () => {
    expect(todayIso(new Date(2026, 10, 20, 15, 30))).toBe('2026-11-20');
  });
});

describe('formatRelative', () => {
  const now = new Date('2026-11-20T12:00:00Z');

  it('uses minutes, hours and days for recent times', () => {
    expect(formatRelative('2026-11-20T11:50:00Z', now)).toBe('10 min ago');
    expect(formatRelative('2026-11-20T10:00:00Z', now)).toBe('2 hours ago');
    expect(formatRelative('2026-11-19T12:00:00Z', now)).toBe('Yesterday');
  });

  it('falls back to the date after a week', () => {
    expect(formatRelative('2026-11-01T12:00:00Z', now)).toBe('1 Nov 2026');
  });
});

describe('percentChange', () => {
  it('is signed with one decimal', () => {
    expect(percentChange(300_000_000, 324_000_000)).toBe('+8.0%');
    expect(percentChange(200, 100)).toBe('−50.0%');
  });

  it('is null when there is no previous amount', () => {
    expect(percentChange(0, 100)).toBeNull();
  });
});

describe('salaryReasonLabel', () => {
  it('names system reasons too', () => {
    expect(salaryReasonLabel('import_undo')).toBe('Import undone');
  });
});
