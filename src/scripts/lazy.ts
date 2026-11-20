// Loading heavy scene code without touching the page's first paint or its load event.
//
//   afterLoad(fn)        -> runs `fn` once the window's load event has fired (now, if it has).
//   whenDue(el, load)    -> calls `load()` once, never before the load event: when the
//                           browser is idle after load, or as soon as `el` is within one
//                           viewport of the screen (and load has fired), whichever is first.
//
// The sensor view and the background field both load three.js through this, so the page's
// text and board are never held up by it.

/** Runs `fn` after the window's load event. */
export const afterLoad = (fn: () => void) => {
  if (document.readyState === 'complete') fn();
  else addEventListener('load', fn, { once: true });
};

const idle = (fn: () => void) => ('requestIdleCallback' in window ? requestIdleCallback(fn) : setTimeout(fn, 200));

/** Calls `load` once: after load when idle, or after load once `el` is within a viewport of the screen. */
export function whenDue(el: Element, load: () => void) {
  let started = false;
  const go = () => {
    if (started) return;
    started = true;
    near.disconnect();
    load();
  };
  const near = new IntersectionObserver(([e]) => e.isIntersecting && afterLoad(go), { rootMargin: '100% 0px' });
  near.observe(el);
  afterLoad(() => idle(go));
}
