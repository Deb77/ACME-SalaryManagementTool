import { Router } from 'express';
import {
  createEmployeeRequestSchema,
  createSalaryChangeRequestSchema,
  exportEmployeesQuerySchema,
  listEmployeesQuerySchema,
  terminateEmployeeRequestSchema,
  updateEmployeeRequestSchema,
} from '@acme/shared';
import type { Clock } from '../../lib/clock.js';
import { actorOf, requirePermission } from '../../lib/http.js';
import { idParam } from '../../lib/params.js';
import { parse } from '../../lib/validate.js';
import type { EmployeeService } from './employee.service.js';

/** HTTP only: parse, call one service method, send. Errors go to the error middleware. */
export function employeeRoutes(service: EmployeeService, clock: Clock): Router {
  const router = Router();

  router.get('/employees', requirePermission('employees:read'), async (req, res) => {
    res.json(await service.list(actorOf(req), parse(listEmployeesQuerySchema, req.query)));
  });

  // Registered before `/employees/:id` so "export.csv" is not read as an id.
  router.get('/employees/export.csv', requirePermission('employees:export'), async (req, res) => {
    const query = parse(exportEmployeesQuerySchema, req.query);
    const today = clock.today();
    const { csv } = await service.exportCsv(actorOf(req), query, today);
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="employees-${today}.csv"`,
    });
    res.send(csv);
  });

  router.post('/employees', requirePermission('employees:write'), async (req, res) => {
    const employee = await service.create(
      actorOf(req),
      parse(createEmployeeRequestSchema, req.body),
    );
    res.status(201).location(`/api/employees/${employee.id}`).json(employee);
  });

  router.get('/employees/:id', requirePermission('employees:read'), async (req, res) => {
    res.json(await service.get(actorOf(req), idParam(req)));
  });

  router.patch('/employees/:id', requirePermission('employees:write'), async (req, res) => {
    const id = idParam(req);
    res.json(await service.update(actorOf(req), id, parse(updateEmployeeRequestSchema, req.body)));
  });

  router.post(
    '/employees/:id/terminate',
    requirePermission('employees:terminate'),
    async (req, res) => {
      const id = idParam(req);
      res.json(
        await service.terminate(actorOf(req), id, parse(terminateEmployeeRequestSchema, req.body)),
      );
    },
  );

  router.get(
    '/employees/:id/salary-changes',
    requirePermission('employees:read'),
    async (req, res) => {
      res.json({ items: await service.salaryHistory(actorOf(req), idParam(req)) });
    },
  );

  router.post(
    '/employees/:id/salary-changes',
    requirePermission('salary:change'),
    async (req, res) => {
      const id = idParam(req);
      const body = parse(createSalaryChangeRequestSchema, req.body);
      res.status(201).json(await service.changeSalary(actorOf(req), id, body));
    },
  );

  return router;
}
