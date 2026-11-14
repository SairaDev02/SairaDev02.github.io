// The CD player's LCD faceplate (Lcd.astro): the big digits, the small slot after them, a
// title line, an info line that scrolls as a marquee only when it overflows, the DRAG and
// LOAD lamps, and the Eject button that takes their place while a disc plays.
import { dotDate, languageOf, trackNo, type Track } from '../../lib/format';
import type { PlayerSnapshot, Progress } from '../player-state';
import { reducedMotion } from '../render/canvas';
import { PLAY_MS } from './timing';

/** The lamp a state lights. A Preview and a blocked tab light none; a play shows Eject. */
export type LcdLamp = 'drag' | 'load' | 'none';

export interface LcdState {
  /** The big digits: a track number, the elapsed time of a play, or "--". */
  num: string;
  /** The small slot after the digits: the track count, or a play's length ("/0:30"). */
  of: string;
  title: string;
  info: string;
  lamp: LcdLamp;
  /** The name the Eject button ejects, or null when the button is hidden. */
  eject: string | null;
}

export const IDLE_TITLE = 'Pick a disc';
export const IDLE_INFO = 'Each disc is a repository. Click one or drag it into the player to open it in a new tab.';

/** "/04": how many discs the player holds. */
export const countLabel = (n: number) => `/${String(n).padStart(2, '0')}`;
/** A duration as m:ss: 75 000 -> "1:15". */
const clock = (ms: number) => `${Math.floor(ms / 60_000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
const info = (t: Track) => `${languageOf(t)} · updated ${dotDate(t.pushedAt)}${t.description ? ` · ${t.description}` : ''}`;

/**
 * What the faceplate shows: a play, then a disc over the tray, then a Preview, then idle.
 * A blocked tab sits below a previewed disc and above idle, and a playing disc held over
 * the tray again is no swap, so the play stays. Pure: every word comes from the snapshot,
 * the play's progress and the scene's drag.
 */
export function lcdView(
  s: PlayerSnapshot,
  p: Progress | null,
  drag: { i: number; overTray: boolean } | null,
  tracks: readonly Track[],
): LcdState {
  const of = countLabel(tracks.length);
  if (drag?.overTray && drag.i !== s.play?.i) {
    const t = tracks[drag.i];
    return {
      num: trackNo(drag.i),
      of,
      title: s.play ? 'Release to swap' : 'Release to play',
      info: `${t.name} · opens in a new tab · ${info(t)}`,
      lamp: 'load',
      eject: null,
    };
  }
  if (s.play && p) {
    const t = tracks[s.play.i];
    if (p.phase === 'load')
      return { num: trackNo(s.play.i), of, title: `Loading ${t.name}`, info: `Opened in a new tab · ${info(t)}`, lamp: 'load', eject: null };
    return { num: clock(p.elapsed), of: `/${clock(PLAY_MS)}`, title: t.name, info: info(t), lamp: 'none', eject: t.name };
  }
  if (s.blocked !== null)
    return { num: '--', of, title: 'Tab blocked', info: `Click the disc to open ${tracks[s.blocked].name}`, lamp: 'none', eject: null };
  const i = drag?.i ?? s.hover;
  if (i >= 0) return { num: trackNo(i), of, title: tracks[i].name, info: info(tracks[i]), lamp: 'none', eject: null };
  return { num: '--', of, title: IDLE_TITLE, info: IDLE_INFO, lamp: 'drag', eject: null };
}

const GAP = '   ·   ';
const SPEED = 45; // px per second

/** The Eject button leaves with the play; `returnFocus` takes it on when it held focus. */
export function mountLcd(el: HTMLElement, onEject: () => void, returnFocus: () => void): (s: LcdState) => void {
  const num = el.querySelector<HTMLElement>('[data-lcd-num]')!;
  const of = el.querySelector<HTMLElement>('[data-lcd-of]')!;
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
    num.textContent = s.num;
    of.textContent = s.of;
    title.textContent = s.title;
    el.dataset.flag = s.lamp;
    // A pressed button disappears with the play; the visitor keeps their place at the Dock.
    const focused = !eject.hidden && eject.contains(document.activeElement);
    eject.hidden = s.eject === null;
    el.classList.toggle('has-eject', s.eject !== null);
    if (s.eject !== null) eject.setAttribute('aria-label', `Eject ${s.eject}`);
    if (focused && s.eject === null) returnFocus();
    // The big digits tick every second; only a new info line restarts the marquee.
    if (s.info === text) return;
    text = s.info;
    fitMarquee();
  };
}
