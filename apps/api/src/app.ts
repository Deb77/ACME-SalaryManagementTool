import { join } from 'node:path';
import express, { Router, type Express } from 'express';
import type { HealthResponse } from '@acme/shared';
import { authRoutes, loadSession } from './auth/auth.routes.js';
import type { AppServices } from './services.js';
import { notFound } from './lib/errors.js';
import { errorHandler, noStore, originCheck, securityHeaders, consoleLogger } from './lib/http.js';
import { accessRoutes } from './modules/access/access.routes.js';
import { aiRoutes, prometheusRoute } from './modules/ai/ai.routes.js';
import { auditRoutes } from './modules/audit/audit.routes.js';
import { employeeRoutes } from './modules/employees/employee.routes.js';
import { importRoutes } from './modules/imports/import.routes.js';
import { insightsRoutes } from './modules/insights/insights.routes.js';
import { metaRoutes } from './modules/meta/meta.routes.js';

export interface AppOptions {
  /** Folder with the built web app. When set, the API also serves the UI from the same origin. */
  webDist?: string;
  /** Every service. Without them, only health, 404s and the UI are served (tests). */
  services?: AppServices;
}

/** Routes that need the database, built from the services (decision #31). */
function apiRoutes(c: AppServices): Router {
  const config = c.config;
  const router = Router();
  router.use(originCheck(config.allowedOrigins));
  router.use(loadSession(c.authService, config));
  router.use('/auth', authRoutes(c.authService, config));
  router.use(
    metaRoutes(c.catalogueService),
    employeeRoutes(c.employeeService, c.clock),
    insightsRoutes(c.insightsService),
    importRoutes(c.importService),
    auditRoutes(c.scopedDb, c.auditService),
    accessRoutes(c.userService, c.roleService),
    aiRoutes(c.askAiService, c.aiMetrics, c.aiSettings),
  );
  return router;
}

export function createApp({ webDist, services }: AppOptions = {}): Express {
  const app = express();
  app.disable('x-powered-by');
  // Render terminates TLS in front of us: trust one proxy hop for the client IP and https.
  app.set('trust proxy', 1);
  app.use(securityHeaders);
  app.use('/api', noStore, express.json({ limit: '100kb' }));

  app.get('/api/health', async (_req, res) => {
    // Ask AI readiness without secrets: is a key set, does the reader pool connect.
    const body: HealthResponse = services
      ? { status: 'ok', ai: await services.askAiService.health() }
      : { status: 'ok' };
    res.json(body);
  });

  if (services) {
    app.get('/metrics', prometheusRoute(services.aiMetrics, services.config.metricsToken));
  }

  if (services) app.use('/api', apiRoutes(services));

  app.use('/api', () => {
    throw notFound('Route not found');
  });
  app.use('/api', errorHandler(services?.logger ?? consoleLogger));

  if (webDist) {
    app.use(express.static(webDist, { index: false, maxAge: '1h' }));
    // Client-side routes (e.g. /employees/42) all load the app shell.
    app.get('/{*path}', (_req, res) => {
      res.set('Cache-Control', 'no-cache');
      res.sendFile(join(webDist, 'index.html'));
    });
  }

  return app;
}
