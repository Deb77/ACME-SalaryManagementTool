/**
 * Which fake user the mock API is signed in as. The browser entry point reads `?as=` and
 * sessionStorage; tests call `setMockUser` directly. Pure module: no `window` access here.
 */
import type { Me } from '@acme/shared';
import { sampleMeCountry, sampleMeGlobal, sampleMeViewer } from '../stories/screenSampleData';

export const mockUserKeys = ['global_hr', 'country_hr', 'readonly'] as const;
export type MockUserKey = (typeof mockUserKeys)[number];

export const mockUsers: Record<MockUserKey, Me> = {
  global_hr: sampleMeGlobal,
  country_hr: sampleMeCountry,
  readonly: sampleMeViewer,
};

export const mockUserLabels: Record<MockUserKey, string> = {
  global_hr: 'Global HR',
  country_hr: 'Country HR (India)',
  readonly: 'Read-only',
};

export const DEFAULT_MOCK_USER: MockUserKey = 'global_hr';

let current: MockUserKey = DEFAULT_MOCK_USER;

export function isMockUserKey(value: unknown): value is MockUserKey {
  return typeof value === 'string' && (mockUserKeys as readonly string[]).includes(value);
}

export function setMockUser(key: MockUserKey) {
  current = key;
}

export function getMockUserKey(): MockUserKey {
  return current;
}

export function currentMe(): Me {
  return mockUsers[current];
}
