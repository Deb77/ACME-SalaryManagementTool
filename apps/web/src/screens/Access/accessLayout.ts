import type { Me, Role } from '@acme/shared';
import { can, canEditRole } from '../../session/permissions';

/** One role card's look: Global HR's dark card, and whether it has an Edit button. */
export interface RoleSlot {
  hero: boolean;
  editable: boolean;
}

/** What the Access page held when it last loaded, so the next skeleton draws the same page. */
export interface AccessLayout {
  roles: RoleSlot[];
  /** Team member rows (the table shows everyone on one page). */
  members: number;
  /** Recent access changes listed. */
  changes: number;
}

let last: AccessLayout | null = null;

export function rememberAccessLayout(
  me: Me,
  roles: readonly Role[],
  members: number,
  changes: number,
) {
  last = {
    roles: roles.map((role) => ({
      hero: role.key === 'global_hr',
      editable: canEditRole(me, role),
    })),
    members,
    changes,
  };
}

/**
 * The layout the Access skeleton draws: the last load's or, before any, the two built-in roles
 * (Country HR then Global HR, as the list orders them) with a typical number of rows.
 */
export function accessLayoutFor(me: Me | undefined): AccessLayout {
  return (
    last ?? {
      roles: [
        {
          hero: false,
          editable: me ? can(me, 'roles:manage') && me.role.key !== 'country_hr' : false,
        },
        { hero: true, editable: false },
      ],
      members: 4,
      changes: 3,
    }
  );
}
