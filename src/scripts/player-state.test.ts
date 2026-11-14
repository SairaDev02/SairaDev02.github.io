import { describe, expect, it, vi } from 'vitest';
import { createPlayerState } from './player-state';

const LOAD_MS = 1400;
const PLAY_MS = 30_000;

/** A player on a hand-driven clock: a play's progress is only ever the clock's. */
function setup() {
  let t = 0;
  const player = createPlayerState({
    loadMs: LOAD_MS,
    playMs: PLAY_MS,
    next: (i) => (i + 1) % 4,
    now: () => t,
  });
  const advance = (ms: number) => void (t += ms);
  return { player, advance };
}

describe('player state', () => {
  it('cues the first track at start, with nothing previewed or playing', () => {
    expect(setup().player.get()).toEqual({ cued: 0, hover: -1, play: null });
  });

  it('previews what is hovered without moving the cue', () => {
    const { player } = setup();
    player.hover(2);
    expect(player.get()).toEqual({ cued: 0, hover: 2, play: null });
    player.hover(-1);
    expect(player.get()).toEqual({ cued: 0, hover: -1, play: null });
  });

  it('moves the cue without touching the preview', () => {
    const { player } = setup();
    player.hover(2);
    player.cue(3);
    expect(player.get()).toEqual({ cued: 3, hover: 2, play: null });
  });

  it('has no progress while nothing plays', () => {
    const { player } = setup();
    expect(player.progress()).toBeNull();
    expect(player.isLoading()).toBe(false);
  });

  it('loads, then plays, then returns at 30 s and cues the next track', () => {
    const { player, advance } = setup();
    player.play(2);
    expect(player.get()).toEqual({ cued: 2, hover: -1, play: { i: 2, startedAt: 0 } });
    expect(player.progress()).toEqual({ phase: 'load', elapsed: 0, done: 0 });
    expect(player.isLoading()).toBe(true);

    // The disc lands after the load; the 30 s start there, not at the press.
    advance(LOAD_MS);
    expect(player.isLoading()).toBe(false);
    expect(player.progress()).toEqual({ phase: 'playing', elapsed: 0, done: 0 });
    expect(player.progress(LOAD_MS + 15_000)).toEqual({ phase: 'playing', elapsed: 15_000, done: 0.5 });

    // The clock alone ends nothing: check() commits the return, and the cue moves on.
    advance(PLAY_MS - 1);
    player.check();
    expect(player.get().play).not.toBeNull();
    advance(1);
    player.check();
    expect(player.get()).toEqual({ cued: 3, hover: -1, play: null });
  });

  it('tells subscribers why the tray changed', () => {
    const { player, advance } = setup();
    const seen = vi.fn();
    player.subscribe(seen);
    player.play(1);
    advance(LOAD_MS + PLAY_MS);
    player.check();
    expect(seen).toHaveBeenLastCalledWith(
      { cued: 2, hover: -1, play: null },
      { cued: 1, hover: -1, play: { i: 1, startedAt: 0 } },
      'return',
    );
  });

  it('swaps a running play for another disc', () => {
    const { player, advance } = setup();
    player.play(1);
    advance(LOAD_MS + 5000);
    const seen = vi.fn();
    player.subscribe(seen);
    player.play(2);
    expect(player.get().play).toEqual({ i: 2, startedAt: LOAD_MS + 5000 });
    expect(player.progress()).toEqual({ phase: 'load', elapsed: 0, done: 0 });
    expect(seen).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'swap');
  });

  it('ignores a play and a cue while a disc is loading', () => {
    const { player, advance } = setup();
    player.play(1);
    advance(LOAD_MS - 1);
    player.play(2);
    player.cue(3);
    expect(player.get()).toEqual({ cued: 1, hover: -1, play: { i: 1, startedAt: 0 } });
  });

  it('keeps a running play when its own repository reopens', () => {
    const { player, advance } = setup();
    player.play(1);
    advance(LOAD_MS + 10_000);
    const seen = vi.fn();
    player.subscribe(seen);
    player.play(1);
    expect(seen).not.toHaveBeenCalled();
    expect(player.get().play).toEqual({ i: 1, startedAt: 0 });
    // The 30 s still count from the first press.
    advance(PLAY_MS - 10_000);
    player.check();
    expect(player.get().play).toBeNull();
  });

  it('ends a play at once on eject and keeps the cue where it was', () => {
    const { player, advance } = setup();
    const seen = vi.fn();
    player.subscribe(seen);
    player.play(2);
    advance(LOAD_MS + 1000);
    player.eject('eject');
    expect(player.get()).toEqual({ cued: 2, hover: -1, play: null });
    expect(seen).toHaveBeenLastCalledWith(expect.anything(), expect.anything(), 'eject');
  });

  it('reports a drag-out eject as its own reason', () => {
    const { player, advance } = setup();
    const seen = vi.fn();
    player.subscribe(seen);
    player.play(2);
    advance(LOAD_MS + 1000);
    player.eject('drag-out');
    expect(seen).toHaveBeenLastCalledWith(expect.anything(), expect.anything(), 'drag-out');
  });

  it('ignores eject while a disc loads and when nothing plays', () => {
    const { player } = setup();
    player.eject('eject');
    expect(player.get().play).toBeNull();

    player.play(1);
    player.eject('drag-out');
    expect(player.get().play).toEqual({ i: 1, startedAt: 0 });
  });

  it('is safe to check any number of times', () => {
    const { player, advance } = setup();
    const seen = vi.fn();
    player.subscribe(seen);
    player.play(0);
    advance(LOAD_MS + PLAY_MS);
    player.check();
    player.check();
    player.check();
    expect(player.get().play).toBeNull();
    expect(seen).toHaveBeenCalledTimes(2); // the play started, the play returned
  });
});
