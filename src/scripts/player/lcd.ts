// The CD player's LCD faceplate (Lcd.astro): track counter, title line, an info line that
// scrolls as a marquee only when it overflows, and DRAG / LOAD / PLAY lamps.
// PROTOTYPE (map #35): a play shows its elapsed time; a play beats a drag over the tray,
// which beats a preview. Variant B puts the time in the big counter and an Eject button
// on the faceplate.
import { languageOf, trackNo, type Track } from '../../lib/format';
import type { PlayerSnapshot, Progress } from '../player-state';
import { reducedMotion } from '../render/canvas';

export type LcdFlag = 'drag' | 'cue' | 'load' | 'play';

export interface LcdState {
  /** Track index, or null for "--". */
  n: number | null;
  /** Variant B: elapsed time shown in the big counter instead of the track number. */
  time?: string;
  title: string;
  info: string;
  flag: LcdFlag;
  /** Variant B: the faceplate's Eject button is shown. */
  eject: boolean;
}

export const IDLE_TITLE = 'Drag a disc';
export const IDLE_INFO = 'Each disc is a repository. Drag one into the player, or click it, to open it.';

const info = (t: Track) => `${languageOf(t)} · updated ${t.pushedAt.slice(0, 10)}${t.description ? ` · ${t.description}` : ''}`;

const clock = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
const variantB = () => document.documentElement.dataset.protoVariant === 'B';

export function lcdView(
  s: PlayerSnapshot,
  p: Progress | null,
  playMs: number,
  drag: { i: number; overTray: boolean } | null,
  tracks: readonly Track[],
): LcdState {
  const b = variantB();
  const none = { eject: false };
  if (drag?.overTray && drag.i !== s.play?.i)
    return { ...none, n: drag.i, title: s.play ? 'Release to swap' : 'Release to play', info: `${tracks[drag.i].name} · opens in a new tab · ${info(tracks[drag.i])}`, flag: 'load' };
  if (s.play && p) {
    const t = tracks[s.play.i];
    if (p.phase === 'load') return { ...none, n: s.play.i, title: `Loading ${t.name}`, info: `Opened in a new tab · ${info(t)}`, flag: 'load' };
    const time = clock(p.elapsed);
    if (b) return { n: s.play.i, title: `${t.name}`, info: info(t), flag: 'play', eject: true, time };
    return { ...none, n: s.play.i, title: `${time} / ${clock(playMs)}  ${t.name}`, info: info(t), flag: 'play' };
  }
  const i = drag?.i ?? s.hover;
  if (i >= 0) return { ...none, n: i, title: tracks[i].name, info: info(tracks[i]), flag: 'cue' };
  return { ...none, n: null, title: IDLE_TITLE, info: IDLE_INFO, flag: 'drag' };
}

const GAP = '   ·   ';
const SPEED = 45; // px per second

export function mountLcd(el: HTMLElement, onEject: () => void): (s: LcdState) => void {
  const num = el.querySelector<HTMLElement>('[data-lcd-num]')!;
  const title = el.querySelector<HTMLElement>('[data-lcd-title]')!;
  const line = el.querySelector<HTMLElement>('[data-lcd-info]')!;
  const run = el.querySelector<HTMLElement>('[data-lcd-run]')!;
  const eject = el.querySelector<HTMLButtonElement>('[data-lcd-eject]')!;
  eject.addEventListener('click', onEject);
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
    num.textContent = s.time ?? (s.n === null ? '--' : trackNo(s.n));
    title.textContent = s.title;
    el.dataset.flag = s.flag;
    eject.hidden = !s.eject;
    el.classList.toggle('has-eject', s.eject);
    // The title ticks every second; only a new info line restarts the marquee.
    if (s.info === text) return;
    text = s.info;
    fitMarquee();
  };
}
