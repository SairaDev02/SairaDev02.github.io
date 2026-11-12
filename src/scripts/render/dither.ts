// Ordered dithering: light values in [0, 1] become one of four palette levels, chosen per
// pixel by an 8x8 Bayer threshold indexed by screen position. Quantizing is the last step
// of every frame, so the pattern stays anchored to the screen while the scene moves.

/** n x n Bayer matrix (n a power of two), thresholds centred in (0, 1). */
export function bayer(n: number): Float32Array {
  let m = [0];
  for (let s = 1; s < n; s *= 2) {
    const s2 = s * 2;
    const next = new Array<number>(s2 * s2);
    for (let y = 0; y < s; y++)
      for (let x = 0; x < s; x++) {
        const v = m[y * s + x] * 4;
        next[y * s2 + x] = v;
        next[y * s2 + x + s] = v + 2;
        next[(y + s) * s2 + x] = v + 3;
        next[(y + s) * s2 + x + s] = v + 1;
      }
    m = next;
  }
  return Float32Array.from(m, (b) => (b + 0.5) / (n * n));
}

const THRESHOLD = bayer(8);
const threshold = (i: number, W: number) => THRESHOLD[(((i / W) | 0) & 7) * 8 + ((i % W) & 7)];

/** '#rrggbb' as an opaque pixel for a little-endian Uint32 view of ImageData (ABGR). */
export function packRgb(hex: string): number {
  const n = parseInt(hex.trim().replace('#', ''), 16);
  return ((255 << 24) | ((n & 255) << 16) | (((n >> 8) & 255) << 8) | ((n >> 16) & 255)) >>> 0;
}

/** Four palette levels, darkest first. */
export type Palette = Uint32Array;

const level = (l: number, t: number) => {
  const q = Math.floor(l * 3 + t);
  return q < 0 ? 0 : q > 3 ? 3 : q;
};

export function quantize(L: Float32Array, out: Uint32Array, pal: Palette, W: number) {
  for (let i = 0; i < L.length; i++) out[i] = pal[level(L[i], threshold(i, W))];
}

/**
 * Like quantize, plus an emissive layer `Em` drawn in two light colours `light` ([mid,
 * core]). Emission dithers against the lit scene with the same matrix, so a glow fades
 * from the light colours into the four scene levels.
 */
export function quantizeEmissive(L: Float32Array, Em: Float32Array, out: Uint32Array, pal: Palette, light: Uint32Array, W: number) {
  for (let i = 0; i < L.length; i++) {
    const t = threshold(i, W);
    const e = Em[i];
    if (e > 0) {
      const k = Math.floor(e * 2 + t);
      if (k > 0) {
        out[i] = light[k > 1 ? 1 : 0];
        continue;
      }
    }
    out[i] = pal[level(L[i], t)];
  }
}
