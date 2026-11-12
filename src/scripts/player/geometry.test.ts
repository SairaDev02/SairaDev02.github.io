import { describe, expect, it } from 'vitest';
import { NARROW, WIDE, layoutDiscs } from './geometry';

describe('layoutDiscs', () => {
  for (const [name, g] of [
    ['wide', WIDE],
    ['narrow', NARROW],
  ] as const)
    it(`keeps 1 to 12 discs inside the ${name} disc area without overlaps`, () => {
      for (let n = 1; n <= 12; n++) {
        const { r, slots } = layoutDiscs(n, g.discArea);
        expect(slots).toHaveLength(n);
        for (const [x, y] of slots) {
          expect(x - r).toBeGreaterThanOrEqual(0);
          expect(x + r).toBeLessThanOrEqual(g.W);
          expect(y - r).toBeGreaterThanOrEqual(g.discArea.y0 - 8);
          expect(y + r).toBeLessThanOrEqual(g.H);
        }
        for (let a = 0; a < n; a++)
          for (let b = a + 1; b < n; b++)
            expect(Math.hypot(slots[a][0] - slots[b][0], slots[a][1] - slots[b][1])).toBeGreaterThanOrEqual(2 * r);
      }
    });
});
