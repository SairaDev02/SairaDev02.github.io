// PROTOTYPE (branch prototype/player-playback, map #35): the clock-driven play model from
// "Playback model" (#41) and "Cueing" (#40). Throwaway: no tests, rewrite before shipping.
//
// The one writer of what is cued, previewed and playing. Everything about a play's
// progress is derived from the wall clock, never from frames, so it stays right while the
// tab is hidden (the repository opens in a new tab in front of this one).
//
//   hover  preview only: the disc or row under the pointer or focus (-1 for none).
//   cued   the dock's track, which its Play button plays.
//   play   the disc in the player and when its play began (null when the tray is empty).
//          Its load runs for loadMs, then it plays for playMs, then it returns.

export interface Play {
  i: number;
  startedAt: number;
}

export interface PlayerSnapshot {
  cued: number;
  hover: number;
  play: Play | null;
}

/** Why the tray emptied or changed, for listeners that animate the disc going back. */
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
  progress(now?: number): Progress | null;
  /** A load is running: every intent is ignored meanwhile. */
  isLoading(): boolean;
  subscribe(fn: Listener): void;
  hover(i: number): void;
  cue(i: number): void;
  /** Starts a play (swapping out a running one). The caller has already opened the tab. */
  play(i: number): void;
  eject(how: 'eject' | 'drag-out'): void;
  /** Ends a play whose time is up. Safe to call any time, any number of times. */
  check(): void;
  readonly loadMs: number;
  readonly playMs: number;
}

export interface PlayerOptions {
  loadMs: number;
  playMs: number;
  /** The track after `i` in the queue: a return cues it. */
  next: (i: number) => number;
  now?: () => number;
}

export function createPlayerState(o: PlayerOptions): PlayerState {
  const now = o.now ?? Date.now;
  let s: PlayerSnapshot = { cued: 0, hover: -1, play: null };
  const listeners: Listener[] = [];
  let timer = 0;

  const set = (next: PlayerSnapshot, why?: Change) => {
    if (next.cued === s.cued && next.hover === s.hover && next.play === s.play) return;
    const before = s;
    s = next;
    for (const fn of listeners) fn(s, before, why);
  };
  const progress = (t = now()): Progress | null => {
    if (!s.play) return null;
    const e = t - s.play.startedAt;
    if (e < o.loadMs) return { phase: 'load', elapsed: 0, done: 0 };
    const elapsed = Math.min(o.playMs, e - o.loadMs);
    return { phase: 'playing', elapsed, done: elapsed / o.playMs };
  };
  const isLoading = () => progress()?.phase === 'load';
  const check = () => {
    if (!s.play || now() < s.play.startedAt + o.loadMs + o.playMs) return;
    clearTimeout(timer);
    set({ ...s, play: null, cued: o.next(s.play.i) }, 'return');
  };

  return {
    loadMs: o.loadMs,
    playMs: o.playMs,
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
      if (isLoading()) return;
      const why = s.play ? 'swap' : undefined;
      clearTimeout(timer);
      set({ ...s, cued: i, play: { i, startedAt: now() } }, why);
      // Best effort only: hidden tabs throttle timers, so visibility and focus also call check().
      timer = window.setTimeout(check, o.loadMs + o.playMs + 50);
    },
    eject(how) {
      if (!s.play || isLoading()) return;
      clearTimeout(timer);
      set({ ...s, play: null }, how);
    },
    check,
  };
}
