// Where the sensor view's tags and card go, in the frame's CSS pixels. The scene projects
// the markers to `screen` positions each frame and asks this module to place the DOM marks
// beside them; nothing here touches three.js.
import type { Asset } from '../assets';

export type Point = { x: number; y: number };
export type Box = Point & { w: number; h: number };

const overlap = (a: Box, b: Box) =>
  Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

/** Gap between a marker and the tag or card beside it. */
const BESIDE = 14;

interface Marks {
  assets: readonly Asset[];
  /** One tag element per Asset, in Asset order. */
  tags: readonly HTMLElement[];
  card: HTMLElement;
  /** The corner readouts, which the card avoids. */
  readouts: readonly HTMLElement[];
  isOpened: (index: number) => boolean;
}

export function createPlacement({ assets, tags, card, readouts, isOpened }: Marks) {
  const tagAt: Point[] = assets.map(() => ({ x: 0, y: 0 }));
  // The card's chosen spot, by index into the candidate list; -1 picks afresh.
  let side = 0;

  /**
   * Tags follow their markers, nudged down where two would overlap, flipped at the edge.
   * `focus` is the previewed Asset's index, or -1.
   */
  const placeTags = (screen: readonly Point[], cw: number, focus: number) => {
    const placed: Point[] = [];
    [...screen.keys()]
      .sort((a, b) => screen[a].y - screen[b].y)
      .forEach((i) => {
        const opened = isOpened(i);
        const text = opened ? `${assets[i].tag} ↗` : assets[i].tag;
        if (tags[i].textContent !== text) tags[i].textContent = text;
        const tw = tags[i].offsetWidth || 44;
        let x = screen[i].x + BESIDE;
        let y = screen[i].y - 9;
        if (x + tw > cw) x = screen[i].x - BESIDE - tw;
        while (placed.some((p) => Math.abs(p.x - x) < tw + 2 && Math.abs(p.y - y) < 20)) y += 20;
        placed.push({ x, y });
        tagAt[i] = { x, y };
        tags[i].style.translate = `${x}px ${y}px`;
        tags[i].classList.toggle('is-sel', i === focus);
        tags[i].classList.toggle('is-opened', opened);
        tags[i].classList.add('is-placed');
      });
  };

  /** A newly previewed Asset picks the card's spot afresh. */
  const resetCard = () => {
    side = -1;
  };

  // The card goes beside its marker wherever (right, left, below, above) it hides the least
  // of the other tags, markers and corner readouts, inside the view. It keeps its spot
  // until another is clearly better (150 px2), so it doesn't flicker as the view turns.
  const placeCard = (screen: readonly Point[], cw: number, ch: number, focus: number): Box => {
    const p = screen[focus];
    const w = card.offsetWidth;
    const h = card.offsetHeight;
    const gap = 26;
    const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));
    const obstacles: Box[] = [
      { x: p.x - gap, y: p.y - gap, w: gap * 2, h: gap * 2 }, // its own marker and brackets
      ...readouts.filter((c) => c.offsetWidth).map((c) => ({ x: c.offsetLeft, y: c.offsetTop, w: c.offsetWidth, h: c.offsetHeight })),
    ];
    assets.forEach((_, i) => {
      if (i === focus) return;
      obstacles.push({ x: tagAt[i].x - 4, y: tagAt[i].y - 4, w: tags[i].offsetWidth + 8, h: tags[i].offsetHeight + 8 });
      obstacles.push({ x: screen[i].x - 10, y: screen[i].y - 10, w: 20, h: 20 });
    });
    // Every spot that still touches the marker, sliding along each side in small steps.
    // Level with the marker is preferred; each step away costs a little.
    const spots: (Point & { pen: number })[] = [];
    for (let dy = 12 - h; dy <= -12; dy += 6) {
      const pen = Math.abs(dy + 18);
      spots.push({ x: p.x + gap, y: p.y + dy, pen }, { x: p.x - gap - w, y: p.y + dy, pen: pen + 4 });
    }
    for (let dx = 20 - w; dx <= -20; dx += 10) {
      const pen = 60 + Math.abs(dx + w / 2) * 0.5;
      spots.push({ x: p.x + dx, y: p.y + gap, pen }, { x: p.x + dx, y: p.y - gap - h, pen: pen + 4 });
    }
    const boxes = spots.map((s) => ({ x: clamp(s.x, 8, cw - w - 8), y: clamp(s.y, 8, ch - h - 8), w, h }));
    const cost = boxes.map((b, k) => obstacles.reduce((sum, o, j) => sum + overlap(b, o) * (j === 0 ? 4 : 1), 0) + spots[k].pen);
    const best = cost.indexOf(Math.min(...cost));
    if (side < 0 || side >= cost.length || cost[best] < cost[side] - 150) side = best;
    return boxes[side];
  };

  /**
   * Where no card spot was clear, a tag under `box` (the card) moves to the other side of
   * its marker if that side is clear.
   */
  const clearOfCard = (box: Box, screen: readonly Point[], cw: number, focus: number) => {
    assets.forEach((_, i) => {
      if (i === focus) return;
      const t = { ...tagAt[i], w: tags[i].offsetWidth, h: tags[i].offsetHeight };
      if (!overlap(box, t)) return;
      const flipped = { ...t, x: tagAt[i].x > screen[i].x ? screen[i].x - BESIDE - t.w : screen[i].x + BESIDE };
      if (flipped.x >= 0 && flipped.x + t.w <= cw && !overlap(box, flipped)) tags[i].style.translate = `${flipped.x}px ${flipped.y}px`;
    });
  };

  return { placeTags, placeCard, clearOfCard, resetCard };
}
