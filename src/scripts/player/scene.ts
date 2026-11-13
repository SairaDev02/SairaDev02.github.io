// The CD player picture: one disc per repository lying in a drifting cloud sky, and a CD
// player with a tray, spindle, buttons, a display and an LED. Lit surfaces use the four
// blue levels; light sources (the pointer star, display digits, LED, sparkles) are
// emissive and drawn in the two yellow light colours.
//
// The scene owns disc positions and the drag gesture. What is hovered or loading comes
// from the player state each frame; the scene only reports when a load has arrived.
import type { PlayerSnapshot } from '../player-state';
import { quantizeEmissive, type Palette } from '../render/dither';
import { HeightField, sparkle } from '../render/heightfield';
import { PointerLight } from '../render/light';
import { Sky } from '../render/sky';
import { yieldToMain } from '../render/canvas';
import { textMask } from '../render/text-mask';
import { layoutDiscs, type Geometry } from './geometry';
import { LOAD } from './timing';

const WELL_Z = 5;
const BODY_Z = 16;
const CARRY_Z = 26;
const HOVER_Z = 7;
const LIGHT_Z = 90;

const ease = (k: number) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
const clamp01 = (k: number) => Math.min(1, Math.max(0, k));
const label = (i: number) => String(i + 1).padStart(2, '0');

interface Disc {
  /** Original slot. */
  ox: number;
  oy: number;
  /** Where it rests now (moves when dropped in the sky). */
  sx: number;
  sy: number;
  x: number;
  y: number;
  z: number;
  rot: number;
  /** Printed track number, disc-local, (2r + 1)^2. */
  mask: Uint8Array;
}

export interface Drag {
  i: number;
  offX: number;
  offY: number;
  moved: boolean;
  overTray: boolean;
}

export interface Colours {
  scene: Palette;
  light: Uint32Array;
}

export class CdScene {
  readonly image: ImageData;
  readonly r: number;
  drag: Drag | null = null;
  private readonly discs: Disc[];
  private readonly field: HeightField;
  private readonly Em: Float32Array;
  private readonly out: Uint32Array;
  private readonly sky: Sky;
  private readonly light: PointerLight;
  private readonly body: Uint8Array;
  private readonly base: { H: Float32Array; AL: Float32Array; AO: Float32Array; SP: Float32Array };
  private load: { i: number; t0: number; fx: number; fy: number; fz: number } | null = null;
  private t0 = -1;
  private last = 0;

  private constructor(
    readonly g: Geometry,
    private readonly colours: Colours,
    private readonly display: { idle: Uint8Array; numbers: Uint8Array[] },
    brand: Uint8Array,
    layout: { r: number; slots: [number, number][]; masks: Uint8Array[] },
  ) {
    const { W, H } = g;
    this.image = new ImageData(W, H);
    this.out = new Uint32Array(this.image.data.buffer);
    this.field = new HeightField(W, H);
    this.Em = new Float32Array(W * H);
    this.sky = new Sky(W, H);
    this.light = new PointerLight((t) => [W / 2 + 220 * Math.sin(t * 0.28), H / 2 - 20 + 55 * Math.cos(t * 0.5)]);
    this.body = this.buildPlayer(brand);
    const f = this.field;
    this.base = { H: f.H.slice(), AL: f.AL.slice(), AO: f.AO.slice(), SP: f.SP.slice() };
    this.r = layout.r;
    this.discs = layout.slots.map(([x, y], i) => ({ ox: x, oy: y, sx: x, sy: y, x, y, z: 0, rot: (i * 1.7) % (2 * Math.PI), mask: layout.masks[i] }));
  }

