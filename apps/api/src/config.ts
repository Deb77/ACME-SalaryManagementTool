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
  /**
   * `acme_ai_reader` connection for Ask AI's run_sql (pool of 2). Without it, or without
   * `anthropicApiKey`, Ask AI answers 503 `ai_unavailable` and the rest of the app runs normally.
   */
  databaseUrlAi?: string;
  /** ANTHROPIC_API_KEY. Never logged. */
  anthropicApiKey?: string;
  /** Bearer token for the Prometheus `/metrics` endpoint; unset disables it. */
  metricsToken?: string;
  /** Ask AI limits and models; anything left out takes the default in `aiSettings`. */
  ai?: Partial<AiSettings>;
}

/** Ask AI budgets, limits and models (docs/api.md, Ask AI; decisions #38 and #40). */
export interface AiSettings {
  modelPrimary: string;
  modelFallback: string;
  /** Per model call, primary and fallback each. */
  callTimeoutMs: number;
  /** Input + output tokens summed over a conversation's messages. */
  conversationTokenBudget: number;
  /** Input + output tokens per user per UTC day. */
  dailyTokenBudget: number;
  /** Tool rounds per answer; the last model call is told to answer without tools. */
  maxToolRounds: number;
  /** Output tokens per answer, summed over its model calls. */
  maxOutputTokens: number;
  messagesPerMinute: number;
  messagesPerDay: number;
  /** Rows returned to the model per run_sql call, and the size of that result as JSON. */
  sqlRowCap: number;
  sqlResultMaxChars: number;
  /** Per run_sql statement; capped at the reader role's own 5 s. */
  sqlStatementTimeoutMs: number;
  /** Alert thresholds, checked over a rolling window and logged as `ai.alert` warnings. */
  alertWindowMinutes: number;
  alertErrorRate: number;
  alertFallbackRate: number;
  alertDailyTokens: number;
}

export const defaultAiSettings: AiSettings = {
  modelPrimary: 'claude-sonnet-5-5',
  modelFallback: 'claude-opus-5-5',
  callTimeoutMs: 30_000,
  conversationTokenBudget: 150_000,
  dailyTokenBudget: 1_000_000,
  maxToolRounds: 6,
  maxOutputTokens: 2_000,
  messagesPerMinute: 20,
  messagesPerDay: 200,
  sqlRowCap: 200,
  sqlResultMaxChars: 20_000,
  sqlStatementTimeoutMs: 5_000,
  alertWindowMinutes: 15,
  alertErrorRate: 0.1,
  alertFallbackRate: 0.2,
  alertDailyTokens: 5_000_000,
};

/** The effective Ask AI settings for a config: defaults plus any overrides. */
export function aiSettings(config: Config): AiSettings {
  return { ...defaultAiSettings, ...config.ai };
}

function numberEnv(env: NodeJS.ProcessEnv, name: string): number | undefined {
  const raw = env[name];
  if (raw === undefined || raw === '') return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0)
    throw new Error(`${name} must be a non-negative number`);
  return value;
}

/** AI_* environment overrides; unset variables keep the defaults. */
function aiFromEnv(env: NodeJS.ProcessEnv): Partial<AiSettings> {
  const entries: [keyof AiSettings, string | number | undefined][] = [
    ['modelPrimary', env.AI_MODEL_PRIMARY || undefined],
    ['modelFallback', env.AI_MODEL_FALLBACK || undefined],
    ['callTimeoutMs', numberEnv(env, 'AI_CALL_TIMEOUT_MS')],
    ['conversationTokenBudget', numberEnv(env, 'AI_CONVERSATION_TOKEN_BUDGET')],
    ['dailyTokenBudget', numberEnv(env, 'AI_DAILY_TOKEN_BUDGET')],
    ['maxToolRounds', numberEnv(env, 'AI_MAX_TOOL_ROUNDS')],
    ['maxOutputTokens', numberEnv(env, 'AI_MAX_OUTPUT_TOKENS')],
    ['messagesPerMinute', numberEnv(env, 'AI_MESSAGES_PER_MINUTE')],
    ['messagesPerDay', numberEnv(env, 'AI_MESSAGES_PER_DAY')],
    ['sqlRowCap', numberEnv(env, 'AI_SQL_ROW_CAP')],
    ['alertWindowMinutes', numberEnv(env, 'AI_ALERT_WINDOW_MINUTES')],
    ['alertErrorRate', numberEnv(env, 'AI_ALERT_ERROR_RATE')],
    ['alertFallbackRate', numberEnv(env, 'AI_ALERT_FALLBACK_RATE')],
    ['alertDailyTokens', numberEnv(env, 'AI_ALERT_DAILY_TOKENS')],
  ];
  return Object.fromEntries(entries.filter(([, value]) => value !== undefined));
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
    databaseUrlAi: env.DATABASE_URL_AI || undefined,
    anthropicApiKey: env.ANTHROPIC_API_KEY || undefined,
    metricsToken: env.METRICS_TOKEN || undefined,
    ai: aiFromEnv(env),
  };
}
