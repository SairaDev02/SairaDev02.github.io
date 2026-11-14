// Home page entry: one player state shared by the CD player, the track list and the dock.
// PROTOTYPE (branch prototype/player-playback, map #35): opening a repository plays its
// disc; the tab opens at the gesture. `?tabs=0` plays without opening tabs; `?playSec=8`
// shortens the play; `?variant=A|B|C` picks where Eject and the progress live.
import type { Track } from '../lib/format';
import { mountDock } from './dock/dock';
import { createPlayerState } from './player-state';
import { mountCdPlayer } from './player/cd-player';
import { LOAD, PLAY_MS } from './player/timing';
import { mountPrototypeSwitcher } from './prototype-switcher';

const tracks: Track[] = JSON.parse(document.getElementById('tracks')!.textContent!);
const params = new URLSearchParams(location.search);
const openTabs = params.get('tabs') !== '0';

let nextAfter = (i: number) => (i + 1) % tracks.length;
const player = createPlayerState({ loadMs: LOAD.drop * 1000, playMs: PLAY_MS, next: (i) => nextAfter(i) });
// Timers are throttled or stopped while the repository's tab is in front: catch up on return.
addEventListener('visibilitychange', () => document.visibilityState === 'visible' && player.check());
addEventListener('pageshow', () => player.check());
addEventListener('focus', () => player.check());

/** Must run inside the gesture's event handler, or Safari blocks the tab. */
const openAndPlay = (i: number) => {
  if (player.isLoading()) return;
  if (openTabs) window.open(tracks[i].url, '_blank', 'noopener');
  player.play(i);
};

// Track list rows: links that open in a new tab natively (modified clicks included);
// opening plays the disc. Hover and focus only preview.
const rows = [...document.querySelectorAll<HTMLAnchorElement>('[data-track]')];
rows.forEach((a) => {
  const i = Number(a.dataset.track);
  a.target = '_blank';
  a.rel = 'noopener';
  a.addEventListener('pointerenter', () => player.hover(i));
  a.addEventListener('focus', () => player.hover(i));
  a.addEventListener('pointerleave', () => player.hover(-1));
  a.addEventListener('blur', () => player.hover(-1));
  // A plain click opens the tab the same way as every other route (window.open in the
  // handler); modified and middle clicks keep the browser's own link behaviour.
  a.addEventListener('click', (e) => {
    const plain = e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
    if (plain || player.isLoading() || !openTabs) e.preventDefault();
    if (plain) openAndPlay(i);
    else if (!player.isLoading()) player.play(i);
  });
  a.addEventListener('auxclick', (e) => {
    if (e.button !== 1) return;
    if (player.isLoading() || !openTabs) e.preventDefault();
    if (!player.isLoading()) player.play(i);
  });
});
const markRows = () => {
  const s = player.get();
  for (const a of rows) {
    const i = Number(a.dataset.track);
    a.classList.toggle('on', i === s.play?.i);
    a.classList.toggle('hov', i === s.hover && i !== s.play?.i);
    a.classList.toggle('cued', i === s.cued);
  }
};
player.subscribe(markRows);
markRows();

const variant = mountPrototypeSwitcher(['A', 'B', 'C'], { A: 'Eject in the dock', B: 'Eject on the faceplate', C: 'Eject on the track row' });
document.documentElement.dataset.protoVariant = variant;

nextAfter = mountDock(document.querySelector<HTMLElement>('[data-dock]')!, tracks, player, openAndPlay).nextAfter;
mountCdPlayer(document.querySelector<HTMLElement>('[data-player]')!, tracks, player, openAndPlay);
mountRowEject(rows);

// Variant C: the playing track's row carries its own Eject button and progress.
function mountRowEject(rows: HTMLAnchorElement[]) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'proto-row-eject';
  btn.textContent = '⏏ Eject';
  btn.addEventListener('click', () => player.eject('eject'));
  const bar = document.createElement('span');
  bar.className = 'proto-row-progress';
  bar.setAttribute('aria-hidden', 'true');
  const place = () => {
    const p = player.get().play;
    const row = p && variant === 'C' ? rows[p.i] : null;
    if (!row) return btn.remove(), bar.remove();
    btn.setAttribute('aria-label', `Eject ${tracks[p!.i].name}`);
    row.parentElement!.append(btn, bar);
    const prog = player.progress();
    bar.style.transition = 'none';
    bar.style.width = `${(prog?.done ?? 0) * 100}%`;
    const left = p!.startedAt + player.loadMs + player.playMs - Date.now();
    requestAnimationFrame(() => {
      bar.style.transition = `width ${Math.max(0, left)}ms linear`;
      bar.style.width = '100%';
    });
  };
  player.subscribe(place);
  addEventListener('visibilitychange', place);
}
