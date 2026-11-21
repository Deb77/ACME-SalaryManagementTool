import { AuthService } from './auth/auth.service.js';
import { Argon2Hasher, type PasswordHasher } from './auth/password.js';
import type { Config } from './config.js';
import { createDb, type Db } from './db/database.js';
import { ScopedDb } from './db/scope.js';
import { systemClock, type Clock } from './lib/clock.js';
import { Container } from './lib/container.js';
import { consoleLogger, type Logger } from './lib/http.js';
import { RoleService } from './modules/access/role.service.js';
import { UserService } from './modules/access/user.service.js';
import { AuditService } from './modules/audit/audit.service.js';
import { EmployeeRepository } from './modules/employees/employee.repository.js';
import { EmployeeService } from './modules/employees/employee.service.js';
import { ImportService } from './modules/imports/import.service.js';
import { InsightsService } from './modules/insights/insights.service.js';
import { CatalogueService } from './modules/meta/catalogue.service.js';
import { SalaryService } from './modules/salary/salary.service.js';

/** Everything the app resolves by name. Adding a service means one line here and one below. */
export interface Registry {
  config: Config;
  clock: Clock;
  logger: Logger;
  db: Db;
  scopedDb: ScopedDb;
  passwordHasher: PasswordHasher;
  authService: AuthService;
  catalogueService: CatalogueService;
  auditService: AuditService;
  employeeRepository: EmployeeRepository;
  salaryService: SalaryService;
  employeeService: EmployeeService;
  insightsService: InsightsService;
  roleService: RoleService;
  userService: UserService;
  importService: ImportService;
}

export type AppContainer = Container<Registry>;

/**
 * The composition root (decision #31): the only place that knows which implementation backs
 * each dependency. Services receive their collaborators through constructors and never import
 * the pool, the clock or each other's concrete instances.
 */
export function buildContainer(config: Config): AppContainer {
  return new Container<Registry>()
    .register('config', () => config)
    .register('clock', () => systemClock)
    .register('logger', () => consoleLogger)
    .register('db', (c) =>
      createDb(c.resolve('config').databaseUrl, {
        max: c.resolve('config').dbPoolSize,
        role: 'acme_app',
      }),
    )
    .register('scopedDb', (c) => new ScopedDb(c.resolve('db')))
    .register('passwordHasher', () => new Argon2Hasher())
    .register(
      'authService',
      (c) => new AuthService(c.resolve('db'), c.resolve('passwordHasher'), c.resolve('clock')),
    )
    .register('catalogueService', (c) => new CatalogueService(c.resolve('db')))
    .register('auditService', () => new AuditService())
    .register('employeeRepository', () => new EmployeeRepository())
    .register(
      'salaryService',
      (c) =>
        new SalaryService(
          c.resolve('employeeRepository'),
          c.resolve('auditService'),
          c.resolve('clock'),
        ),
    )
    .register(
      'employeeService',
      (c) =>
        new EmployeeService(
          c.resolve('scopedDb'),
          c.resolve('employeeRepository'),
          c.resolve('salaryService'),
          c.resolve('auditService'),
          c.resolve('catalogueService'),
          c.resolve('clock'),
        ),
    )
    .register(
      'insightsService',
      (c) => new InsightsService(c.resolve('scopedDb'), c.resolve('catalogueService')),
    )
    .register(
      'roleService',
      (c) => new RoleService(c.resolve('db'), c.resolve('scopedDb'), c.resolve('auditService')),
    )
    .register(
      'userService',
      (c) =>
        new UserService(
          c.resolve('db'),
          c.resolve('scopedDb'),
          c.resolve('roleService'),
          c.resolve('auditService'),
          c.resolve('catalogueService'),
          c.resolve('clock'),
          c.resolve('config').appUrl,
        ),
    )
    .register(
      'importService',
      (c) =>
        new ImportService(
          c.resolve('scopedDb'),
          c.resolve('employeeRepository'),
          c.resolve('salaryService'),
          c.resolve('auditService'),
          c.resolve('catalogueService'),
          c.resolve('clock'),
        ),
    );
}
