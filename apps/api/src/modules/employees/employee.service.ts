import type {
  CreateEmployeeRequest,
  CreateSalaryChangeRequest,
  CreateSalaryChangeResponse,
  Employee,
  ExportEmployeesQuery,
  ListEmployeesQuery,
  TerminateEmployeeRequest,
  UpdateEmployeeRequest,
} from '@acme/shared';
import { canUseCountry, type Actor } from '../../auth/actor.js';
import type { Clock } from '../../lib/clock.js';
import type { ScopedDb, Tx } from '../../db/scope.js';
import { conflict, forbidden, invalid, notFound, staleVersion } from '../../lib/errors.js';
import { diff, type AuditService } from '../audit/audit.service.js';
import type { CatalogueService } from '../meta/catalogue.service.js';
import type { SalaryService } from '../salary/salary.service.js';
import { toEmployeeCsv } from './employee.csv.js';
import { toEmployee, type EmployeeRepository, type EmployeeRow } from './employee.repository.js';

const label = (e: Pick<EmployeeRow, 'employeeCode' | 'firstName' | 'lastName'>) =>
  `${e.employeeCode} ${e.firstName} ${e.lastName}`;

/** Business rules for employees. Each public method is one scoped transaction. */
export class EmployeeService {
  constructor(
    private readonly scoped: ScopedDb,
    private readonly repo: EmployeeRepository,
    private readonly salary: SalaryService,
    private readonly audit: AuditService,
    private readonly catalogue: CatalogueService,
    private readonly clock: Clock,
  ) {}

  async list(actor: Actor, query: ListEmployeesQuery) {
    await this.assertKnownFilters(query);
    return this.scoped.run(actor, async (tx) => {
      const { rows, total } = await this.repo.list(tx, query, {
        limit: query.pageSize,
        offset: (query.page - 1) * query.pageSize,
      });
      return { items: rows.map(toEmployee), page: query.page, pageSize: query.pageSize, total };
    });
  }

  get(actor: Actor, id: string): Promise<Employee> {
    return this.scoped.run(actor, async (tx) => toEmployee(await this.found(tx, id)));
  }

  /** A filter value that is not in the catalogue is a typo, not an empty result (400). */
  private async assertKnownFilters(query: ExportEmployeesQuery) {
    const catalogue = await this.catalogue.get();
    for (const code of query.country ?? []) catalogue.assertKnown('country', code);
    for (const id of query.department ?? []) catalogue.assertKnown('departmentId', id);
    for (const id of query.jobTitle ?? []) catalogue.assertKnown('jobTitleId', id);
  }

  /** v1 has no future-dated events: "current" salary and status are plain columns (api.md, open questions). */
  private notInFuture(field: string, date: string, what: string) {
    if (date > this.clock.today()) throw invalid(field, `${what} cannot be in the future yet`);
  }

  async create(actor: Actor, input: CreateEmployeeRequest): Promise<Employee> {
    this.notInFuture('hireDate', input.hireDate, 'The hire date');
    const catalogue = await this.catalogue.get();
    catalogue.assertKnown('country', input.country);
    catalogue.assertKnown('jobTitleId', input.jobTitleId);
    catalogue.assertKnown('departmentId', input.departmentId);
    // The country is the user's own input, so a wrong one is 403, not 404 (docs/api.md).
    if (!canUseCountry(actor, input.country)) {
      throw forbidden(`${input.country} is outside your countries`, [
        { path: 'country', message: 'Outside your countries' },
      ]);
    }
    return this.scoped.run(actor, async (tx) => {
      const row = await this.repo.insert(tx, {
        employeeCode: input.employeeCode ?? (await this.repo.nextCode(tx)),
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email.toLowerCase(),
        countryCode: input.country,
        jobTitleId: input.jobTitleId,
        departmentId: input.departmentId,
        hireDate: input.hireDate,
        salaryAmountMinor: input.salaryAmountMinor,
        salaryCurrency: catalogue.currencyOf(input.country),
        salaryEffectiveDate: input.hireDate,
      });
      await this.salary.recordFirst(tx, actor, row, 'hire');
      await this.audit.record(tx, actor, {
        action: 'employee.created',
        entityType: 'employee',
        entityId: row.id,
        entityLabel: label(row),
        country: row.countryCode,
        after: {
          employeeCode: row.employeeCode,
          firstName: row.firstName,
          lastName: row.lastName,
          email: row.email,
          country: row.countryCode,
          jobTitleId: row.jobTitleId,
          departmentId: row.departmentId,
          hireDate: row.hireDate,
          salaryAmountMinor: row.salaryAmountMinor,
        },
      });
      return toEmployee(await this.found(tx, row.id));
    });
  }

