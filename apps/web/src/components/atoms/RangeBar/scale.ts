/** Position of `value` on a 0–100% track between `min` and `max`, clamped. */
export function toPercent(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  const percent = ((value - min) / (max - min)) * 100;
  return Math.min(100, Math.max(0, percent));
}
