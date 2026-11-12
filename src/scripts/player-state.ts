// The one writer of "what is cued, hovered and loading" on the home page. The CD player,
// the LCD, the track list and the now-playing dock all read it and send it intents; none
// of them keeps its own copy. Loading a track ends in navigating to its repository.
//
//   hover  transient: the disc or row under the pointer (-1 for none). Hovering cues.
//   cued   sticky: the dock's track; survives the pointer leaving.
//   loading the track whose load sequence runs; every other intent is ignored meanwhile.

export interface PlayerSnapshot {
  cued: number;
  hover: number;
  loading: number | null;
}

export type Listener = (now: PlayerSnapshot, before: PlayerSnapshot) => void;

export interface PlayerState {
  get(): PlayerSnapshot;
  subscribe(fn: Listener): void;
  hover(i: number): void;
  cue(i: number): void;
  play(i: number): void;
  /** The scene's load animation finished: navigate now. */
  arrive(): void;
  /** Page came back from the back/forward cache mid-load: start over. */
  reset(): void;
}

export interface PlayerOptions {
  urls: readonly string[];
  navigate: (url: string) => void;
  reducedMotion: () => boolean;
  /** Navigate after this long even if the scene never reports arrival (paused loop). */
  fallbackMs: number;
  setTimer?: (fn: () => void, ms: number) => () => void;
}

const browserTimer = (fn: () => void, ms: number) => {
  const id = setTimeout(fn, ms);
  return () => clearTimeout(id);
};

export function createPlayerState(o: PlayerOptions): PlayerState {
  let s: PlayerSnapshot = { cued: 0, hover: -1, loading: null };
  const listeners: Listener[] = [];
  let cancelFallback = () => {};
  let left = false; // navigation started; the page stays "loading" until it unloads

  const set = (next: PlayerSnapshot) => {
    if (next.cued === s.cued && next.hover === s.hover && next.loading === s.loading) return;
    const before = s;
    s = next;
    for (const fn of listeners) fn(s, before);
  };
  const go = (i: number) => {
    cancelFallback();
    if (left) return;
    left = true;
    o.navigate(o.urls[i]);
  };

  return {
    get: () => s,
    subscribe: (fn) => void listeners.push(fn),
    hover(i) {
      if (s.loading !== null) return;
      set({ ...s, hover: i, cued: i >= 0 ? i : s.cued });
    },
    cue(i) {
      if (s.loading !== null) return;
      set({ ...s, hover: i, cued: i });
    },
    play(i) {
      if (s.loading !== null) return;
      if (o.reducedMotion()) return go(i);
      set({ cued: i, hover: i, loading: i });
      cancelFallback = (o.setTimer ?? browserTimer)(() => go(i), o.fallbackMs);
    },
    arrive() {
      if (s.loading !== null) go(s.loading);
    },
    reset() {
      cancelFallback();
      left = false;
      set({ ...s, hover: -1, loading: null });
    },
  };
}
