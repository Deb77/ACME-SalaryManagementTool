/** Tunables for the mock API: the browser adds latency so loading states show; tests use 0. */
export const mockConfig = {
  /** Delay before every JSON response. */
  latencyMs: 0,
  /** Gap between Ask AI stream events. */
  streamGapMs: 0,
};

export function configureMockApi(overrides: Partial<typeof mockConfig>) {
  Object.assign(mockConfig, overrides);
}