  /** Text masks need the pixel font loaded, so building is async. */
  static async build(g: Geometry, count: number, colours: Colours): Promise<CdScene> {
    const { W, H, display: d } = g;
    const digits = (text: string) => textMask(W, H, [{ text, x: (d.x0 + d.x1) / 2, y: (d.y0 + d.y1) / 2 + 1, size: 16, weight: 400 }]);
    const { r, slots } = layoutDiscs(count, g.discArea);
    const MW = 2 * r + 1;
    const [brand, idle, numbers, masks] = await Promise.all([
      textMask(W, H, [{ text: 'SAIRADEV02 · CD', x: g.brand[0], y: g.brand[1], size: 11, weight: 400, align: 'left' }]),
      digits('--'),
      Promise.all(slots.map((_, i) => digits(label(i)))),
      Promise.all(slots.map((_, i) => textMask(MW, MW, [{ text: label(i), x: r, y: r - (r + 9) / 2, size: r > 24 ? 13 : 10, weight: 700 }]))),
    ]);
    // The masks and the scene's own setup are each sizeable: run them as separate tasks.
    await yieldToMain();
    return new CdScene(g, colours, { idle, numbers }, brand, { r, slots, masks });
  }

  /** Static player: body, recessed tray with spindle, buttons, brand lettering. */
  private buildPlayer(brand: Uint8Array): Uint8Array {
    const { W, H, body: b, tray, buttons } = this.g;
    const f = this.field;
    const body = new Uint8Array(W * H);
    for (let y = b.y0; y < b.y1; y++) for (let x = b.x0; x < b.x1; x++) body[y * W + x] = 1;
    f.raise(body, BODY_Z, 6);
    for (let y = b.y0; y < b.y1; y++)
      for (let x = b.x0; x < b.x1; x++) {
        const p = y * W + x;
        const r = Math.hypot(x + 0.5 - tray.x, y + 0.5 - tray.y);
        f.AL[p] = brand[p] ? 0.2 : 0.62;
        f.SP[p] = 0.15;
        if (r < tray.r) {
          // Recessed well with a short slope at its lip; spindle in the centre.
          const lip = clamp01((r - (tray.r - 3)) / 3);
          f.H[p] = WELL_Z + (BODY_Z - WELL_Z) * lip;
          f.AL[p] = 0.38;
          if (r < 7) {
            f.H[p] = WELL_Z + 5 * Math.sqrt(1 - (r / 7) ** 2);
            f.AL[p] = 0.85;
            f.SP[p] = 0.6;
          }
        }
        for (const [bx, by] of buttons) {
          const d = Math.hypot(x + 0.5 - bx, y + 0.5 - by);
          if (d < 7) {
            f.H[p] = BODY_Z + 4 * Math.sqrt(1 - (d / 7) ** 2);
            f.AL[p] = 0.8;
            f.SP[p] = 0.4;
          }
        }
      }
    return body;
  }

  // ---------- queries and gestures (grid coordinates) ----------

  /** Topmost disc under the point, or -1. Later discs draw on top. */
  pick(x: number, y: number): number {
    for (let i = this.discs.length - 1; i >= 0; i--) if (Math.hypot(x - this.discs[i].x, y - this.discs[i].y) < this.r) return i;
    return -1;
  }

  aimLight(x: number, y: number) {
    this.light.aim(x, y);
  }

  private inTray(d: Disc) {
    const { tray } = this.g;
    return Math.hypot(d.x - tray.x, d.y - tray.y) < tray.r * 0.7;
  }

  private onBody(d: Disc) {
    const { body: b } = this.g;
    const r = this.r;
    return d.x + r > b.x0 && d.x - r < b.x1 && d.y + r > b.y0 && d.y - r < b.y1;
  }

  startDrag(i: number, x: number, y: number) {
    this.drag = { i, offX: x - this.discs[i].x, offY: y - this.discs[i].y, moved: false, overTray: false };
  }

  /** Moves the dragged disc; returns true when it entered or left the tray. */
  moveDrag(x: number, y: number): boolean {
    const drag = this.drag;
    if (!drag) return false;
    drag.moved = true;
    const d = this.discs[drag.i];
    const { W, H } = this.g;
    d.x = Math.min(W - this.r, Math.max(this.r, x - drag.offX));
    d.y = Math.min(H - this.r, Math.max(this.r, y - drag.offY));
    const over = this.inTray(d);
    if (over === drag.overTray) return false;
    drag.overTray = over;
    return true;
  }

