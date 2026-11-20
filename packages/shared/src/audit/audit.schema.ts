import { z } from 'zod';
import { countryCodeSchema, timestampSchema } from '../core/common.schema.js';

export const auditActions = [
  'employee.created',
  'employee.updated',
  'employee.terminated',
  'salary.changed',
  'import.committed',
  'import.undone',
  'export.created',
  'user.invited',
  'user.updated',
  'user.deactivated',
  'role.created',
  'role.updated',
  'role.deleted',
] as const;

export type AuditAction = (typeof auditActions)[number];

/** One row of `GET /api/audit-events`; `before` and `after` hold only the changed fields. */
export const auditEventSchema = z.object({
  id: z.uuid(),
  occurredAt: timestampSchema,
  actor: z.object({ id: z.uuid(), name: z.string(), role: z.string() }),
  action: z.enum(auditActions),
  entity: z.object({ type: z.string(), id: z.uuid(), label: z.string() }),
  country: countryCodeSchema.nullable(),
  before: z.record(z.string(), z.unknown()).nullable(),
  after: z.record(z.string(), z.unknown()).nullable(),
  context: z.record(z.string(), z.unknown()).nullable(),
});

export type AuditEvent = z.infer<typeof auditEventSchema>;
