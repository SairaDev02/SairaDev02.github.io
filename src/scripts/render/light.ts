// A point light that follows the pointer with smoothing and drifts along an automatic path
// after a few idle seconds.

const IDLE_S = 4;

export class PointerLight {
  x: number;
  y: number;
  private tx: number;
  private ty: number;
  private lastInput = -Infinity;

  constructor(private readonly path: (t: number) => readonly [number, number]) {
    [this.x, this.y] = path(0);
    [this.tx, this.ty] = [this.x, this.y];
  }

  /** Pointer position in grid units. */
  aim(x: number, y: number) {
    this.tx = x;
    this.ty = y;
    this.lastInput = performance.now() / 1000;
  }

  step(t: number, k = 0.14) {
    if (t - this.lastInput > IDLE_S) [this.tx, this.ty] = this.path(t);
    this.x += (this.tx - this.x) * k;
    this.y += (this.ty - this.y) * k;
  }
}
