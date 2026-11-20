import { describe, expect, it } from 'vitest';
import { auditEventSchema } from './audit.schema.js';

describe('auditEventSchema', () => {
  it('accepts an access change with only the changed fields', () => {
    const event = {
      id: '0b8f4a2e-6c1d-4f7e-9a3b-2d5e8c1f4a60',
      occurredAt: '2026-11-18T10:02:11.000Z',
      actor: { id: '6f1c1f3e-2a51-4c55-9d4e-3c3a8e0b7a10', name: 'Riya Kapoor', role: 'global_hr' },
      action: 'user.updated',
      entity: { type: 'user', id: '6f1c1f3e-2a51-4c55-9d4e-3c3a8e0b7a11', label: 'Sarah Mitchell' },
      country: null,
      before: { countries: ['US'] },
      after: { countries: ['US', 'CA'] },
      context: null,
    };
    expect(auditEventSchema.parse(event)).toEqual(event);
  });
});
