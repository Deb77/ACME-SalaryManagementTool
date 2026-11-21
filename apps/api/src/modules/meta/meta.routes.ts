import { Router } from 'express';
import { requireAuth } from '../../lib/http.js';
import type { CatalogueService } from './catalogue.service.js';

export function metaRoutes(catalogue: CatalogueService): Router {
  const router = Router();
  router.get('/meta', requireAuth, async (req, res) => {
    const { meta, etag } = await catalogue.get();
    // The catalogue is not sensitive and only changes with a deploy: let the browser revalidate.
    res.set({ ETag: etag, 'Cache-Control': 'private, no-cache' });
    if (req.get('if-none-match') === etag) {
      res.status(304).end();
      return;
    }
    res.json(meta);
  });
  return router;
}
