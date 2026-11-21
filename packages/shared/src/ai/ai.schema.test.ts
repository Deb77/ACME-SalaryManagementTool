import { describe, expect, it } from 'vitest';
import { aiStreamEventSchema, askAiRequestSchema } from './ai.schema.js';

describe('askAiRequestSchema', () => {
  it('starts a new conversation when no id is given', () => {
    expect(
      askAiRequestSchema.parse({ message: 'Median pay for Data Analysts in IN vs GB?' }),
    ).toEqual({ message: 'Median pay for Data Analysts in IN vs GB?' });
  });

  it('rejects an empty question', () => {
    expect(askAiRequestSchema.safeParse({ message: '   ' }).success).toBe(false);
  });
});

describe('aiStreamEventSchema', () => {
  it('parses a drafted salary change as data, not an action', () => {
    const event = {
      type: 'draft_salary_change',
      draft: {
        draftId: '6f1c1f3e-2a51-4c55-9d4e-3c3a8e0b7a10',
        employeeId: '0b8f4a2e-6c1d-4f7e-9a3b-2d5e8c1f4a60',
        employeeCode: 'ACM-000123',
        employeeName: 'Asha Rao',
        currentAmount: { amountMinor: 180_000_000, currency: 'INR' },
        proposedAmount: { amountMinor: 198_000_000, currency: 'INR' },
        effectiveDate: '2027-01-01',
        reason: 'market_adjustment',
        note: null,
      },
    };
    expect(aiStreamEventSchema.parse(event)).toEqual(event);
  });

  it('rejects unknown event types', () => {
    expect(aiStreamEventSchema.safeParse({ type: 'apply_change' }).success).toBe(false);
  });
});
