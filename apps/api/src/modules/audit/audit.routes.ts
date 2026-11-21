import { Router } from 'express';
import { listAuditEventsQuerySchema } from '@acme/shared';
import type { ScopedDb } from '../../db/scope.js';
import { actorOf, requirePermission } from '../../lib/http.js';
import { parse } from '../../lib/validate.js';
import type { AuditService } from './audit.service.js';

export function auditRoutes(scoped: ScopedDb, audit: AuditService): Router {
  const router = Router();
  router.get('/audit-events', requirePermission('audit:read'), async (req, res) => {
    const query = parse(listAuditEventsQuerySchema, req.query);
    res.json(await scoped.run(actorOf(req), (tx) => audit.list(tx, query)));
  });
  return router;
}
