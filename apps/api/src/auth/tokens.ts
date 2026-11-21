import { createHash, randomBytes } from 'node:crypto';

/** 32 random bytes, base64url: the session cookie and invite link secret. */
export const newToken = () => randomBytes(32).toString('base64url');

/** Only this hash is stored. 256-bit tokens need no slow hash (docs/auth.md, Data model). */
export const hashToken = (token: string) => createHash('sha256').update(token).digest();
