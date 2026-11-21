import { describe, expect, it } from 'vitest';
import { csvCell, formatMajor } from './csv.js';

describe('csvCell', () => {
  it('neutralises cells a spreadsheet would run as a formula', () => {
    expect(csvCell('=1+1')).toBe("'=1+1");
    expect(csvCell('+44 20')).toBe("'+44 20");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
  });

  it('quotes commas, quotes and newlines', () => {
    expect(csvCell('Rao, Asha')).toBe('"Rao, Asha"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
  });

  it('leaves numbers alone, including negative ones', () => {
    expect(csvCell(-5)).toBe('-5');
    expect(csvCell(null)).toBe('');
  });
});

describe('formatMajor', () => {
  it('writes minor units as a plain decimal', () => {
    expect(formatMajor(180_000_000, 2)).toBe('1800000.00');
    expect(formatMajor(5, 2)).toBe('0.05');
    expect(formatMajor(1500, 0)).toBe('1500');
  });
});
