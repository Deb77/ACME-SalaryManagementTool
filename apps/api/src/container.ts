import { AuthService } from './auth/auth.service.js';
import { Argon2Hasher, type PasswordHasher } from './auth/password.js';
import type pg from 'pg';
import { aiSettings, type AiSettings, type Config } from './config.js';
import { createDb, type Db } from './db/database.js';
import { ScopedDb } from './db/scope.js';
import { systemClock, type Clock } from './lib/clock.js';
import { Container } from './lib/container.js';
import { consoleLogger, type Logger } from './lib/http.js';
import { RoleService } from './modules/access/role.service.js';
import { AiMetrics } from './modules/ai/ai.metrics.js';
import { AiRepository } from './modules/ai/ai.repository.js';
import { AskAiService } from './modules/ai/ask-ai.service.js';
import { AnthropicLlmClient, type LlmClient } from './modules/ai/llm.js';
import { SqlRunner, createAiPool } from './modules/ai/sql-runner.js';
import { UserService } from './modules/access/user.service.js';
import { AuditService } from './modules/audit/audit.service.js';
import { EmployeeRepository } from './modules/employees/employee.repository.js';
import { EmployeeService } from './modules/employees/employee.service.js';
import { ImportService } from './modules/imports/import.service.js';
import { InsightsService } from './modules/insights/insights.service.js';
import { CatalogueService } from './modules/meta/catalogue.service.js';
import { SalaryService } from './modules/salary/salary.service.js';
import { SalaryChangeRepository } from './modules/salary/salary.repository.js';

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
  salaryChangeRepository: SalaryChangeRepository;
  salaryService: SalaryService;
  employeeService: EmployeeService;
  insightsService: InsightsService;
  roleService: RoleService;
  userService: UserService;
  importService: ImportService;
  aiSettings: AiSettings;
  /** Null without ANTHROPIC_API_KEY: Ask AI answers 503, everything else runs. */
  llmClient: LlmClient | null;
  /** The acme_ai_reader pool (DATABASE_URL_AI); null when not configured. */
  aiPool: pg.Pool | null;
  sqlRunner: SqlRunner;
  aiRepository: AiRepository;
  aiMetrics: AiMetrics;
  askAiService: AskAiService;
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
    .register('salaryChangeRepository', () => new SalaryChangeRepository())
    .register(
      'salaryService',
      (c) =>
        new SalaryService(
          c.resolve('employeeRepository'),
          c.resolve('auditService'),
          c.resolve('clock'),
          c.resolve('aiRepository'),
          c.resolve('salaryChangeRepository'),
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
    )
    .register('aiSettings', (c) => aiSettings(c.resolve('config')))
    .register('llmClient', (c) => {
      const key = c.resolve('config').anthropicApiKey;
      return key ? new AnthropicLlmClient(key) : null;
    })
    .register('aiPool', (c) => {
      const url = c.resolve('config').databaseUrlAi;
      return url ? createAiPool(url) : null;
    })
    .register(
      'sqlRunner',
      (c) =>
        new SqlRunner(c.resolve('db'), c.resolve('aiPool'), {
          rowCap: c.resolve('aiSettings').sqlRowCap,
          maxResultChars: c.resolve('aiSettings').sqlResultMaxChars,
          statementTimeoutMs: c.resolve('aiSettings').sqlStatementTimeoutMs,
        }),
    )
    .register('aiRepository', () => new AiRepository())
    .register(
      'aiMetrics',
      (c) => new AiMetrics(c.resolve('aiSettings'), c.resolve('clock'), c.resolve('logger')),
    )
    .register(
      'askAiService',
      (c) =>
        new AskAiService(
          c.resolve('scopedDb'),
          c.resolve('aiRepository'),
          c.resolve('llmClient'),
          c.resolve('sqlRunner'),
          c.resolve('aiMetrics'),
          c.resolve('clock'),
          c.resolve('logger'),
          c.resolve('aiSettings'),
        ),
    );
}
