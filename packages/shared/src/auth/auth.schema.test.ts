import { describe, expect, it } from 'vitest';
import { acceptInviteRequestSchema, signInRequestSchema } from './auth.schema.js';

describe('signInRequestSchema', () => {
  it('accepts an email and any non-empty password', () => {
    expect(signInRequestSchema.parse({ email: 'a@b.test', password: 'x' })).toEqual({
      email: 'a@b.test',
      password: 'x',
    });
  });

  it('rejects unknown keys', () => {
    expect(
      signInRequestSchema.safeParse({ email: 'a@b.test', password: 'x', admin: true }).success,
    ).toBe(false);
  });
});

describe('acceptInviteRequestSchema', () => {
  it('needs a password of at least 12 characters', () => {
    const token = 'a'.repeat(43);
    expect(acceptInviteRequestSchema.safeParse({ token, password: 'short' }).success).toBe(false);
    expect(
      acceptInviteRequestSchema.safeParse({ token, password: 'long enough pass' }).success,
    ).toBe(true);
  });
});
