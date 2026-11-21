import { hash, verify } from '@node-rs/argon2';

/**
 * argon2id with the library defaults, which are the OWASP parameters (19 MiB, 2 iterations,
 * parallelism 1). Behind an interface so tests can inject a fast fake.
 */
export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(passwordHash: string, password: string): Promise<boolean>;
}

export class Argon2Hasher implements PasswordHasher {
  hash(password: string) {
    return hash(password);
  }

  async verify(passwordHash: string, password: string) {
    try {
      return await verify(passwordHash, password);
    } catch {
      return false;
    }
  }
}
