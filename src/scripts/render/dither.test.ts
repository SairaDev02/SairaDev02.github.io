import { describe, expect, it } from 'vitest';
import { bayer, packRgb, quantize, quantizeEmissive } from './dither';

describe('bayer', () => {
  it('builds the classic 2x2 matrix, centred in (0, 1)', () => {
    expect([...bayer(2)]).toEqual([0, 2, 3, 1].map((v) => (v + 0.5) / 4));
  });

  it('uses every 8x8 threshold exactly once', () => {
    const sorted = [...bayer(8)].sort((a, b) => a - b);
    expect(sorted).toEqual(Array.from({ length: 64 }, (_, k) => (k + 0.5) / 64));
  });
});

describe('packRgb', () => {
  it('packs a hex colour as opaque little-endian RGBA', () => {
    const px = new Uint32Array([packRgb('#123456')]);
    expect([...new Uint8Array(px.buffer)]).toEqual([0x12, 0x34, 0x56, 0xff]);
  });
});

const PAL = Uint32Array.from([10, 11, 12, 13]);
const SUN = Uint32Array.from([20, 21]);

describe('quantize', () => {
  it('maps black and white to the end levels whatever the threshold', () => {
    const W = 8;
    const out = new Uint32Array(64);
    quantize(new Float32Array(64).fill(0), out, PAL, W);
    expect(new Set(out)).toEqual(new Set([10]));
    quantize(new Float32Array(64).fill(1), out, PAL, W);
    expect(new Set(out)).toEqual(new Set([13]));
  });

  it('clamps out-of-range light', () => {
    const out = new Uint32Array(2);
    quantize(Float32Array.from([-2, 5]), out, PAL, 2);
    expect([...out]).toEqual([10, 13]);
  });

  it('dithers a mid grey between its two neighbouring levels in proportion', () => {
    // L = 0.5 sits halfway between level 1 (1/3) and level 2 (2/3).
    const out = new Uint32Array(64);
    quantize(new Float32Array(64).fill(0.5), out, PAL, 8);
    const counts = [...out].reduce<Record<number, number>>((c, v) => ((c[v] = (c[v] ?? 0) + 1), c), {});
    expect(counts).toEqual({ 11: 32, 12: 32 });
  });

  it('indexes the matrix by screen position, so the pattern tiles every 8 pixels', () => {
    const W = 16;
    const out = new Uint32Array(W * 8);
    quantize(new Float32Array(W * 8).fill(0.4), out, PAL, W);
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++) expect(out[y * W + x]).toBe(out[y * W + x + 8]);
  });
});

describe('quantizeEmissive', () => {
  it('draws strong emission in the core colour over any scene', () => {
    const out = new Uint32Array(64);
    quantizeEmissive(new Float32Array(64), new Float32Array(64).fill(1), out, PAL, SUN, 8);
    expect(new Set(out)).toEqual(new Set([21]));
  });

  it('leaves pixels without emission to the four scene levels', () => {
    const L = new Float32Array(64).fill(1);
    const a = new Uint32Array(64);
    const b = new Uint32Array(64);
    quantizeEmissive(L, new Float32Array(64), a, PAL, SUN, 8);
    quantize(L, b, PAL, 8);
    expect(a).toEqual(b);
  });

  it('fades weak emission into the scene through the dither', () => {
    const out = new Uint32Array(64);
    quantizeEmissive(new Float32Array(64), new Float32Array(64).fill(0.25), out, PAL, SUN, 8);
    const sun = [...out].filter((v) => v === 20).length;
    expect(sun).toBe(32); // half the thresholds lift 0.25 * 2 to the first light level
    expect([...out].filter((v) => v === 10).length).toBe(32);
  });
});
