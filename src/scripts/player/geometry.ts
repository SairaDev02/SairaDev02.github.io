// Layout of the CD player picture, in grid pixels. Two grids so the picture keeps
// whole-pixel scaling: wide (player right, discs left) and, on phones, a portrait grid
// (player on top, discs below). Grid widths are multiples of 64 for the cloud noise.

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface Geometry {
  W: number;
  H: number;
  /** Player body. */
  body: Rect;
  /** Tray well: centre and radius. */
  tray: { x: number; y: number; r: number };
  /** In-canvas display showing the track number. */
  display: Rect;
  led: readonly [number, number];
  buttons: readonly (readonly [number, number])[];
  /** Left end of the brand lettering, vertically centred. */
  brand: readonly [number, number];
  /** Where the discs rest. */
  discArea: Rect;
}

export const WIDE: Geometry = {
  W: 512,
  H: 224,
  body: { x0: 300, y0: 18, x1: 496, y1: 206 },
  tray: { x: 382, y: 112, r: 66 },
  display: { x0: 314, y0: 28, x1: 362, y1: 46 },
  led: [476, 36],
  buttons: [
    [474, 64],
    [474, 90],
    [474, 116],
  ],
  brand: [314, 192],
  discArea: { x0: 14, y0: 12, x1: 286, y1: 212 },
};

export const NARROW: Geometry = {
  W: 256,
  H: 320,
  body: { x0: 14, y0: 12, x1: 242, y1: 150 },
  tray: { x: 96, y: 81, r: 58 },
  display: { x0: 172, y0: 22, x1: 222, y1: 40 },
  led: [232, 31],
  buttons: [
    [222, 70],
    [222, 94],
    [222, 118],
  ],
  brand: [150, 138],
  discArea: { x0: 8, y0: 160, x1: 248, y1: 316 },
};

/** Phones get the portrait grid. Keep in step with the CSS breakpoint in CdPlayer.astro. */
export const NARROW_QUERY = '(max-width: 600px)';

export interface DiscLayout {
  /** Disc radius. */
  r: number;
  /** Resting centre of each disc. */
  slots: [number, number][];
}

/** Two rows up to eight discs, else three; alternate rows are nudged for a loose look. */
export function layoutDiscs(n: number, area: Rect): DiscLayout {
  const rows = n <= 8 ? Math.min(2, Math.max(1, n)) : 3;
  const cols = Math.max(1, Math.ceil(n / rows));
  const cellW = (area.x1 - area.x0) / cols;
  const cellH = (area.y1 - area.y0) / rows;
  const r = Math.max(14, Math.min(32, Math.floor(Math.min(cellW, cellH) / 2) - 8));
  const slots = Array.from({ length: n }, (_, i): [number, number] => {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const nudge = (row % 2 ? 1 : -1) * cellW * 0.12;
    return [area.x0 + (col + 0.5) * cellW + nudge, area.y0 + (row + 0.5) * cellH];
  });
  return { r, slots };
}
