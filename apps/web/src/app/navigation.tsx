import type { Permission } from '@acme/shared';
import { IconChartBar, IconShieldCheck, IconSparkles, IconUsers } from '@tabler/icons-react';
import type { NavGroup, NavItem } from '../components';

interface GatedNavItem extends NavItem {
  /** Shown when the user has any of these permissions. */
  anyOf: readonly Permission[];
}

const groups: { label: string; items: GatedNavItem[] }[] = [
  {
    label: 'People',
    items: [
      {
        key: 'employees',
        label: 'Employees',
        href: '/employees',
        icon: <IconUsers size={20} />,
        anyOf: ['employees:read'],
      },
    ],
  },
  {
    label: 'Analyse',
    items: [
      {
        key: 'insights',
        label: 'Insights',
        href: '/insights',
        icon: <IconChartBar size={20} />,
        anyOf: ['insights:read'],
      },
      {
        key: 'ask',
        label: 'Ask AI',
        href: '/ask',
        icon: <IconSparkles size={20} />,
        anyOf: ['ai:ask'],
      },
    ],
  },
  {
    label: 'Admin',
    items: [
      {
        key: 'access',
        label: 'Access & roles',
        shortLabel: 'Access',
        href: '/access',
        icon: <IconShieldCheck size={20} />,
        anyOf: ['users:manage', 'roles:manage'],
      },
    ],
  },
];

/** The navigation the signed-in user may see; groups with no visible item are dropped. */
export function navGroupsFor(can: (permission: Permission) => boolean): NavGroup[] {
  return groups
    .map((group) => ({
      label: group.label,
      items: group.items
        .filter((item) => item.anyOf.some(can))
        .map(({ anyOf: _anyOf, ...item }) => item),
    }))
    .filter((group) => group.items.length > 0);
}

/** First page the user can open, used for `/` and after sign-in. */
export function homePathFor(can: (permission: Permission) => boolean): string | null {
  return navGroupsFor(can)[0]?.items[0]?.href ?? null;
}

export function activeKeyFor(pathname: string): string {
  const first = pathname.split('/')[1] ?? '';
  return first;
}
