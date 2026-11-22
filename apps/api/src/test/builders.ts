import type { CreateEmployeeRequest } from '@acme/shared';

let made = 0;

/**
 * A valid create-employee request, read as a sentence:
 * `anEmployee().inCountry('GB').titled('software-engineer', 'engineering').earning(6_500_000)`.
 * Defaults to an Indian data analyst hired on 2026-11-02; every builder gets a fresh email.
 */
export function anEmployee(): EmployeeBuilder {
  return new EmployeeBuilder();
}

export class EmployeeBuilder {
  private request: CreateEmployeeRequest;

  constructor() {
    made += 1;
    this.request = {
      firstName: 'Asha',
      lastName: 'Rao',
      email: `Asha.Rao.${made}@acme.test`,
      country: 'IN',
      jobTitleId: 'data-analyst',
      departmentId: 'data',
      hireDate: '2026-11-02',
      salaryAmountMinor: 180_000_000,
    };
  }

  named(firstName: string, lastName: string): this {
    this.request = { ...this.request, firstName, lastName };
    return this;
  }

  withEmail(email: string): this {
    this.request = { ...this.request, email };
    return this;
  }

  inCountry(country: string): this {
    this.request = { ...this.request, country };
    return this;
  }

  titled(jobTitleId: string, departmentId = this.request.departmentId): this {
    this.request = { ...this.request, jobTitleId, departmentId };
    return this;
  }

  hiredOn(hireDate: string): this {
    this.request = { ...this.request, hireDate };
    return this;
  }

  /** Annual pay in minor units of the country's currency. */
  earning(salaryAmountMinor: number): this {
    this.request = { ...this.request, salaryAmountMinor };
    return this;
  }

  build(): CreateEmployeeRequest {
    return { ...this.request };
  }
}
