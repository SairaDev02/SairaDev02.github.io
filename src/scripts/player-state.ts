// The one writer of what is cued, previewed and playing. The CD player, the faceplate, the
// track list and the Dock read it and send it intents; none of them keeps its own copy.
//
//   hover  preview only: the disc or row under the pointer or focus (-1 for none).
//   cued   the Dock's track, which its Play button plays.
//   play   the disc in the player and when its press happened (null for an empty tray).
//          A play loads for loadMs, then plays for playMs, then returns to its slot.
//
// A play's phase and progress come from the wall clock, never from frames or chained
// timers: the repository opens in a new tab in front of this one, where timers are
// throttled, and the picture must be right when the visitor comes back.

export interface Play {
  i: number;
  /** Wall-clock ms of the press; the load and the play count from here. */
  startedAt: number;
}

export interface PlayerSnapshot {
  cued: number;
  hover: number;
  play: Play | null;
}

/** Why the tray changed, for listeners that send a disc back. */
export type Change = 'return' | 'eject' | 'drag-out' | 'swap';

export type Listener = (now: PlayerSnapshot, before: PlayerSnapshot, why?: Change) => void;

export interface Progress {
  phase: 'load' | 'playing';
  /** ms since the disc landed (0 during the load). */
  elapsed: number;
  /** 0 to 1 over the play time. */
  done: number;
}

export interface PlayerState {
  get(): PlayerSnapshot;
  /** The play at `now` (default: the wall clock), or null while nothing plays. */
  progress(now?: number): Progress | null;
  /** A load is running: presses are ignored meanwhile. */
  isLoading(): boolean;
  subscribe(fn: Listener): void;
  hover(i: number): void;
  cue(i: number): void;
  /** Starts a play. The caller has already opened the repository's tab. */
  play(i: number): void;
  eject(how: 'eject' | 'drag-out'): void;
  /** Ends a play whose time is up. Safe to call at any time, any number of times. */
  check(): void;
}

export interface PlayerOptions {
  /** The load: the disc travels into the tray for this long. */
  loadMs: number;
  /** The play, counted from when the disc lands. */
  playMs: number;
  /** The track after `i` in the Queue: a return cues it. */
  next: (i: number) => number;
  now?: () => number;
}

export function createPlayerState(o: PlayerOptions): PlayerState {
  const now = o.now ?? (() => Date.now());
  let s: PlayerSnapshot = { cued: 0, hover: -1, play: null };
  const listeners: Listener[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;

  const set = (next: PlayerSnapshot, why?: Change) => {
    if (next.cued === s.cued && next.hover === s.hover && next.play === s.play) return;
    const before = s;
    s = next;
    for (const fn of listeners) fn(s, before, why);
  };
  const progress = (t = now()): Progress | null => {
    const play = s.play;
    if (!play) return null;
    const e = t - play.startedAt;
    if (e < o.loadMs) return { phase: 'load', elapsed: 0, done: 0 };
    const elapsed = Math.min(o.playMs, e - o.loadMs);
    return { phase: 'playing', elapsed, done: elapsed / o.playMs };
  };
  const isLoading = () => progress()?.phase === 'load';
  const check = () => {
    const play = s.play;
    if (!play || now() < play.startedAt + o.loadMs + o.playMs) return;
    clearTimeout(timer);
    set({ ...s, play: null, cued: o.next(play.i) }, 'return');
  };

  return {
    get: () => s,
    progress,
    isLoading,
    subscribe: (fn) => void listeners.push(fn),
    hover(i) {
      set({ ...s, hover: i });
    },
    cue(i) {
      if (isLoading()) return;
      set({ ...s, cued: i });
    },
    play(i) {
      // A press during a load would stack plays; reopening the playing repository is not
      // a new play, so its 30 s keep counting from the first press.
      if (isLoading() || s.play?.i === i) return;
      const why = s.play ? 'swap' : undefined;
      clearTimeout(timer);
      set({ ...s, cued: i, play: { i, startedAt: now() } }, why);
      // Best effort only: a hidden tab throttles timers, so visibilitychange, pageshow and
      // focus also call check().
      timer = setTimeout(check, o.loadMs + o.playMs + 50);
    },
    eject(how) {
      if (!s.play || isLoading()) return;
      clearTimeout(timer);
      set({ ...s, play: null }, how);
    },
    check,
  };
}
