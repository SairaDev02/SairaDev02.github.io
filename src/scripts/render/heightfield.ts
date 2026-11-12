// Lit height-field scenes for the dithered picture. Fill H (height), AL (albedo), AO
// (ambient occlusion) and SP (specular) per pixel, call finalize() for normals, then
// light() writes luminance into L. Shadows are hard, marched through a few height slices.

/** Two-pass chamfer distance from each pixel to the nearest pixel on the other side of `mask`. */
export function chamfer(mask: Uint8Array, W: number, H: number, inside: boolean): Float32Array {
  const INF = 1e6;
  const D = Math.SQRT2;
  const d = new Float32Array(W * H);
  for (let i = 0; i < d.length; i++) d[i] = (mask[i] === 1) === inside ? INF : 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (d[i] === 0) continue;
      let v = d[i];
      if (x > 0) v = Math.min(v, d[i - 1] + 1);
      if (y > 0) {
        v = Math.min(v, d[i - W] + 1);
        if (x > 0) v = Math.min(v, d[i - W - 1] + D);
        if (x < W - 1) v = Math.min(v, d[i - W + 1] + D);
      }
      d[i] = v;
    }
  for (let y = H - 1; y >= 0; y--)
    for (let x = W - 1; x >= 0; x--) {
      const i = y * W + x;
      if (d[i] === 0) continue;
      let v = d[i];
      if (x < W - 1) v = Math.min(v, d[i + 1] + 1);
      if (y < H - 1) {
        v = Math.min(v, d[i + W] + 1);
        if (x < W - 1) v = Math.min(v, d[i + W + 1] + D);
        if (x > 0) v = Math.min(v, d[i + W - 1] + D);
      }
      d[i] = v;
    }
  return d;
}

export interface LightOptions {
  /** Diffuse strength. */
  K?: number;
  /** Squared falloff radius. */
  R2?: number;
  /** Height slices marched for shadows. */
  slices?: number;
  ambGround?: number;
  ambRaised?: number;
}

export class HeightField {
  readonly H: Float32Array;
  readonly AL: Float32Array;
  readonly AO: Float32Array;
  readonly SP: Float32Array;
  readonly L: Float32Array;
  private readonly nx: Float32Array;
  private readonly ny: Float32Array;
  private readonly nz: Float32Array;
  private hmax = 0;

  constructor(
    readonly W: number,
    readonly Hh: number,
  ) {
    const n = W * Hh;
    this.H = new Float32Array(n);
    this.AL = new Float32Array(n).fill(0.55);
    this.AO = new Float32Array(n);
    this.SP = new Float32Array(n);
    this.L = new Float32Array(n);
    this.nx = new Float32Array(n);
    this.ny = new Float32Array(n);
    this.nz = new Float32Array(n);
  }

  /** Raises footprint pixels with a rounded bevel and darkens the ground around them. */
  raise(mask: Uint8Array, height: number, bevel = 7) {
    const { W, Hh } = this;
    const din = chamfer(mask, W, Hh, true);
    const dout = chamfer(mask, W, Hh, false);
    for (let i = 0; i < mask.length; i++) {
      if (mask[i]) {
        const u = Math.min(din[i], bevel) / bevel;
        this.H[i] = height * Math.sqrt(1 - (1 - u) * (1 - u));
      } else {
        this.AO[i] = Math.max(this.AO[i], 0.32 * Math.exp(-dout[i] / 5));
      }
    }
  }

  /** Normals from the height gradient. Call after every change to H. */
  finalize() {
    const { W, Hh, H } = this;
    this.hmax = 0;
    for (let y = 0; y < Hh; y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const gx = (H[y * W + Math.min(W - 1, x + 1)] - H[y * W + Math.max(0, x - 1)]) / 2;
        const gy = (H[Math.min(Hh - 1, y + 1) * W + x] - H[Math.max(0, y - 1) * W + x]) / 2;
        const len = Math.hypot(gx, gy, 1);
        this.nx[i] = -gx / len;
        this.ny[i] = -gy / len;
        this.nz[i] = 1 / len;
        if (H[i] > this.hmax) this.hmax = H[i];
      }
  }

  /** Point light at (LX, LY, LZ) in grid units; writes luminance to L. */
  light(LX: number, LY: number, LZ: number, o: LightOptions = {}) {
    const K = o.K ?? 2.7;
    const R2 = o.R2 ?? 52900;
    const S = o.slices ?? 4;
    const ag = o.ambGround ?? 0.1;
    const ar = o.ambRaised ?? 0.22;
    const { W, Hh, H, AL, AO, SP, nx, ny, nz, L, hmax } = this;
    for (let y = 0; y < Hh; y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const hp = H[i];
        const dx = LX - x;
        const dy = LY - y;
        const dz = LZ - hp;
        const dd = dx * dx + dy * dy + dz * dz;
        const inv = 1 / Math.sqrt(dd);
        const fall = 1 / (1 + dd / R2);
        const ndl = Math.max(0, (nx[i] * dx + ny[i] * dy + nz[i] * dz) * inv);
        // Hard shadow: march the pixel-to-light ray through S height slices.
        let sh = 0;
        if (dz > 0)
          for (let k = 1; k <= S; k++) {
            const h = (hmax * k) / S;
            if (h <= hp + 0.5 || h >= LZ) continue;
            const t = (h - hp) / dz;
            const sx = Math.round(x + t * dx);
            const sy = Math.round(y + t * dy);
            if (sx < 0 || sy < 0 || sx >= W || sy >= Hh) continue;
            const over = H[sy * W + sx] - h;
            if (over > 0) {
              const v = over >= 1.5 ? 1 : (over / 1.5) * (over / 1.5) * (3 - (2 * over) / 1.5);
              if (v > sh) sh = v;
              if (sh === 1) break;
            }
          }
        const amb = hp > 0.5 ? ar : ag;
        let l = AL[i] * (amb + K * ndl * fall * (1 - 0.88 * sh)) * (1 - AO[i]);
        if (SP[i] > 0 && sh < 0.5) {
          // Blinn half vector between the light direction and the view (0, 0, 1).
          const hx = dx * inv;
          const hy = dy * inv;
          const hz = dz * inv + 1;
          const hl = Math.hypot(hx, hy, hz);
          const nh = Math.max(0, (nx[i] * hx + ny[i] * hy + nz[i] * hz) / hl);
          l += SP[i] * Math.pow(nh, 28) * fall * 2.2;
        }
        L[i] = l;
      }
  }
}

/**
 * Adds a four-point star at (sx, sy) to an emissive layer: a bright core, two thin arms
 * and a wide halo that the dither fades through.
 */
export function sparkle(Em: Float32Array, W: number, H: number, sx: number, sy: number, size = 1) {
  const R = Math.ceil(26 * size);
  const x0 = Math.max(0, Math.floor(sx - R));
  const x1 = Math.min(W - 1, Math.ceil(sx + R));
  const y0 = Math.max(0, Math.floor(sy - R));
  const y1 = Math.min(H - 1, Math.ceil(sy + R));
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const dx = Math.abs(x - sx);
      const dy = Math.abs(y - sy);
      const r = Math.hypot(dx, dy);
      const arms = Math.exp(-dy / 0.7 - dx / (11 * size)) + Math.exp(-dx / 0.7 - dy / (11 * size));
      Em[y * W + x] += 1.4 * Math.exp(-r / (2.2 * size)) + 0.9 * arms + 0.35 * Math.exp(-r / (9 * size));
    }
}
