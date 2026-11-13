import { describe, expect, it } from 'vitest';
import { HeightField } from './heightfield';

// A raised block with a bevel, so the light has slopes, shadows and specular to compute.
function scene(W: number, H: number) {
  const f = new HeightField(W, H);
  const mask = new Uint8Array(W * H);
  for (let y = 10; y < 30; y++) for (let x = 12; x < 40; x++) mask[y * W + x] = 1;
  f.raise(mask, 16, 6);
  for (let i = 0; i < W * H; i++) f.SP[i] = (i % 5) / 8;
  f.finalize();
  return f;
}

describe('HeightField.light', () => {
  it('lights only the requested rows, matching the whole-field result there', () => {
    const W = 64;
    const H = 48;
    const whole = scene(W, H);
    whole.light(20, 5, 90, { slices: 8 });
    const band = scene(W, H);
    band.L.fill(-1);
    band.light(20, 5, 90, { slices: 8 }, 16, 32);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        expect(band.L[i]).toBe(y >= 16 && y < 32 ? whole.L[i] : -1);
      }
  });
});
