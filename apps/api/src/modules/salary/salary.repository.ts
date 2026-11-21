import { desc, eq } from 'drizzle-orm';
import type { Tx } from '../../db/scope.js';
import { salaryChanges, users } from '../../db/schema/index.js';

export type SalaryChangeRow = typeof salaryChanges.$inferSelect;
export type NewSalaryChangeRow = typeof salaryChanges.$inferInsert;

/** Pay history rows. Append-only: nothing here updates or deletes a change. */
export class SalaryChangeRepository {
  /** An employee's changes, newest first, with who made each one. */
  async history(tx: Tx, employeeId: string) {
    return tx
      .select({ change: salaryChanges, byId: users.id, byName: users.name })
      .from(salaryChanges)
      .innerJoin(users, eq(users.id, salaryChanges.createdBy))
      .where(eq(salaryChanges.employeeId, employeeId))
      .orderBy(desc(salaryChanges.effectiveDate), desc(salaryChanges.createdAt));
  }

  async insert(tx: Tx, values: NewSalaryChangeRow): Promise<SalaryChangeRow> {
    const [row] = await tx.insert(salaryChanges).values(values).returning();
    return row!;
  }
}
