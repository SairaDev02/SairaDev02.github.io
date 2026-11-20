// The page's motion that needs script: the board's first appearance (which rows are below
// the fold), the commit counts, the Open flash, the Preview mark and the text decoding.
// The movement itself is CSS in AssetBoard.astro. Everything here is skipped under
// prefers-reduced-motion: reduce, so the page then shows its final text and values at once.
//
// Text that changes (a decode, a count) keeps its real text in place, transparent, and draws
// the changing glyphs in an aria-hidden overlay on top. Screen readers read the real text
// throughout, and the layout never moves with the glyphs' widths.
import { boardRows } from './assets';
import { onOpened } from './open';
import { onPreview } from './preview';

const motionOK = matchMedia('(prefers-reduced-motion: no-preference)');
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%/<>[]=+';
const raf = (fn: FrameRequestCallback) => requestAnimationFrame(fn);

/** Runs `render(progress)` every frame from `delay` for `ms`, drawing into an overlay. */
function animateText(el: HTMLElement, delay: number, ms: number, render: (k: number, final: string) => string) {
  const final = el.textContent ?? '';
  if (!final.trim()) return;
  const overlay = document.createElement('span');
  overlay.className = 'text-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  const t0 = performance.now() + delay;
  el.classList.add('text-live');
  el.append(overlay);
  const step = (now: number) => {
    const k = Math.min(1, Math.max(0, (now - t0) / ms));
    if (k >= 1) {
      overlay.remove();
      el.classList.remove('text-live');
      return;
    }
    overlay.textContent = render(k, final);
    raf(step);
  };
  raf(step);
}

/** The text appears left to right out of scrambled glyphs. */
const decode = (el: HTMLElement | null, delay: number, ms: number) =>
  el &&
  animateText(el, delay, ms, (k, final) => {
    const fixed = Math.floor(k * final.length);
    return [...final].map((ch, i) => (i < fixed || ch === ' ' ? ch : GLYPHS[Math.floor(Math.random() * GLYPHS.length)])).join('');
  });

/** The number in the text counts up from zero, ease-out cubic. */
const countUp = (el: HTMLElement, delay: number) => {
  const final = el.textContent ?? '';
  const number = /\d+/.exec(final)?.[0];
  if (!number || Number(number) === 0) return;
  animateText(el, delay, 900, (k, text) => text.replace(number, String(Math.round(Number(number) * (1 - (1 - k) ** 3)))));
};

function initBoard() {
  const items = rows.map((row) => row.closest('li')!);

  // Rows below the fold at load reveal on a view timeline as they scroll in; the others on
  // the load sequence. Measured after layout, once the view's box is in place.
  raf(() =>
    raf(() => {
      for (const li of items) if (li.getBoundingClientRect().top > innerHeight) li.classList.add('later');
    }),
  );
  // Each row reveals once: when its animation ends, the settled state stays.
  for (const li of items) li.addEventListener('animationend', (e) => e.target === li && (li.dataset.revealed = 'true'));

  // Commit counts run when their row first appears: after the load sequence for the rows on
  // screen, as the row scrolls in for the rest.
  const seen = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        seen.unobserve(entry.target);
        const late = entry.target.closest('li')!.classList.contains('later');
        countUp(entry.target as HTMLElement, late ? 0 : 450);
      }
    },
    { threshold: 0.6 },
  );
  for (const row of rows) seen.observe(row.querySelector<HTMLElement>('.commits')!);

  // The Open flash: restart the one-shot animation on the row.
  onOpened(({ index }) => {
    const row = rows[index];
    row.classList.remove('flash');
    void row.offsetWidth;
    row.classList.add('flash');
  });
  for (const row of rows) row.addEventListener('animationend', (e) => e.target === row && row.classList.remove('flash'));

  decodeHeads();
}

function decodeHeads() {
  document.querySelectorAll<HTMLElement>('.board .head span').forEach((s, i) => decode(s, 500 + i * 60, 350));
}

// A Preview from anywhere (the sensor view too) marks the row like hovering it does.
const rows = boardRows();
onPreview((index) => rows.forEach((row, i) => (row.dataset.previewed = String(i === index))));

if (motionOK.matches) {
  initBoard();
  decode(document.querySelector('.operator .text .label'), 150, 500);
  decode(document.querySelector('.operator .stats'), 250, 600);
}
