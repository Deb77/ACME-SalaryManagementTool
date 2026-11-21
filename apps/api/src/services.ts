import { AuthService } from './auth/auth.service.js';
import { Argon2Hasher, type PasswordHasher } from './auth/password.js';
import type pg from 'pg';
import { aiSettings, type AiSettings, type Config } from './config.js';
import { createDb, type Db } from './db/database.js';
import { ScopedDb } from './db/scope.js';
import { systemClock, type Clock } from './lib/clock.js';
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
import { ImportRepository } from './modules/imports/import.repository.js';
import { ImportService } from './modules/imports/import.service.js';
import { InsightsService } from './modules/insights/insights.service.js';
import { CatalogueService } from './modules/meta/catalogue.service.js';
import { SalaryService } from './modules/salary/salary.service.js';
import { SalaryChangeRepository } from './modules/salary/salary.repository.js';

/** What tests may swap: a fixed clock, a quiet or captured logger, a scripted model. */
export interface ServiceOverrides {
  clock?: Clock;
  logger?: Logger;
  /** Null turns Ask AI off (it answers 503). */
  llmClient?: LlmClient | null;
}

/**
 * The composition root (decision #31): the only place that knows which implementation backs
 * each dependency. Services receive their collaborators through constructors and never import
 * the pool, the clock or each other's concrete instances. Plain constructor calls, in
 * dependency order.
 */
export function buildServices(config: Config, overrides: ServiceOverrides = {}) {
  const clock = overrides.clock ?? systemClock;
  const logger = overrides.logger ?? consoleLogger;
  const db: Db = createDb(config.databaseUrl, { max: config.dbPoolSize, role: 'acme_app' });
  const scopedDb = new ScopedDb(db);
  const passwordHasher: PasswordHasher = new Argon2Hasher();

  const auditService = new AuditService();
  const catalogueService = new CatalogueService(db);
  const employeeRepository = new EmployeeRepository();
  const salaryChangeRepository = new SalaryChangeRepository();
  const importRepository = new ImportRepository();
  const aiRepository = new AiRepository();

  const authService = new AuthService(db, passwordHasher, clock);
  const salaryService = new SalaryService(
    employeeRepository,
    auditService,
    clock,
    aiRepository,
    salaryChangeRepository,
  );
  const employeeService = new EmployeeService(
    scopedDb,
    employeeRepository,
    salaryService,
    auditService,
    catalogueService,
    clock,
  );
  const insightsService = new InsightsService(scopedDb, catalogueService);
  const roleService = new RoleService(db, scopedDb, auditService);
  const userService = new UserService(
    db,
    scopedDb,
    roleService,
    auditService,
    catalogueService,
    clock,
    config.appUrl,
  );
  const importService = new ImportService(
    scopedDb,
    employeeRepository,
    salaryService,
    auditService,
    catalogueService,
    clock,
    importRepository,
    salaryChangeRepository,
  );

  const settings: AiSettings = aiSettings(config);
  const llmClient: LlmClient | null =
    overrides.llmClient !== undefined
      ? overrides.llmClient
      : config.anthropicApiKey
        ? new AnthropicLlmClient(config.anthropicApiKey)
        : null;
  /** The acme_ai_reader pool (DATABASE_URL_AI); null when not configured. */
  const aiPool: pg.Pool | null = config.databaseUrlAi ? createAiPool(config.databaseUrlAi) : null;
  const sqlRunner = new SqlRunner(db, aiPool, {
    rowCap: settings.sqlRowCap,
    maxResultChars: settings.sqlResultMaxChars,
    statementTimeoutMs: settings.sqlStatementTimeoutMs,
  });
  const aiMetrics = new AiMetrics(settings, clock, logger);
  const askAiService = new AskAiService(
    scopedDb,
    aiRepository,
    llmClient,
    sqlRunner,
    aiMetrics,
    clock,
    logger,
    settings,
  );

  return {
    config,
    clock,
    logger,
    db,
    scopedDb,
    aiPool,
    aiSettings: settings,
    authService,
    catalogueService,
    auditService,
    employeeService,
    insightsService,
    importService,
    roleService,
    userService,
    aiMetrics,
    askAiService,
  };
}

export type AppServices = ReturnType<typeof buildServices>;
