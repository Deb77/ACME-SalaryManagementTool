/** A small seeded random number generator (mulberry32), so the seed data is reproducible. */
export interface Random {
  /** A float in [0, 1). */
  next(): number;
  /** An integer in [min, max], inclusive. */
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  /** Picks a key with probability proportional to its weight. */
  weighted<K extends string>(weights: Readonly<Record<K, number>>): K;
  /** A normally distributed number (Box-Muller). */
  normal(mean: number, sd: number): number;
  /** A version 4 UUID built from this generator. */
  uuid(): string;
}

export function createRandom(seed: number): Random {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));

  return {
    next,
    int,
    pick: (items) => {
      if (items.length === 0) throw new Error('pick from an empty list');
      return items[int(0, items.length - 1)]!;
    },
    weighted: (weights) => {
      const entries = Object.entries(weights) as [keyof typeof weights, number][];
      const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
      let roll = next() * total;
      for (const [key, weight] of entries) {
        roll -= weight;
        if (roll < 0) return key;
      }
      return entries[entries.length - 1]![0];
    },
    normal: (mean, sd) => {
      const u = 1 - next();
      const v = next();
      return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
    uuid: () => {
      const hex = Array.from({ length: 32 }, () => int(0, 15).toString(16));
      hex[12] = '4';
      hex[16] = ((int(0, 15) & 0x3) | 0x8).toString(16);
      const s = hex.join('');
      return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
    },
  };
}
