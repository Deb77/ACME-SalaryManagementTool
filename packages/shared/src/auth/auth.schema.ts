import { z } from 'zod';

/** NIST SP 800-63B: length only, no composition rules (docs/auth.md, Chosen approach). */
export const passwordSchema = z
  .string()
  .min(12, 'Use at least 12 characters')
  .max(128, 'Use at most 128 characters');

/** `POST /api/auth/sign-in` → 200 `Me`, and sets the session cookie. */
export const signInRequestSchema = z.strictObject({
  email: z.email(),
  /** Not checked against the password rules: a wrong password gets the generic 401. */
  password: z.string().min(1).max(256),
});

export type SignInRequest = z.infer<typeof signInRequestSchema>;

/** `GET /api/auth/invites/:token`: who the link is for, before they choose a password. */
export const inviteInfoSchema = z.object({
  email: z.email(),
  name: z.string(),
  /** True when the user already had a password, so the link resets it. */
  isReset: z.boolean(),
});

export type InviteInfo = z.infer<typeof inviteInfoSchema>;

/** `POST /api/auth/accept-invite` → 200 `Me`; sets the password and signs the user in. */
export const acceptInviteRequestSchema = z.strictObject({
  token: z.string().min(16).max(128),
  password: passwordSchema,
});

export type AcceptInviteRequest = z.infer<typeof acceptInviteRequestSchema>;
