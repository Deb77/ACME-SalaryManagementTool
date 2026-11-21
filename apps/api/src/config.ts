/** Runtime settings, read once from the environment at startup (see .env.example). */
export interface Config {
  /** Connection string for the API's pool. The pool switches to the `acme_app` role. */
  databaseUrl: string;
  /** Origins allowed to send state-changing requests (CSRF check). */
  allowedOrigins: readonly string[];
  /** Base URL used to build invite links. */
  appUrl: string;
  /** `Secure` + `__Host-` cookie. Off only for http://localhost development. */
  secureCookies: boolean;
  /** Pool size for the API connection. */
  dbPoolSize: number;
  /** Sign-in and invite attempts per IP per 15 minutes. */
  authRateLimit?: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL is not set. Copy .env.example to .env at the repo root and fill it in (see README, "Database").',
    );
  }
  const production = env.NODE_ENV === 'production';
  const appUrl = env.APP_URL ?? 'http://localhost:5173';
  const allowedOrigins = (env.APP_ORIGINS ?? `${appUrl},http://localhost:3000`)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return {
    databaseUrl,
    allowedOrigins,
    appUrl,
    secureCookies: env.COOKIE_SECURE ? env.COOKIE_SECURE === 'true' : production,
    dbPoolSize: Number(env.DB_POOL_SIZE ?? 10),
  };
}
