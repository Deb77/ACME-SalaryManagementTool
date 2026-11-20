import type { Employee } from '@acme/shared';
import { StatusTag } from '../../components';

/** Employee status in words, with the live dot for active employees. */
export function StatusBadge({ status }: { status: Employee['status'] }) {
  return status === 'active' ? (
    <StatusTag tone="success" dot>
      Active
    </StatusTag>
  ) : (
    <StatusTag tone="neutral">Terminated</StatusTag>
  );
}
