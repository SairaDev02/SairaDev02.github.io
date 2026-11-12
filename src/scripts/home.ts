// Home page entry: one player state shared by the CD player, the track list and the dock.
import type { Track } from '../lib/format';
import { mountDock } from './dock/dock';
import { createPlayerState } from './player-state';
import { mountCdPlayer } from './player/cd-player';
import { FALLBACK_MS } from './player/timing';
import { reducedMotion } from './render/canvas';

const tracks: Track[] = JSON.parse(document.getElementById('tracks')!.textContent!);

const player = createPlayerState({
  urls: tracks.map((t) => t.url),
  navigate: (url) => location.assign(url),
  reducedMotion,
  fallbackMs: FALLBACK_MS,
});
// Coming back with the back button restores the page mid-load from the cache.
addEventListener('pageshow', (e) => e.persisted && player.reset());

// Track list rows: hover or focus cues, a plain click loads the disc (and then navigates).
const rows = [...document.querySelectorAll<HTMLAnchorElement>('[data-track]')];
rows.forEach((a) => {
  const i = Number(a.dataset.track);
  a.addEventListener('pointerenter', () => player.hover(i));
  a.addEventListener('focus', () => player.hover(i));
  a.addEventListener('pointerleave', () => player.hover(-1));
  a.addEventListener('blur', () => player.hover(-1));
  a.addEventListener('click', (e) => {
    // Modified clicks keep their usual meaning (new tab or window).
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    player.play(i);
  });
});
player.subscribe((s) => {
  const active = s.loading ?? s.hover;
  for (const a of rows) a.classList.toggle('on', Number(a.dataset.track) === active);
});

mountDock(document.querySelector<HTMLElement>('[data-dock]')!, tracks, player);
mountCdPlayer(document.querySelector<HTMLElement>('[data-player]')!, tracks, player);
