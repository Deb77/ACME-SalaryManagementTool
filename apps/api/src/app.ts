import { join } from 'node:path';
import express, { type Express } from 'express';
import type { HealthResponse } from '@acme/shared';

export interface AppOptions {
  /** Folder with the built web app. When set, the API also serves the UI from the same origin. */
  webDist?: string;
}

export function createApp({ webDist }: AppOptions = {}): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    const body: HealthResponse = { status: 'ok' };
    res.json(body);
  });

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: { code: 'not_found', message: 'Route not found' } });
  });

  if (webDist) {
    app.use(express.static(webDist));
    // Client-side routes (e.g. /employees/42) all load the app shell.
    app.get('/{*path}', (_req, res) => {
      res.sendFile(join(webDist, 'index.html'));
    });
  }

  return app;
}
