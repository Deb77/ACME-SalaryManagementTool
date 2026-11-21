import { Router } from 'express';
import {
  createRoleRequestSchema,
  inviteUserRequestSchema,
  updateRoleRequestSchema,
  updateUserRequestSchema,
} from '@acme/shared';
import { actorOf, requireAnyPermission, requirePermission } from '../../lib/http.js';
import { idParam } from '../../lib/params.js';
import { parse } from '../../lib/validate.js';
import type { RoleService } from './role.service.js';
import type { UserService } from './user.service.js';

export function accessRoutes(users: UserService, roles: RoleService): Router {
  const router = Router();
  const manageUsers = requirePermission('users:manage');
  const manageRoles = requirePermission('roles:manage');

  router.get('/users', manageUsers, async (_req, res) => {
    res.json({ items: await users.list() });
  });
  router.post('/users', manageUsers, async (req, res) => {
    const result = await users.invite(actorOf(req), parse(inviteUserRequestSchema, req.body));
    res.status(201).location(`/api/users/${result.user.id}`).json(result);
  });
  router.patch('/users/:id', manageUsers, async (req, res) => {
    const id = idParam(req);
    res.json(await users.update(actorOf(req), id, parse(updateUserRequestSchema, req.body)));
  });
  router.post('/users/:id/deactivate', manageUsers, async (req, res) => {
    res.json(await users.deactivate(actorOf(req), idParam(req)));
  });
  router.post('/users/:id/reactivate', manageUsers, async (req, res) => {
    res.json(await users.reactivate(actorOf(req), idParam(req)));
  });
  router.post('/users/:id/invite', manageUsers, async (req, res) => {
    res.json(await users.reissueInvite(actorOf(req), idParam(req)));
  });

  router.get('/permissions', manageRoles, async (_req, res) => {
    res.json({ items: await roles.catalogue() });
  });
  // Assigning a role needs the list, so either admin permission can read it.
  router.get('/roles', requireAnyPermission('users:manage', 'roles:manage'), async (_req, res) => {
    res.json({ items: await roles.list() });
  });
  router.post('/roles', manageRoles, async (req, res) => {
    const role = await roles.create(actorOf(req), parse(createRoleRequestSchema, req.body));
    res.status(201).location(`/api/roles/${role.id}`).json(role);
  });
  router.patch('/roles/:id', manageRoles, async (req, res) => {
    const id = idParam(req);
    res.json(await roles.update(actorOf(req), id, parse(updateRoleRequestSchema, req.body)));
  });
  router.delete('/roles/:id', manageRoles, async (req, res) => {
    await roles.remove(actorOf(req), idParam(req));
    res.status(204).end();
  });

  return router;
}
