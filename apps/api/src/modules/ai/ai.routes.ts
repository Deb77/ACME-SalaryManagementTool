import { timingSafeEqual } from 'node:crypto';
import { Router, type RequestHandler, type Response } from 'express';
import { askAiRequestSchema, listAiSqlRunsQuerySchema, type AiStreamEvent } from '@acme/shared';
import type { AiSettings } from '../../config.js';
import { actorOf, requirePermission } from '../../lib/http.js';
import { idParam } from '../../lib/params.js';
import { rateLimit } from '../../lib/rate-limit.js';
import { parse } from '../../lib/validate.js';
import type { AiMetrics } from './ai.metrics.js';
import type { AiEventSink, AskAiService } from './ask-ai.service.js';

/**
 * Server-Sent Events with a late start: events wait in a buffer until the first one that is not
 * `conversation`, so a failure before the model says anything still gets the normal JSON error
 * envelope (429, 503) instead of a half-open stream.
 */
export class SseWriter implements AiEventSink {
  private buffer: AiStreamEvent[] = [];
  private open = false;

  constructor(private readonly res: Response) {}

  get started(): boolean {
    return this.open;
  }

  send(event: AiStreamEvent): void {
    if (this.res.writableEnded) return;
    if (!this.open && event.type === 'conversation') {
      this.buffer.push(event);
      return;
    }
    if (!this.open) {
      this.open = true;
      this.res.status(200).set({
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-store',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      this.res.flushHeaders();
      for (const queued of this.buffer) this.write(queued);
      this.buffer = [];
    }
    this.write(event);
  }

  end(): void {
    if (this.open && !this.res.writableEnded) this.res.end();
  }

  private write(event: AiStreamEvent) {
    this.res.write(`data: ${JSON.stringify(event)}\n\n`);
  }
}

export function aiRoutes(service: AskAiService, metrics: AiMetrics, settings: AiSettings): Router {
  const router = Router();
  const byUser = (req: Parameters<RequestHandler>[0]) => req.actor?.userId ?? req.ip ?? 'unknown';
  const onLimited = () => metrics.increment('ai_rate_limited_total');
  const perMinute = rateLimit({
    limit: settings.messagesPerMinute,
    windowMs: 60_000,
    key: byUser,
    message: 'Too many questions in a minute. Wait a moment and try again.',
    onLimited,
  });
  const perDay = rateLimit({
    limit: settings.messagesPerDay,
    windowMs: 24 * 60 * 60_000,
    key: byUser,
    message: 'You have asked the maximum number of questions for today. Try again tomorrow.',
    onLimited,
  });

  router.post('/ai/messages', requirePermission('ai:ask'), perMinute, perDay, async (req, res) => {
    const actor = actorOf(req);
    const body = parse(askAiRequestSchema, req.body);
    const abort = new AbortController();
    res.on('close', () => {
      if (!res.writableFinished) abort.abort();
    });
    const sse = new SseWriter(res);
    try {
      await service.ask(actor, body, sse, abort.signal);
    } finally {
      sse.end();
    }
  });

  router.get('/ai/conversations/:id', requirePermission('ai:ask'), async (req, res) => {
    res.json(await service.conversation(actorOf(req), idParam(req)));
  });

  // The run_sql audit log. RLS shows all-country roles every run, others their own.
  router.get('/ai/sql-runs', requirePermission('audit:read'), async (req, res) => {
    res.json(await service.listSqlRuns(actorOf(req), parse(listAiSqlRunsQuerySchema, req.query)));
  });

  // Usage across every user and country: administrators only.
  router.get('/ai/metrics', requirePermission('users:manage'), (_req, res) => {
    res.json(metrics.snapshot());
  });

  return router;
}

/**
 * `GET /metrics` in Prometheus text, for a scraper with `Authorization: Bearer $METRICS_TOKEN`.
 * Without a configured token the route answers 404, as if it did not exist.
 */
export function prometheusRoute(metrics: AiMetrics, token: string | undefined): RequestHandler {
  return (req, res, next) => {
    if (!token) return next();
    const given = Buffer.from(req.get('authorization') ?? '');
    const expected = Buffer.from(`Bearer ${token}`);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
      res.status(401).set('WWW-Authenticate', 'Bearer').type('text/plain').send('Unauthorized\n');
      return;
    }
    res.set({ 'Content-Type': 'text/plain; version=0.0.4', 'Cache-Control': 'no-store' });
    res.send(metrics.prometheus());
  };
}