  async update(actor: Actor, id: string, input: UpdateEmployeeRequest): Promise<Employee> {
    const catalogue = await this.catalogue.get();
    if (input.jobTitleId) catalogue.assertKnown('jobTitleId', input.jobTitleId);
    if (input.departmentId) catalogue.assertKnown('departmentId', input.departmentId);
    return this.scoped.run(actor, async (tx) => {
      const { employee: before } = await this.found(tx, id, true);
      if (before.version !== input.version) throw staleVersion();
      if (before.status === 'terminated')
        throw conflict('This employee has left; their record is read-only');
      const patch = {
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email?.toLowerCase(),
        jobTitleId: input.jobTitleId,
        departmentId: input.departmentId,
        hireDate: input.hireDate,
      };
      if (patch.hireDate) {
        this.notInFuture('hireDate', patch.hireDate, 'The hire date');
        if (patch.hireDate > before.salaryEffectiveDate) {
          throw invalid(
            'hireDate',
            `Must be on or before the current salary's effective date (${before.salaryEffectiveDate})`,
          );
        }
      }
      const changes = diff(before as unknown as Record<string, unknown>, patch);
      if (!changes) return toEmployee(await this.found(tx, id));
      await this.repo.update(tx, id, changes.after);
      await this.audit.record(tx, actor, {
        action: 'employee.updated',
        entityType: 'employee',
        entityId: id,
        entityLabel: label(before),
        country: before.countryCode,
        before: changes.before,
        after: changes.after,
      });
      return toEmployee(await this.found(tx, id));
    });
  }

  terminate(actor: Actor, id: string, input: TerminateEmployeeRequest): Promise<Employee> {
    return this.scoped.run(actor, async (tx) => {
      const { employee: before } = await this.found(tx, id, true);
      if (before.version !== input.version) throw staleVersion();
      if (before.status === 'terminated') throw conflict('This employee has already left');
      this.notInFuture('terminationDate', input.terminationDate, 'The termination date');
      if (input.terminationDate < before.hireDate) {
        throw invalid('terminationDate', `Must be on or after the hire date (${before.hireDate})`);
      }
      await this.repo.update(tx, id, {
        status: 'terminated',
        terminationDate: input.terminationDate,
        terminationReason: input.reason,
        terminationNote: input.note || null,
      });
      await this.audit.record(tx, actor, {
        action: 'employee.terminated',
        entityType: 'employee',
        entityId: id,
        entityLabel: label(before),
        country: before.countryCode,
        before: { status: before.status },
        after: {
          status: 'terminated',
          terminationDate: input.terminationDate,
          terminationReason: input.reason,
          terminationNote: input.note || null,
        },
      });
      return toEmployee(await this.found(tx, id));
    });
  }

  salaryHistory(actor: Actor, id: string) {
    return this.scoped.run(actor, (tx) => this.salary.history(tx, id));
  }

  changeSalary(
    actor: Actor,
    id: string,
    input: CreateSalaryChangeRequest,
  ): Promise<CreateSalaryChangeResponse> {
    return this.scoped.run(actor, async (tx) => {
      const { salaryChange } = await this.salary.change(tx, actor, {
        employeeId: id,
        amountMinor: input.amountMinor,
        effectiveDate: input.effectiveDate,
        reason: input.reason,
        note: input.note || null,
        version: input.version,
        aiDraftId: input.aiDraftId ?? null,
      });
      return { salaryChange, employee: toEmployee(await this.found(tx, id)) };
    });
  }

  /** The filtered list as CSV, plus an `export.created` audit row with the filters used. */
  async exportCsv(
    actor: Actor,
    query: ExportEmployeesQuery,
    today: string,
  ): Promise<{ csv: string; rows: number }> {
    await this.assertKnownFilters(query);
    const catalogue = await this.catalogue.get();
    return this.scoped.run(actor, async (tx) => {
      const { rows } = await this.repo.list(tx, query);
      const csv = toEmployeeCsv(rows.map(toEmployee), (currency) =>
        catalogue.minorUnitsOf(currency),
      );
      await this.audit.record(tx, actor, {
        action: 'export.created',
        entityType: 'export',
        entityLabel: `Employee CSV, ${rows.length} rows (${today})`,
        country: null,
        details: {
          rows: rows.length,
          filters: {
            q: query.q ?? null,
            country: query.country ?? null,
            department: query.department ?? null,
            jobTitle: query.jobTitle ?? null,
            status: query.status,
            sort: `${query.sort.direction === 'desc' ? '-' : ''}${query.sort.field}`,
          },
        },
      });
      return { csv, rows: rows.length };
    });
  }

  private async found(tx: Tx, id: string, lock = false) {
    const row = await this.repo.get(tx, id, { lock });
    if (!row) throw notFound('Employee not found');
    return row;
  }
}
