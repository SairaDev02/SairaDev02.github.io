// DOM plumbing for dithered canvases: palettes from CSS, whole-pixel scaling, and a
// frame loop capped at 30 fps that pauses off screen and in hidden tabs.
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

/**
 * Calls `frame(seconds)` at most `fps` times a second while the canvas is on screen and
 * the tab is visible. Under reduced motion it draws single frames only: on entering the
 * screen and on `redraw()`. `stop()` detaches everything.
 */
export function frameLoop(canvas: HTMLCanvasElement, frame: (t: number) => void, fps = 30) {
  let visible = false;
  let raf = 0;
  let last = 0;
  const draw = () => frame(performance.now() / 1000);
  const tick = (now: number) => {
    raf = requestAnimationFrame(tick);
    if (now - last < 1000 / fps - 2) return;
    last = now;
    frame(now / 1000);
  };
  const start = () => {
    if (!raf && visible && !document.hidden && !reducedMotion()) raf = requestAnimationFrame(tick);
  };
  const pause = () => {
    cancelAnimationFrame(raf);
    raf = 0;
  };
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
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    },
  };
}
