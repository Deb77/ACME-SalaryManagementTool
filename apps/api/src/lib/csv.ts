/**
 * One CSV cell. Quotes when needed, and prefixes cells that a spreadsheet would run as a
 * formula (`= + - @`, tab, carriage return) with `'` to stop CSV injection (OWASP).
 */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export const csvLine = (cells: (string | number | null | undefined)[]) =>
  cells.map(csvCell).join(',');

/** Minor units to a plain decimal string in major units: 180000000 (2 dp) → "1800000.00". */
export function formatMajor(amountMinor: number, minorUnits: number): string {
  if (minorUnits === 0) return String(amountMinor);
  const sign = amountMinor < 0 ? '-' : '';
  const abs = Math.abs(amountMinor);
  const factor = 10 ** minorUnits;
  return `${sign}${Math.trunc(abs / factor)}.${String(abs % factor).padStart(minorUnits, '0')}`;
}
