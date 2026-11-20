/**
 * Display helpers shared by the screens: dates, percentages and the human labels for the
 * enum values in `@acme/shared`. Money lives in `money.ts`.
 */
import type { Permission } from '@acme/shared';

/** `2026-04-01` → `1 Apr 2026`. Calendar dates have no time zone, so they are formatted in UTC. */
export function formatDate(isoDate: string): string {
  const date = new Date(`${isoDate.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

/** Today as `YYYY-MM-DD` in the viewer's calendar (the default effective date). */
export function todayIso(now = new Date()): string {
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

/** "2 hours ago", "Yesterday", "12 Nov 2026" for sign-in and audit times. */
export function formatRelative(timestamp: string, now = new Date()): string {
  const then = new Date(timestamp);
  const minutes = Math.round((now.getTime() - then.getTime()) / 60_000);
  if (minutes < 2) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return formatDate(then.toISOString());
}

/** Change from `from` to `to` as a signed percentage with one decimal ("+8.0%"). */
export function percentChange(from: number, to: number): string | null {
  if (from <= 0) return null;
  const percent = ((to - from) / from) * 100;
  const rounded = Math.round(percent * 10) / 10;
  return `${rounded > 0 ? '+' : rounded < 0 ? '−' : ''}${Math.abs(rounded).toFixed(1)}%`;
}

export function formatCount(value: number): string {
  return value.toLocaleString('en-US');
}

const SALARY_REASON_LABELS: Record<string, string> = {
  annual_review: 'Annual review',
  promotion: 'Promotion',
  market_adjustment: 'Market adjustment',
  correction: 'Correction',
  other: 'Other',
  hire: 'Hire',
  import: 'Import',
  import_undo: 'Import undone',
};

export function salaryReasonLabel(reason: string): string {
  return SALARY_REASON_LABELS[reason] ?? reason;
}

const TERMINATION_REASON_LABELS: Record<string, string> = {
  resignation: 'Resignation',
  dismissal: 'Dismissal',
  redundancy: 'Redundancy',
  retirement: 'Retirement',
  end_of_contract: 'End of contract',
  other: 'Other',
};

export function terminationReasonLabel(reason: string): string {
  return TERMINATION_REASON_LABELS[reason] ?? reason;
}

/** Plain-language names for the permission catalogue, shown on role cards and in the editor. */
export const permissionLabels: Record<Permission, string> = {
  'employees:read': 'View employees and salary history',
  'employees:write': 'Add employees and edit details',
  'employees:terminate': 'Record leavers',
  'salary:change': 'Record salary changes',
  'employees:export': 'Export lists to CSV',
  'imports:run': 'Import from Excel',
  'insights:read': 'Pay insights',
  'ai:ask': 'Ask AI',
  'audit:read': 'Audit log',
  'users:manage': 'Invite people and change their access',
  'roles:manage': 'Create and edit roles',
};
