import { describe, expect, it } from 'vitest';
import { safeNext } from './safeNext';

describe('safeNext', () => {
  it('keeps paths inside the app', () => {
    expect(safeNext('/employees?country=IN')).toBe('/employees?country=IN');
  });

  it('refuses other sites and empty values', () => {
    expect(safeNext('https://evil.test')).toBe('/');
    expect(safeNext('//evil.test')).toBe('/');
    expect(safeNext('/\\evil.test')).toBe('/');
    expect(safeNext(null)).toBe('/');
  });
});