  /**
   * Ends the drag. A click or a drop into the tray asks to load the disc. A drop in the
   * sky leaves it there; a drop on the player body, or a cancelled gesture, sends it back.
   */
  endDrag(cancelled: boolean): 'load' | 'drop' {
    const drag = this.drag;
    this.drag = null;
    if (!drag) return 'drop';
    const d = this.discs[drag.i];
    if (cancelled) {
      d.sx = d.ox;
      d.sy = d.oy;
    } else if (!drag.moved || this.inTray(d)) return 'load';
    else if (!this.onBody(d)) {
      d.sx = d.x;
      d.sy = d.y;
    }
    return 'drop';
  }

  // ---------- frame ----------

  /**
   * Renders one frame into `image`. `still` (reduced motion, or the still frames shown
   * before the first input) skips easing and the fade-in.
   * Returns true once a running load reaches the moment to navigate.
   */
  frame(t: number, s: PlayerSnapshot, still: boolean): boolean {
    const { W, H, tray, display: dsp, led } = this.g;
    const { field, Em, discs, drag } = this;
    if (this.t0 < 0) this.t0 = still ? -1e9 : t;
    const dt = Math.min(0.1, this.last ? t - this.last : 0);
    this.last = t;

    // Follow the player state into and out of a load.
    if (s.loading !== null && this.load?.i !== s.loading) {
      const d = discs[s.loading];
      this.drag = null;
      this.load = { i: s.loading, t0: t, fx: d.x, fy: d.y, fz: d.z };
    } else if (s.loading === null && this.load) {
      this.load = null; // restored from the back/forward cache: everything back home
      for (const d of discs) Object.assign(d, { sx: d.ox, sy: d.oy, x: d.ox, y: d.oy, z: 0 });
    }
    const load = this.load;
    const e = load ? t - load.t0 : -1;

    field.H.set(this.base.H);
    field.AL.set(this.base.AL);
    field.AO.set(this.base.AO);
    field.SP.set(this.base.SP);
    Em.fill(0);
    this.sky.paint(field.AL, this.body, t);
    this.light.step(t, still ? 1 : undefined);

    const k = (v: number) => (still ? 1 : v);
    discs.forEach((d, i) => {
      if (load?.i === i) this.poseLoading(d, load, e, dt);
      else if (drag?.i === i) d.z += ((drag.moved ? CARRY_Z : HOVER_Z) - d.z) * k(0.35);
      else {
        // Glide to the resting place; lift while hovered.
        d.x += (d.sx - d.x) * k(0.2);
        d.y += (d.sy - d.y) * k(0.2);
        d.z += ((i === s.hover && !load ? HOVER_Z : 0) - d.z) * k(0.3);
      }
    });
    // Resting discs first; the carried or dragged one last so it lies on top.
    const top = load?.i ?? drag?.i ?? -1;
    discs.forEach((d, i) => i !== top && this.drawDisc(d, i === s.hover));
    if (top >= 0) this.drawDisc(discs[top], true);

    field.finalize();
    field.light(this.light.x, this.light.y, LIGHT_Z, { K: 2.1, R2: 110000, slices: 8, ambGround: 0.42 });

    // Emissive layer: the pointer star, display digits, LED and sparkles.
    sparkle(Em, W, H, this.light.x, this.light.y, 1);
    const playing = load !== null && e >= LOAD.drop;
    const cue = playing ? load.i : drag?.overTray ? drag.i : s.hover;
    const shown = cue >= 0 ? this.display.numbers[cue] : this.display.idle;
    const glow = playing ? 1.4 : drag?.overTray ? 1.1 : cue >= 0 ? 0.8 : 0.45;
    for (let y = dsp.y0; y < dsp.y1; y++)
      for (let x = dsp.x0; x < dsp.x1; x++) {
        const p = y * W + x;
        field.L[p] = 0.06;
        if (shown[p]) Em[p] = glow;
      }
    // Power LED: steady when idle, blinking while a disc plays.
    if (!playing || Math.sin(t * 14) > 0) sparkle(Em, W, H, led[0], led[1], 0.22);
    if (s.hover >= 0 && !load && !drag?.moved) {
      const d = discs[s.hover];
      sparkle(Em, W, H, d.x + this.r * 0.6, d.y - this.r * 0.6, 0.45 + 0.08 * Math.sin(t * 4));
    }
    if (drag?.overTray || playing) sparkle(Em, W, H, tray.x + tray.r * 0.62, tray.y - tray.r * 0.62, 0.7 + 0.15 * Math.sin(t * 9));

    // Fade in over 0.7 s, ease-in, before quantizing.
    if (t - this.t0 < 0.7) {
      const f = ((t - this.t0) / 0.7) ** 2;
      for (let p = 0; p < field.L.length; p++) {
        field.L[p] *= f;
        Em[p] *= f;
      }
    }
    quantizeEmissive(field.L, Em, this.out, this.colours.scene, this.colours.light, W);
    return load !== null && e >= LOAD.go;
  }

