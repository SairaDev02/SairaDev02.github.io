// Mounts the CD player picture: pointer gestures on the canvas (hover, click, drag and
// drop), the render loop, the LCD, and the switch between the wide and portrait grids.
import type { Track } from '../../lib/format';
import type { PlayerState } from '../player-state';
import { fitWholePixels, frameLoop, readColours, reducedMotion } from '../render/canvas';
import { NARROW, NARROW_QUERY, WIDE } from './geometry';
import { lcdView, mountLcd } from './lcd';
import { CdScene } from './scene';

/** CSS px of movement that turns a press into a drag. */
const DRAG_PX = 4;

export async function mountCdPlayer(root: HTMLElement, tracks: readonly Track[], player: PlayerState) {
  // `root` is the stage: its content width decides the canvas scale.
  const canvas = root.querySelector<HTMLCanvasElement>('canvas')!;
  const showLcd = mountLcd(root.querySelector<HTMLElement>('[data-lcd]')!);
  const ctx = canvas.getContext('2d')!;
  const colours = {
    scene: readColours(root, ['--shade-0', '--shade-1', '--shade-2', '--shade-3']),
    light: readColours(root, ['--sun', '--sun-core']),
  };

  const narrow = matchMedia(NARROW_QUERY);
  let scene: CdScene | null = null;
  let stopFit = () => {};
  let press: { id: number; x: number; y: number } | null = null;

  const updateLcd = () => showLcd(lcdView(player.get(), scene?.drag ?? null, tracks));
  const loop = frameLoop(canvas, (t) => {
    if (!scene) return;
    if (scene.frame(t, player.get(), reducedMotion())) player.arrive();
    ctx.putImageData(scene.image, 0, 0);
  });
  // Under reduced motion the loop draws only on demand.
  const redraw = () => reducedMotion() && loop.redraw();

  // Wide and portrait grids differ in size and layout, so a switch builds a new scene.
  const build = async () => {
    const g = narrow.matches ? NARROW : WIDE;
    const next = await CdScene.build(g, tracks.length, colours);
    if (g !== (narrow.matches ? NARROW : WIDE)) return; // switched again meanwhile
    stopFit();
    canvas.width = g.W;
    canvas.height = g.H;
    scene = next;
    press = null;
    stopFit = fitWholePixels(canvas, root);
    loop.redraw();
  };
  narrow.addEventListener('change', build);
  await build();

  player.subscribe((s, before) => {
    updateLcd();
    redraw();
    // A pick from the list or the dock may happen with the picture off screen, where
    // the loop pauses: bring the player into view to show the load.
    if (s.loading !== null && before.loading === null)
      canvas.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
  });
  updateLcd();

  // ---------- pointer ----------
  const toGrid = (e: { clientX: number; clientY: number }) => {
    const r = canvas.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * canvas.width, ((e.clientY - r.top) / r.height) * canvas.height] as const;
  };
  const busy = () => player.get().loading !== null;
  const setCursor = () => {
    canvas.style.cursor = scene?.drag?.moved ? 'grabbing' : player.get().hover >= 0 && !busy() ? 'grab' : '';
  };

  canvas.addEventListener('pointermove', (e) => {
    if (!scene) return;
    const [x, y] = toGrid(e);
    scene.aimLight(x, y);
    if (press && scene.drag) {
      if (!scene.drag.moved && Math.hypot(e.clientX - press.x, e.clientY - press.y) < DRAG_PX) return;
      if (scene.moveDrag(x, y)) updateLcd();
      setCursor();
      redraw();
    } else {
      player.hover(scene.pick(x, y));
      setCursor();
    }
  });
  canvas.addEventListener('pointerleave', () => {
    if (!scene?.drag) player.hover(-1);
  });
  canvas.addEventListener('pointerdown', (e) => {
    if (!scene || busy() || e.button !== 0) return;
    const [x, y] = toGrid(e);
    const i = scene.pick(x, y);
    if (i < 0) return;
    player.hover(i);
    canvas.setPointerCapture(e.pointerId);
    scene.startDrag(i, x, y);
    press = { id: e.pointerId, x: e.clientX, y: e.clientY };
  });
  const end = (e: PointerEvent, cancelled: boolean) => {
    if (!scene?.drag || press?.id !== e.pointerId) return;
    const i = scene.drag.i;
    press = null;
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    if (scene.endDrag(cancelled) === 'load') player.play(i);
    updateLcd();
    setCursor();
    redraw();
  };
  canvas.addEventListener('pointerup', (e) => end(e, false));
  canvas.addEventListener('pointercancel', (e) => end(e, true));
  // Touch: a press on a disc must drag it, not scroll the page. Elsewhere the canvas
  // keeps scrolling vertically (touch-action: pan-y).
  canvas.addEventListener(
    'touchstart',
    (e) => {
      const touch = e.touches[0];
      if (scene && touch && e.touches.length === 1 && scene.pick(...toGrid(touch)) >= 0) e.preventDefault();
    },
    { passive: false },
  );
}
