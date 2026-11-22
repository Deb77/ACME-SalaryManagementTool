import { describe, expect, it } from 'vitest';
import {
  type Employee,
  employeeSchema,
  importSchema,
  importUploadResponseSchema,
  pageSchema,
  importRowSchema,
} from '@acme/shared';
import { ORIGIN, useTestApi } from '../../test/api.js';

/** The HTTP API for imports, against its own seeded Postgres with RLS on. */
const api = useTestApi();

describe('imports', () => {
  let sheets = 0;

  /**
   * A four-row sheet in someone's own layout: an update to `existing` (new title and pay), a
   * new hire, a row full of mistakes and a row for a country outside India HR's scope.
   */
  function aSheet(existing: Employee) {
    sheets += 1;
    const newHire = `neha.kapoor.import${sheets}@acme.test`;
    const csv = [
      'Emp ID,Name,Surname,E-mail,Role,Dept,Annual CTC,DOJ,Country',
      `${existing.employeeCode},${existing.firstName},${existing.lastName},${existing.email},Engineering Manager,${existing.department.name},"99,00,000",${existing.hireDate},IN`,
      `,Neha,Kapoor,${newHire},Data Analyst,Data,1600000,2026-11-03,IN`,
      ',Bad,Row,not-an-email,Nope,Data,abc,2026-13-01,IN',
      `,Tom,Smith,tom.smith.import${sheets}@acme.test,Data Analyst,Data,50000,2026-11-03,GB`,
    ].join('\n');
    return { csv, newHire };
  }

  async function upload(csv: string) {
    const res = await api.indiaHr
      .post('/api/imports')
      .set('Origin', ORIGIN)
      .attach('file', Buffer.from(csv), { filename: 'india.csv', contentType: 'text/csv' });
    expect(res.status, res.text).toBe(201);
    return importUploadResponseSchema.parse(res.body);
  }

  /** Hires someone to update, uploads a sheet and maps every column: a dry run to review. */
  async function dryRun() {
    const existing = await api.hire();
    const sheet = aSheet(existing);
    const uploaded = await upload(sheet.csv);
    const mapped = await api.send(api.indiaHr, 'put', `/api/imports/${uploaded.id}/mapping`, {
      mapping: {
        ...uploaded.suggestedMapping,
        jobTitle: 'Role',
        department: 'Dept',
        email: 'E-mail',
        country: 'Country',
      },
      defaults: { salaryEffectiveDate: '2026-11-03' },
    });
    expect(mapped.status, mapped.text).toBe(200);
    return {
      id: uploaded.id,
      existing,
      newHire: sheet.newHire,
      mapped: importSchema.parse(mapped.body),
    };
  }

  const commit = (id: string, skipInvalidRows = true) =>
    api.send(api.indiaHr, 'post', `/api/imports/${id}/commit`, { skipInvalidRows });
  const rows = async (id: string, outcome: string) =>
    pageSchema(importRowSchema).parse(
      (await api.indiaHr.get(`/api/imports/${id}/rows?outcome=${outcome}`)).body,
    ).items;
  const employee = async (id: string) =>
    employeeSchema.parse((await api.globalHr.get(`/api/employees/${id}`)).body);
  const peopleWithEmail = async (email: string) =>
    pageSchema(employeeSchema).parse((await api.globalHr.get(`/api/employees?q=${email}`)).body)
      .total;

  it('previews every row of an upload and suggests a mapping from the headers', async () => {
    const uploaded = await upload(aSheet(await api.hire()).csv);
    expect(uploaded.rowCount).toBe(4);
    expect(uploaded.sampleRows).toHaveLength(4);
    expect(uploaded.sampleRows[1]?.slice(0, 3)).toEqual(['', 'Neha', 'Kapoor']);
    expect(uploaded.suggestedMapping).toMatchObject({
      employeeCode: 'Emp ID',
      firstName: 'Name',
      lastName: 'Surname',
      salaryAmount: 'Annual CTC',
      hireDate: 'DOJ',
    });
  });

  it('sorts a dry run into creates, updates and errors without changing anyone', async () => {
    const { mapped, existing } = await dryRun();
    expect(mapped.summary).toEqual({ rows: 4, create: 1, update: 1, unchanged: 0, error: 2 });
    expect((await employee(existing.id)).jobTitle.id).toBe(existing.jobTitle.id);
  });

  it('names each reviewed row, and explains rows outside the uploader’s countries', async () => {
    const { id, existing } = await dryRun();
    const errors = await rows(id, 'error');
    expect(errors.map((r) => r.rowNumber)).toEqual([4, 5]);
    expect(errors.map((r) => r.employeeName)).toEqual(['Bad Row', 'Tom Smith']);
    expect(errors[1]!.errors[0]!.message).toMatch(/outside your countries/);
    expect((await rows(id, 'update'))[0]).toMatchObject({
      employeeCode: existing.employeeCode,
      employeeName: `${existing.firstName} ${existing.lastName}`,
      countryCode: 'IN',
    });
  });

  it('has no CSV error report: problems are reviewed in the app', async () => {
    const { id } = await dryRun();
    expect((await api.indiaHr.get(`/api/imports/${id}/rows.csv?outcome=error`)).status).toBe(404);
  });

  it('commits only once the invalid rows are confirmed as skipped', async () => {
    const { id } = await dryRun();
    expect((await commit(id, false)).status).toBe(400);
    const committed = await commit(id, true);
    expect(committed.status, committed.text).toBe(200);
    expect(importSchema.parse(committed.body).status).toBe('committed');
  });

  it('commits an import once', async () => {
    const { id } = await dryRun();
    await commit(id);
    expect((await commit(id)).status).toBe(409);
  });

  it('applies updates and creates new employees on commit', async () => {
    const { id, existing, newHire } = await dryRun();
    await commit(id);
    const updated = await employee(existing.id);
    expect(updated.jobTitle.id).toBe('engineering-manager');
    expect(updated.salary.amountMinor).toBe(990_000_000);
    expect(await peopleWithEmail(newHire)).toBe(1);
  });

  it('lets only the uploader undo; to anyone else the import is not there', async () => {
    const { id } = await dryRun();
    await commit(id);
    expect((await api.send(api.globalHr, 'post', `/api/imports/${id}/undo`)).status).toBe(404);
  });

  it('undo restores updated employees and removes the ones it created', async () => {
    const { id, existing, newHire } = await dryRun();
    await commit(id);
    const undone = await api.send(api.indiaHr, 'post', `/api/imports/${id}/undo`);
    expect(undone.status, undone.text).toBe(200);

    const restored = await employee(existing.id);
    expect(restored.jobTitle.id).toBe(existing.jobTitle.id);
    expect(restored.salary.amountMinor).toBe(existing.salary.amountMinor);
    expect(await peopleWithEmail(newHire)).toBe(0);
  });

  it('blocks undo once someone else changed an imported employee', async () => {
    const csv =
      'First name,Last name,Email,Country,Job title,Department,Hire date,Salary\nLina,Weber,lina.weber.import@acme.test,DE,Data Analyst,Data,2026-11-03,60000\n';
    const upload = importUploadResponseSchema.parse(
      (
        await api.globalHr
          .post('/api/imports')
          .set('Origin', ORIGIN)
          .attach('file', Buffer.from(csv), { filename: 'de.csv', contentType: 'text/csv' })
      ).body,
    );
    await api.send(api.globalHr, 'put', `/api/imports/${upload.id}/mapping`, {
      mapping: upload.suggestedMapping,
    });
    expect(
      (
        await api.send(api.globalHr, 'post', `/api/imports/${upload.id}/commit`, {
          skipInvalidRows: false,
        })
      ).status,
    ).toBe(200);
    const lina = pageSchema(employeeSchema).parse(
      (await api.globalHr.get('/api/employees?q=lina.weber.import')).body,
    ).items[0]!;
    await api.send(api.globalHr, 'patch', `/api/employees/${lina.id}`, {
      lastName: 'Weber-Schmidt',
      version: lina.version,
    });
    const blocked = await api.send(api.globalHr, 'post', `/api/imports/${upload.id}/undo`);
    expect(blocked.status).toBe(409);
  });

  it('has no template to download: people bring the sheet they already use', async () => {
    expect((await api.globalHr.get('/api/imports/template.xlsx')).status).toBe(404);
    expect((await api.globalHr.get('/api/imports/template.csv')).status).toBe(404);
  });
});