  private poseLoading(d: Disc, load: { fx: number; fy: number; fz: number }, e: number, dt: number) {
    const { tray } = this.g;
    const { fx, fy, fz } = load;
    if (e < LOAD.lift) d.z = fz + (CARRY_Z - fz) * ease(e / LOAD.lift);
    else if (e < LOAD.travel) {
      const k = ease((e - LOAD.lift) / (LOAD.travel - LOAD.lift));
      d.x = fx + (tray.x - fx) * k;
      d.y = fy + (tray.y - fy) * k;
      d.z = CARRY_Z;
    } else if (e < LOAD.drop) {
      d.x = tray.x;
      d.y = tray.y;
      const k = (e - LOAD.travel) / (LOAD.drop - LOAD.travel);
      d.z = CARRY_Z + (WELL_Z - CARRY_Z) * k * k;
    } else {
      d.z = WELL_Z;
      d.rot += dt * 16 * clamp01((e - LOAD.drop) / (LOAD.spin - LOAD.drop));
    }
  }

  private drawDisc(d: Disc, lit: boolean) {
    const { W, H: GH } = this.g;
    const { H, AL, AO, SP } = this.field;
    const R = this.r;
    const MW = 2 * R + 1;
    const cr = Math.cos(d.rot);
    const sr = Math.sin(d.rot);
    const phi = Math.atan2(this.light.y - d.y, this.light.x - d.x);
    const ext = R + 10;
    const x0 = Math.max(0, Math.floor(d.x - ext));
    const x1 = Math.min(W - 1, Math.ceil(d.x + ext));
    const y0 = Math.max(0, Math.floor(d.y - ext));
    const y1 = Math.min(GH - 1, Math.ceil(d.y + ext));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const p = y * W + x;
        const dx = x + 0.5 - d.x;
        const dy = y + 0.5 - d.y;
        const r = Math.hypot(dx, dy);
        if (r >= R) {
          // Contact shadow on the ground while the disc lies flat.
          if (d.z < 3 && r < R + 10 && !this.body[p]) AO[p] = Math.max(AO[p], 0.26 * Math.exp(-(r - R) / 4));
          continue;
        }
        if (r < 4) continue; // centre hole
        const h = d.z + 3 * Math.min(1, (R - r) / 1.5);
        if (h <= H[p]) continue;
        H[p] = h;
        AO[p] = 0;
        if (r < 9) {
          AL[p] = 0.3; // clear hub
          SP[p] = 0.15;
        } else if (r > R - 1.2) {
          AL[p] = 0.78; // rim
          SP[p] = 0.3;
        } else {
          // Sheen: two bright wedges pointing at the light, plus faint grooves.
          let s = Math.cos(Math.atan2(dy, dx) - phi);
          s *= s;
          s *= s;
          s *= s;
          AL[p] = 0.4 + 0.52 * s + 0.04 * Math.sin(r * 2.6) + (lit ? 0.12 : 0);
          SP[p] = 0.6;
          const lx = Math.round(dx * cr + dy * sr + R);
          const ly = Math.round(-dx * sr + dy * cr + R);
          if (lx >= 0 && ly >= 0 && lx < MW && ly < MW && d.mask[ly * MW + lx]) AL[p] = 0.1;
        }
      }
  }
}
