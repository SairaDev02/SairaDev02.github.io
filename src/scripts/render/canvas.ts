// DOM plumbing for dithered canvases: palettes from CSS, whole-pixel scaling, and a
// frame loop capped at 30 fps that waits for the first input, slows down when frames are
// expensive, and pauses off screen and in hidden tabs.
import { packRgb, type Palette } from './dither';

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Reads colours from custom properties on `el`, e.g. ['--shade-0', ...]. */
export function readColours(el: Element, names: readonly string[]): Palette {
  const cs = getComputedStyle(el);
  return Uint32Array.from(names, (v) => packRgb(cs.getPropertyValue(v)));
}

/**
 * Sizes the canvas to the largest whole multiple of its grid that fits the container in
 * device pixels, so every grid pixel covers the same number of screen pixels.
 */
export function fitWholePixels(canvas: HTMLCanvasElement, container: HTMLElement, maxScale = 6): () => void {
  const fit = () => {
    const cs = getComputedStyle(container);
    // Content width minus the frame's 2px borders.
    const avail = container.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 4;
    if (avail <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    const s = Math.max(1, Math.min(maxScale, Math.floor((avail * dpr) / canvas.width)));
    canvas.style.width = `${(canvas.width * s) / dpr}px`;
  };
  const ro = new ResizeObserver(fit);
  ro.observe(container);
  // DPR changes (zoom, moving between screens) do not resize the container.
  addEventListener('resize', fit);
  fit();
  return () => {
    ro.disconnect();
    removeEventListener('resize', fit);
  };
}

/** Input that shows a person is on the page; the first one starts the animation. */
const WAKE_EVENTS = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'scroll', 'touchstart'] as const;
/** Frames are spaced at least this many times their own cost apart, so on a slow device
 * rendering takes at most half the main thread and input still gets through. */
const COST_SPACING = 2;

/**
 * Calls `frame(seconds, still)` while the canvas is on screen and the tab is visible: at
 * most `fps` times a second, and less often when frames are expensive.
 *
 * Until the first pointer, key, wheel, scroll or touch input it draws single still frames
 * only (on entering the screen and on `redraw()`), so loading the page costs one render
 * rather than a continuous loop. Under reduced motion it stays that way. `still` is true
 * for these single frames. `stop()` detaches everything.
 */
export function frameLoop(canvas: HTMLCanvasElement, frame: (t: number, still: boolean) => void, fps = 30) {
  let visible = false;
  let awake = false;
  let raf = 0;
  let last = 0;
  /** Smoothed cost of one frame, in ms. */
  let cost = 0;
  const run = (now: number) => {
    const t0 = performance.now();
    frame(now / 1000, !awake || reducedMotion());
    const d = performance.now() - t0;
    cost = cost ? 0.8 * cost + 0.2 * d : d;
  };
  const draw = () => run(performance.now());
  const tick = (now: number) => {
    raf = requestAnimationFrame(tick);
    if (now - last < Math.max(1000 / fps, COST_SPACING * cost) - 2) return;
    last = now;
    run(now);
  };
  const start = () => {
    if (!raf && awake && visible && !document.hidden && !reducedMotion()) raf = requestAnimationFrame(tick);
  };
  const pause = () => {
    cancelAnimationFrame(raf);
    raf = 0;
  };
  const unwatch = () => WAKE_EVENTS.forEach((e) => removeEventListener(e, wake, true));
  const wake = () => {
    awake = true;
    unwatch();
    start();
  };
  WAKE_EVENTS.forEach((e) => addEventListener(e, wake, { capture: true, passive: true }));
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) {
      draw();
      start();
    } else pause();
  });
  io.observe(canvas);
  const onVisibility = () => (document.hidden ? pause() : start());
  document.addEventListener('visibilitychange', onVisibility);
  return {
    redraw: draw,
    stop() {
      pause();
      unwatch();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    },
  };
}
