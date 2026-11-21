import { Router } from 'express';
import multer from 'multer';
import {
  commitImportRequestSchema,
  importMappingRequestSchema,
  listImportRowsQuerySchema,
} from '@acme/shared';
import { invalid } from '../../lib/errors.js';
import { actorOf, requirePermission } from '../../lib/http.js';
import { idParam } from '../../lib/params.js';
import { parse } from '../../lib/validate.js';
import { MAX_FILE_BYTES } from './import.parser.js';
import type { ImportService } from './import.service.js';

export function importRoutes(service: ImportService): Router {
  const router = Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_BYTES, files: 1 },
  });
  router.use('/imports', requirePermission('imports:run'));

  router.post('/imports', upload.single('file'), async (req, res) => {
    if (!req.file) throw invalid('file', 'Attach an .xlsx or .csv file in the "file" field');
    // Browsers send multipart file names as latin1; restore UTF-8 names like "Bengaluru–Q4.xlsx".
    const originalname = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    const result = await service.upload(actorOf(req), { ...req.file, originalname });
    res.status(201).location(`/api/imports/${result.id}`).json(result);
  });

  router.get('/imports', async (req, res) => {
    res.json({ items: await service.list(actorOf(req)) });
  });
  router.get('/imports/:id', async (req, res) => {
    res.json(await service.get(actorOf(req), idParam(req)));
  });
  router.put('/imports/:id/mapping', async (req, res) => {
    const id = idParam(req);
    res.json(
      await service.setMapping(actorOf(req), id, parse(importMappingRequestSchema, req.body)),
    );
  });
  router.get('/imports/:id/rows', async (req, res) => {
    const id = idParam(req);
    const { outcome, page, pageSize } = parse(listImportRowsQuerySchema, req.query);
    res.json(await service.rows(actorOf(req), id, outcome, page, pageSize));
  });
  router.post('/imports/:id/commit', async (req, res) => {
    const id = idParam(req);
    res.json(
      await service.commit(actorOf(req), id, parse(commitImportRequestSchema, req.body ?? {})),
    );
  });
  router.post('/imports/:id/undo', async (req, res) => {
    res.json(await service.undo(actorOf(req), idParam(req)));
  });

  return router;
}
