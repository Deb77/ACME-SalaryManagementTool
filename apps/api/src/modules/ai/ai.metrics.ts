import type { AiMetrics as AiMetricsBody } from '@acme/shared';
import type { AiSettings } from '../../config.js';
import type { Clock } from '../../lib/clock.js';
import type { Logger } from '../../lib/http.js';

const LATENCY_BUCKETS_MS = [50, 100, 250, 500, 1000, 2500, 5000, 10000, 30000, 60000];

class Histogram {
  count = 0;
  sum = 0;
  readonly counts = LATENCY_BUCKETS_MS.map(() => 0);

  observe(value: number) {
    this.count += 1;
    this.sum += value;
    LATENCY_BUCKETS_MS.forEach((le, index) => {
      if (value <= le) this.counts[index]! += 1;
    });
  }

  toJson() {
    return {
      count: this.count,
      sum: this.sum,
      buckets: LATENCY_BUCKETS_MS.map((le, index) => ({ le, count: this.counts[index]! })),
    };
  }
}

/** What one finished Ask AI turn reports (also the `ai.turn` log line). */
export interface TurnRecord {
  ok: boolean;
  errorCode?: string;
  fallbackUsed: boolean;
  toolRounds: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  firstTokenMs: number | null;
  totalMs: number;
}

/**
 * In-process Ask AI metrics (decision #42): counters, latency histograms and a rolling window
 * for alert thresholds. One Render instance means one process, so no external store; restarts
 * reset the numbers (the logs keep the history). Served as JSON (`GET /api/ai/metrics`) and
 * Prometheus text (`GET /metrics` with METRICS_TOKEN).
 */
export class AiMetrics {
  private readonly since: Date;
  private readonly counters = new Map<string, number>();
  private readonly histograms = new Map<string, Histogram>();
  private window: { at: number; ok: boolean; fallback: boolean }[] = [];
  private tokensDay = '';
  private tokensToday = 0;
  private readonly alertedAt = new Map<string, number>();

  constructor(
    private readonly settings: AiSettings,
    private readonly clock: Clock,
    private readonly logger: Logger,
  ) {
    this.since = clock.now();
  }

  increment(name: string, by = 1) {
    this.counters.set(name, (this.counters.get(name) ?? 0) + by);
  }

  observe(name: string, value: number) {
    let histogram = this.histograms.get(name);
    if (!histogram) {
      histogram = new Histogram();
      this.histograms.set(name, histogram);
    }
    histogram.observe(value);
  }

  recordTurn(turn: TurnRecord) {
    this.increment('ai_turns_total');
    if (!turn.ok) {
      this.increment('ai_turn_errors_total');
      this.increment(`ai_errors_total{code="${turn.errorCode ?? 'unknown'}"}`);
    }
    if (turn.fallbackUsed) this.increment('ai_fallback_total');
    this.increment('ai_tool_rounds_total', turn.toolRounds);
    this.increment('ai_input_tokens_total', turn.inputTokens);
    this.increment('ai_output_tokens_total', turn.outputTokens);
    this.increment('ai_cache_read_tokens_total', turn.cacheReadTokens);
    this.increment('ai_cache_write_tokens_total', turn.cacheWriteTokens);
    this.observe('ai_turn_ms', turn.totalMs);
    if (turn.firstTokenMs !== null) this.observe('ai_first_token_ms', turn.firstTokenMs);

    const now = this.clock.now().getTime();
    this.window.push({ at: now, ok: turn.ok, fallback: turn.fallbackUsed });
    const today = this.clock.today();
    if (today !== this.tokensDay) {
      this.tokensDay = today;
      this.tokensToday = 0;
    }
    this.tokensToday +=
      turn.inputTokens + turn.outputTokens + turn.cacheReadTokens + turn.cacheWriteTokens;
    this.checkAlerts();
  }

  recordSqlRun(status: string, durationMs: number) {
    this.increment(`ai_sql_runs_total{status="${status}"}`);
    this.observe('ai_sql_run_ms', durationMs);
  }

