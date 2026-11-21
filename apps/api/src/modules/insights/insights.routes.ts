import { Router } from 'express';
import {
  catalogueIdSchema,
  insightsByTitleQuerySchema,
  salaryDistributionQuerySchema,
} from '@acme/shared';
import { notFound } from '../../lib/errors.js';
import { actorOf, requirePermission } from '../../lib/http.js';
import { parse } from '../../lib/validate.js';
import type { InsightsService } from './insights.service.js';

export function insightsRoutes(service: InsightsService): Router {
  const router = Router();
  router.use('/insights', requirePermission('insights:read'));

  router.get('/insights/overview', async (req, res) => {
    res.json(await service.overview(actorOf(req)));
  });

  router.get('/insights/by-title', async (req, res) => {
    const { country, department } = parse(insightsByTitleQuerySchema, req.query);
    res.json(await service.byTitle(actorOf(req), country, department));
  });

  router.get('/insights/titles/:jobTitleId', async (req, res) => {
    const id = catalogueIdSchema.safeParse(req.params.jobTitleId);
    if (!id.success) throw notFound('Job title not found');
    res.json(await service.titleComparison(actorOf(req), id.data));
  });

  router.get('/insights/distribution', async (req, res) => {
    const { country, jobTitle, buckets } = parse(salaryDistributionQuerySchema, req.query);
    res.json(await service.distribution(actorOf(req), country, jobTitle, buckets));
  });

  return router;
}
