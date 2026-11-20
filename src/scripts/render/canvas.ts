// DOM plumbing for dithered canvases: palettes from CSS, whole-pixel sizing, and a frame
// loop capped at 30 fps that waits for the first input, slows down when frames are
// expensive, and pauses off screen and in hidden tabs.
import { packRgb, type Palette } from './dither';

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Reads colours from custom properties on `el`, e.g. ['--shade-0', ...]. */
export function readColours(el: Element, names: readonly string[]): Palette {
  const cs = getComputedStyle(el);
  return Uint32Array.from(names, (v) => packRgb(cs.getPropertyValue(v)));
}

/**
 * Shows a canvas holding a `w` x `h` grid at `k` device pixels per grid pixel: its CSS
 * box is a whole number of device pixels, whatever the device pixel ratio `dpr`.
 */
export function sizeToGrid(canvas: HTMLCanvasElement, w: number, h: number, k: number, dpr: number) {
  canvas.style.width = `${(w * k) / dpr}px`;
  canvas.style.height = `${(h * k) / dpr}px`;
}

/**
 * Lets the browser handle pending input and paint before the caller continues, so a long
 * stretch of setup runs as several short tasks. Uses scheduler.yield() where available.
 */
export function yieldToMain(): Promise<void> {
  const scheduler = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  return scheduler?.yield ? scheduler.yield() : new Promise((resolve) => setTimeout(resolve, 0));
}

/** Input that shows a person is on the page; the first one starts the animation. */
const WAKE_EVENTS = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'scroll', 'touchstart'] as const;
/** Frames are spaced at least this many times their own cost apart, so on a slow device
 * rendering takes at most half the main thread and input still gets through. */
const COST_SPACING = 2;

/**
 * One frame as a sequence of steps. The loop yields to the main thread between steps, so
 * input and rendering get through during a frame that is long on a slow device.
 */
export type FrameSteps = Iterator<unknown, unknown>;

/**
 * Calls `frame(seconds, still)` while the canvas is on screen and the tab is visible: at
 * most `fps` times a second, and less often when frames are expensive. It runs the
 * returned steps, if any, to the end before starting another frame.
 *
 * Until the first pointer, key, wheel, scroll or touch input it draws single still frames
 * only (on entering the screen and on `redraw()`), so loading the page costs one render
 * rather than a continuous loop. Under reduced motion it stays that way. `still` is true
 * for these single frames. `stop()` detaches everything.
 */
export function frameLoop(canvas: HTMLCanvasElement, frame: (t: number, still: boolean) => FrameSteps | void, fps = 30) {
  let visible = false;
  let awake = false;
  let raf = 0;
  let last = 0;
  /** Smoothed cost of one frame, in ms of main-thread time (the sum of its steps). */
  let cost = 0;
  /** A frame is between its steps. Frames share the scene's buffers, so one at a time. */
  let running = false;
  /** A redraw was asked for while a frame was running. */
  let again = false;
  /** A frame was drawn since the canvas last came on screen. */
  let fresh = false;
  const run = async (now: number) => {
    running = true;
    let spent = 0;
    try {
      const steps = frame(now / 1000, !awake || reducedMotion());
      for (;;) {
        const t0 = performance.now();
        const done = !steps || steps.next().done;
        spent += performance.now() - t0;
        if (done) break;
        await yieldToMain();
      }
    } finally {
      // A frame that throws must not stop the loop for good.
      running = false;
    }
    cost = cost ? 0.8 * cost + 0.2 * spent : spent;
    if (again) draw();
  };
  const draw = () => {
    fresh = true;
    again = running;
    if (!running) void run(performance.now());
  };
  const tick = (now: number) => {
    raf = requestAnimationFrame(tick);
    if (running || now - last < Math.max(1000 / fps, COST_SPACING * cost) - 2) return;
    last = now;
    void run(now);
  };
  const start = () => {
    if (!raf && awake && visible && !document.hidden && !reducedMotion()) raf = requestAnimationFrame(tick);
  };
  const pause = () => {
    cancelAnimationFrame(raf);
    raf = 0;
    fresh = false;
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
      // Skip the frame when one was just drawn, as on page load, where setup draws first.
      if (!fresh) draw();
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
