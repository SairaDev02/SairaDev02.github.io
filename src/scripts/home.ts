// Home page entry: one player state shared by the CD player, the track list and the dock.
// Every route that opens a repository opens its tab inside the gesture's handler and then
// plays the disc; the site's own tab never navigates.
import type { Track } from '../lib/format';
import { mountDock } from './dock/dock';
import { createPlayerState } from './player-state';
import { mountCdPlayer } from './player/cd-player';
import { LOAD, PLAY_MS } from './player/timing';

const tracks: Track[] = JSON.parse(document.getElementById('tracks')!.textContent!);

// The Queue's order belongs to the dock; a return follows it.
let nextAfter = (i: number) => (i + 1) % tracks.length;
const player = createPlayerState({ loadMs: LOAD.drop * 1000, playMs: PLAY_MS, next: (i) => nextAfter(i) });
// A hidden tab's timers are throttled or stopped: a play that is over ends on return.
addEventListener('visibilitychange', () => document.visibilityState === 'visible' && player.check());
addEventListener('pageshow', () => player.check());
addEventListener('focus', () => player.check());

// The page's one status region (index.astro): committed changes only, never a preview, a
// drag or a clock tick.
const status = document.querySelector<HTMLElement>('[data-status]')!;
const announce = (message: string) => void (status.textContent = message);

/** Opens the repository in a new tab at the gesture. False when the browser blocked it. */
const openTab = (url: string) => {
  // `noopener` in the features always returns null, so the new window is detached by hand.
  const win = window.open(url, '_blank');
  if (!win) return false;
  win.opener = null;
  return true;
};

/** Plays a disc whose tab the browser has already opened. */
const playHere = (i: number) => {
  if (player.isLoading()) return;
  // Reopening the playing repository is not a new play: its 30 s keep counting.
  const reopened = player.get().play?.i === i;
  player.play(i);
  const name = tracks[i].name;
  announce(reopened ? `Reopened ${name} in a new tab` : `Playing ${name}, opened in a new tab`);
};

/** The route for every control that has to open the tab itself. */
const openAndPlay = (i: number) => {
  if (player.isLoading()) return;
  if (!openTab(tracks[i].url)) return announce(`New tab blocked. Click ${tracks[i].name} to open it`);
  playHere(i);
};

// A return is committed by the clock: say so, and say nothing else.
player.subscribe((_now, before, why) => {
  if (why === 'return' && before.play) announce(`${tracks[before.play.i].name} returned`);
});

// Track list rows: a plain click opens the tab like every other route; modified and middle
// clicks keep the link's own behaviour and still play the disc.
const rows = [...document.querySelectorAll<HTMLAnchorElement>('[data-track]')];
rows.forEach((a) => {
  const i = Number(a.dataset.track);
  // Temporary, until the Cue stops following a preview (#49): hovering still cues the Dock.
  const preview = () => {
    player.hover(i);
    player.cue(i);
  };
  a.addEventListener('pointerenter', preview);
  a.addEventListener('focus', preview);
  a.addEventListener('pointerleave', () => player.hover(-1));
  a.addEventListener('blur', () => player.hover(-1));
  a.addEventListener('click', (e) => {
    if (e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return playHere(i);
    e.preventDefault();
    openAndPlay(i);
  });
  a.addEventListener('auxclick', (e) => {
    if (e.button === 1) playHere(i);
  });
});
// What is playing fills its row; hovering still cues the Dock until the Cue's own ticket.
player.subscribe((s) => {
  const active = s.play?.i ?? s.hover;
  for (const a of rows) a.classList.toggle('on', Number(a.dataset.track) === active);
});

nextAfter = mountDock(document.querySelector<HTMLElement>('[data-dock]')!, tracks, player, openAndPlay).nextAfter;
mountCdPlayer(document.querySelector<HTMLElement>('[data-player]')!, tracks, player, openAndPlay);
