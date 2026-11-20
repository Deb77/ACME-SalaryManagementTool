import type { Me } from '@acme/shared';
import type { ReactNode } from 'react';
import { activeKeyFor, navGroupsFor } from '../../app/navigation';
import { AppShell, LinkProvider, type LinkComponentProps } from '../../components';

/** Links in screen stories don't leave the story. */
function StoryLink({ onClick, ...props }: LinkComponentProps) {
  return (
    <a
      {...props}
      onClick={(event) => {
        event.preventDefault();
        onClick?.(event);
      }}
    />
  );
}

/** A screen view inside the real app frame, with the navigation the given user would see. */
export function ScreenFrame({ me, path, children }: { me: Me; path: string; children: ReactNode }) {
  const can = (permission: Me['permissions'][number]) => me.permissions.includes(permission);
  return (
    <LinkProvider component={StoryLink}>
      <AppShell
        productName="ACME People"
        logo="A"
        navGroups={navGroupsFor(can)}
        activeKey={activeKeyFor(path)}
        user={{ name: me.name, role: me.role.name }}
      >
        {children}
      </AppShell>
    </LinkProvider>
  );
}
