/** Small layout helpers shared by stories. */
export const row = { display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' } as const;

export const grid = (min: number) =>
  ({
    display: 'grid',
    gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`,
    gap: 16,
  }) as const;