  private windowStats() {
    const cutoff = this.clock.now().getTime() - this.settings.alertWindowMinutes * 60_000;
    this.window = this.window.filter((entry) => entry.at >= cutoff);
    const turns = this.window.length;
    const errors = this.window.filter((entry) => !entry.ok).length;
    const fallbacks = this.window.filter((entry) => entry.fallback).length;
    return {
      minutes: this.settings.alertWindowMinutes,
      turns,
      errorRate: turns ? errors / turns : 0,
      fallbackRate: turns ? fallbacks / turns : 0,
    };
  }

  /** Thresholds currently crossed. Rates need at least 5 turns in the window to mean anything. */
  alerts(): { name: string; message: string }[] {
    const stats = this.windowStats();
    const alerts: { name: string; message: string }[] = [];
    if (stats.turns >= 5 && stats.errorRate > this.settings.alertErrorRate) {
      alerts.push({
        name: 'error_rate',
        message: `${Math.round(stats.errorRate * 100)}% of Ask AI turns failed in the last ${stats.minutes} min`,
      });
    }
    if (stats.turns >= 5 && stats.fallbackRate > this.settings.alertFallbackRate) {
      alerts.push({
        name: 'fallback_rate',
        message: `${Math.round(stats.fallbackRate * 100)}% of Ask AI turns used the fallback model in the last ${stats.minutes} min`,
      });
    }
    if (this.tokensToday > this.settings.alertDailyTokens) {
      alerts.push({
        name: 'daily_tokens',
        message: `Ask AI used ${this.tokensToday} tokens today (threshold ${this.settings.alertDailyTokens})`,
      });
    }
    return alerts;
  }

  /** Logs each crossed threshold as an `ai.alert` warning, at most once per window. */
  private checkAlerts() {
    const now = this.clock.now().getTime();
    for (const alert of this.alerts()) {
      const last = this.alertedAt.get(alert.name);
      if (last !== undefined && now - last < this.settings.alertWindowMinutes * 60_000) continue;
      this.alertedAt.set(alert.name, now);
      this.increment(`ai_alerts_total{name="${alert.name}"}`);
      const detail = { alert: alert.name, detail: alert.message };
      if (this.logger.warn) this.logger.warn('ai.alert', detail);
      else this.logger.info('ai.alert', detail);
    }
  }

  snapshot(): AiMetricsBody {
    return {
      since: this.since.toISOString(),
      counters: Object.fromEntries(this.counters),
      histograms: Object.fromEntries(
        [...this.histograms].map(([name, histogram]) => [name, histogram.toJson()]),
      ),
      window: this.windowStats(),
      tokensToday: this.tokensDay === this.clock.today() ? this.tokensToday : 0,
      alerts: this.alerts(),
    };
  }

  /** Prometheus text exposition format. */
  prometheus(): string {
    const lines: string[] = [];
    const typed = new Set<string>();
    const type = (name: string, kind: string) => {
      const base = name.split('{')[0]!;
      if (!typed.has(base)) {
        typed.add(base);
        lines.push(`# TYPE acme_${base} ${kind}`);
      }
    };
    for (const [name, value] of [...this.counters].sort()) {
      type(name, 'counter');
      lines.push(`acme_${name} ${value}`);
    }
    for (const [name, histogram] of [...this.histograms].sort()) {
      type(name, 'histogram');
      LATENCY_BUCKETS_MS.forEach((le, index) =>
        lines.push(`acme_${name}_bucket{le="${le}"} ${histogram.counts[index]}`),
      );
      lines.push(`acme_${name}_bucket{le="+Inf"} ${histogram.count}`);
      lines.push(`acme_${name}_sum ${histogram.sum}`);
      lines.push(`acme_${name}_count ${histogram.count}`);
    }
    const stats = this.windowStats();
    lines.push(
      '# TYPE acme_ai_window_error_rate gauge',
      `acme_ai_window_error_rate ${stats.errorRate}`,
    );
    lines.push(
      '# TYPE acme_ai_window_fallback_rate gauge',
      `acme_ai_window_fallback_rate ${stats.fallbackRate}`,
    );
    return `${lines.join('\n')}\n`;
  }
}
