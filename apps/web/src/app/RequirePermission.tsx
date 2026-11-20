import type { Permission } from '@acme/shared';
import type { ReactNode } from 'react';
import { EmptyState } from '../components';
import { useSession } from '../session/SessionContext';

/** Route guard: the API enforces permissions too; this keeps the UI from offering dead ends. */
export function RequirePermission({
  anyOf,
  children,
}: {
  anyOf: readonly Permission[];
  children: ReactNode;
}) {
  const { can } = useSession();
  if (!anyOf.some(can)) {
    return (
      <EmptyState
        title="You don't have access to this page"
        description="Ask a Global HR admin if you need it."
      />
    );
  }
  return children;
}
