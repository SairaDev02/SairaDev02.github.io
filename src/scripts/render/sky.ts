// Drifting cloud sky painted into a scene's albedo wherever nothing solid stands.
import { yieldToMain } from './canvas';
import { cloudNoise } from './noise';

const smooth = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export class Sky {
  private constructor(
    private readonly W: number,
    private readonly H: number,
    private readonly far: Float32Array,
    private readonly near: Float32Array,
  ) {}

  /** Each cloud layer is a sizeable computation, so they run as separate tasks. */
  static async build(W: number, H: number): Promise<Sky> {
    const far = cloudNoise(W, H, 7);
    await yieldToMain();
    return new Sky(W, H, far, cloudNoise(W, H, 23));
  }

  /**
   * Writes sky albedo into AL where `solid` is 0. Two cloud layers drift at different
   * whole-pixel speeds (parallax); the dither stays anchored to the screen, so the clouds
   * shimmer through it.
   */
  paint(AL: Float32Array, solid: Uint8Array, t: number) {
    const { W, H, far, near } = this;
    const o1 = Math.floor(t * 3) % W;
    const o2 = Math.floor(t * 7) % W;
    for (let y = 0; y < H; y++) {
      const base = 0.3 + 0.16 * (1 - y / H);
      for (let x = 0; x < W; x++) {
        const p = y * W + x;
        if (solid[p]) continue;
        const c = Math.max(smooth(0.5, 0.72, far[y * W + ((x + o1) % W)]), 0.85 * smooth(0.52, 0.74, near[y * W + ((x + o2) % W)]));
        AL[p] = base + 0.62 * c;
      }
    }
  }
}
