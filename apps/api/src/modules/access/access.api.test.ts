import request from 'supertest';
import { describe, expect, it } from 'vitest';
import {
  auditEventSchema,
  cursorPageSchema,
  inviteInfoSchema,
  inviteUserResponseSchema,
  meSchema,
  permissionCatalogueSchema,
  roleSchema,
  rolesResponseSchema,
  usersResponseSchema,
} from '@acme/shared';
import { ORIGIN, useTestApi } from '../../test/api.js';

/** The HTTP API for access management, against its own seeded Postgres with RLS on. */
const api = useTestApi();

describe('access management', () => {
  it('lists users and roles, and the permission catalogue', async () => {
    const users = usersResponseSchema.parse((await api.globalHr.get('/api/users')).body);
    expect(users.items.map((u) => u.email)).not.toContain('seed@acme.invalid');
    rolesResponseSchema.parse((await api.globalHr.get('/api/roles')).body);
    expect(
      permissionCatalogueSchema.parse((await api.globalHr.get('/api/permissions')).body).items,
    ).toHaveLength(11);
  });

  it('enforces permission dependencies and protects system roles', async () => {
    const missing = await api.send(api.globalHr, 'post', '/api/roles', {
      name: 'Broken',
      countryScope: 'all',
      permissions: ['ai:ask'],
    });
    expect(missing.status).toBe(400);

    const created = await api.send(api.globalHr, 'post', '/api/roles', {
      name: 'Finance viewer',
      countryScope: 'all',
      permissions: ['employees:read', 'insights:read'],
    });
    expect(created.status, created.text).toBe(201);
    const role = roleSchema.parse(created.body);
    expect(role.key).toBe('finance_viewer');

    const renamed = await api.send(api.globalHr, 'patch', `/api/roles/${role.id}`, {
      description: 'Read-only',
      version: role.version,
    });
    expect(roleSchema.parse(renamed.body).version).toBe(2);

    const roles = rolesResponseSchema.parse((await api.globalHr.get('/api/roles')).body).items;
    const globalRole = roles.find((r) => r.key === 'global_hr')!;
    expect(
      (
        await api.send(api.globalHr, 'patch', `/api/roles/${globalRole.id}`, {
          name: 'Boss',
          version: globalRole.version,
        })
      ).status,
    ).toBe(409);
    expect((await api.send(api.globalHr, 'delete', `/api/roles/${globalRole.id}`)).status).toBe(
      409,
    );
    expect((await api.send(api.globalHr, 'delete', `/api/roles/${role.id}`)).status).toBe(204);
  });

  it('invites a user who accepts and signs in, then deactivation ends their access', async () => {
    const roles = rolesResponseSchema.parse((await api.globalHr.get('/api/roles')).body).items;
    const countryHr = roles.find((r) => r.key === 'country_hr')!;
    const noCountries = await api.send(api.globalHr, 'post', '/api/users', {
      name: 'New HR',
      email: 'new.hr@acme.test',
      roleId: countryHr.id,
      countries: [],
    });
    expect(noCountries.status).toBe(400);

    const invited = await api.send(api.globalHr, 'post', '/api/users', {
      name: 'New HR',
      email: 'New.HR@acme.test',
      roleId: countryHr.id,
      countries: ['SG'],
    });
    expect(invited.status, invited.text).toBe(201);
    const { user, inviteUrl } = inviteUserResponseSchema.parse(invited.body);
    expect(user.status).toBe('invited');
    const token = new URL(inviteUrl).hash.replace('#token=', '');

    const info = inviteInfoSchema.parse(
      (await request(api.app).get(`/api/auth/invites/${token}`)).body,
    );
    expect(info).toEqual({ email: 'new.hr@acme.test', name: 'New HR', isReset: false });
    const weak = await request(api.app)
      .post('/api/auth/accept-invite')
      .set('Origin', ORIGIN)
      .send({ token, password: 'short' });
    expect(weak.status).toBe(400);

    const newHr = request.agent(api.app);
    const accepted = await newHr
      .post('/api/auth/accept-invite')
      .set('Origin', ORIGIN)
      .send({ token, password: 'a long enough password' });
    expect(accepted.status, accepted.text).toBe(200);
    expect(meSchema.parse(accepted.body).countries).toEqual(['SG']);
    expect((await request(api.app).get(`/api/auth/invites/${token}`)).status).toBe(404);
    expect((await newHr.get('/api/employees?pageSize=1')).status).toBe(200);

    const deactivated = await api.send(api.globalHr, 'post', `/api/users/${user.id}/deactivate`);
    expect(deactivated.body.status).toBe('deactivated');
    expect((await newHr.get('/api/auth/me')).status).toBe(401);

    const access = cursorPageSchema(auditEventSchema).parse(
      (await api.globalHr.get('/api/audit-events?entityType=user&limit=5')).body,
    );
    expect(access.items.map((a) => a.action)).toEqual(
      expect.arrayContaining(['user.deactivated', 'user.invited']),
    );
  });

  it('stops people from changing their own role or removing the last Global HR', async () => {
    const me = meSchema.parse((await api.globalHr.get('/api/auth/me')).body);
    const users = usersResponseSchema.parse((await api.globalHr.get('/api/users')).body).items;
    const self = users.find((u) => u.id === me.id)!;
    const roles = rolesResponseSchema.parse((await api.globalHr.get('/api/roles')).body).items;
    const countryHr = roles.find((r) => r.key === 'country_hr')!;
    expect(
      (
        await api.send(api.globalHr, 'patch', `/api/users/${self.id}`, {
          roleId: countryHr.id,
          countries: ['IN'],
          version: self.version,
        })
      ).status,
    ).toBe(409);
    expect((await api.send(api.globalHr, 'post', `/api/users/${self.id}/deactivate`)).status).toBe(
      409,
    );
  });
});
