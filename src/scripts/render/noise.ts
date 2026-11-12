// Seeded randomness and tileable cloud noise for the sky.

/** mulberry32: a small, fast seeded generator in [0, 1). */
export function rng(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const OCTAVES = [64, 32, 16, 8];

/**
 * Horizontally tileable fractal value noise in [0, 1], W x H. W must be a multiple of 64
 * so every octave's lattice wraps; scroll it by whole pixels to drift clouds.
 */
export function cloudNoise(W: number, H: number, seed: number): Float32Array {
  if (W % OCTAVES[0]) throw new Error(`cloudNoise: width ${W} is not a multiple of ${OCTAVES[0]}`);
  const rand = rng(seed);
  const out = new Float32Array(W * H);
  let amp = 0.5;
  let total = 0;
  for (const cell of OCTAVES) {
    const cx = W / cell;
    const cy = Math.ceil(H / cell) + 1;
    const lat = Float32Array.from({ length: cx * cy }, rand);
    for (let y = 0; y < H; y++) {
      const gy = y / cell;
      const y0 = Math.floor(gy);
      let fy = gy - y0;
      fy = fy * fy * (3 - 2 * fy);
      for (let x = 0; x < W; x++) {
        const gx = x / cell;
        const x0 = Math.floor(gx);
        let fx = gx - x0;
        fx = fx * fx * (3 - 2 * fx);
        const x1 = (x0 + 1) % cx;
        const a = lat[y0 * cx + x0] + (lat[y0 * cx + x1] - lat[y0 * cx + x0]) * fx;
        const b = lat[(y0 + 1) * cx + x0] + (lat[(y0 + 1) * cx + x1] - lat[(y0 + 1) * cx + x0]) * fx;
        out[y * W + x] += amp * (a + (b - a) * fy);
      }
    }
    total += amp;
    amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}
