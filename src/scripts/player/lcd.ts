// The CD player's LCD faceplate (Lcd.astro): track counter, title line, an info line that
// scrolls as a marquee only when it overflows, and DRAG / LOAD / PLAY lamps.
import { languageOf, trackNo, type Track } from '../../lib/format';
import type { PlayerSnapshot, Progress } from '../player-state';
import { reducedMotion } from '../render/canvas';

export type LcdFlag = 'drag' | 'cue' | 'load' | 'play';

export interface LcdState {
  /** Track index, or null for "--". */
  n: number | null;
  title: string;
  info: string;
  flag: LcdFlag;
}

export const IDLE_TITLE = 'Drag a disc';
export const IDLE_INFO = 'Each disc is a repository. Drag one into the player, or click it, to open it.';

const info = (t: Track) => `${languageOf(t)} · updated ${t.pushedAt.slice(0, 10)}${t.description ? ` · ${t.description}` : ''}`;

/** What the faceplate shows: a play beats a drag over the tray, which beats a preview. */
export function lcdView(
  s: PlayerSnapshot,
  p: Progress | null,
  drag: { i: number; overTray: boolean } | null,
  tracks: readonly Track[],
): LcdState {
  if (s.play && p) {
    const t = tracks[s.play.i];
    const title = p.phase === 'load' ? `Loading ${t.name}` : t.name;
    return { n: s.play.i, title, info: info(t), flag: 'play' };
  }
  if (drag?.overTray) return { n: drag.i, title: 'Release to load', info: `${tracks[drag.i].name} · ${info(tracks[drag.i])}`, flag: 'load' };
  const i = drag?.i ?? s.hover;
  if (i >= 0) return { n: i, title: tracks[i].name, info: info(tracks[i]), flag: 'cue' };
  return { n: null, title: IDLE_TITLE, info: IDLE_INFO, flag: 'drag' };
}

const GAP = '   ·   ';
const SPEED = 45; // px per second

export function mountLcd(el: HTMLElement): (s: LcdState) => void {
  const num = el.querySelector<HTMLElement>('[data-lcd-num]')!;
  const title = el.querySelector<HTMLElement>('[data-lcd-title]')!;
  const line = el.querySelector<HTMLElement>('[data-lcd-info]')!;
  const run = el.querySelector<HTMLElement>('[data-lcd-run]')!;
  let shown = '';
  let text = run.textContent ?? '';

  const fitMarquee = () => {
    line.classList.remove('marquee');
    run.replaceChildren(text);
    if (reducedMotion() || !line.clientWidth || run.offsetWidth <= line.clientWidth) return;
    // A second copy, hidden from screen readers, makes the loop seamless: one cycle moves
    // exactly the width of "gap + text", so the copy lands where the text began.
    const copy = document.createElement('span');
    copy.setAttribute('aria-hidden', 'true');
    copy.textContent = GAP + text;
    run.append(copy);
    line.style.setProperty('--dist', `${copy.offsetWidth}px`);
    line.style.setProperty('--dur', `${(copy.offsetWidth / SPEED).toFixed(2)}s`);
    line.classList.add('marquee');
  };
  // Re-measure when the faceplate changes width (rotation, resize, fonts arriving).
  let width = 0;
  new ResizeObserver(() => {
    if (line.clientWidth === width) return;
    width = line.clientWidth;
    fitMarquee();
  }).observe(line);
  document.fonts.ready.then(fitMarquee);

  return (s) => {
    const key = JSON.stringify(s);
    if (key === shown) return;
    shown = key;
    num.textContent = s.n === null ? '--' : trackNo(s.n);
    title.textContent = s.title;
    el.dataset.flag = s.flag;
    text = s.info;
    fitMarquee();
  };
}
