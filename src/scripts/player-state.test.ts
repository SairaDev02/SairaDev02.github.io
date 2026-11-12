import { describe, expect, it, vi } from 'vitest';
import { createPlayerState } from './player-state';

function setup(reduced = false) {
  const navigate = vi.fn();
  const timers: { fn: () => void; ms: number; live: boolean }[] = [];
  const player = createPlayerState({
    urls: ['https://a', 'https://b', 'https://c'],
    navigate,
    reducedMotion: () => reduced,
    fallbackMs: 3900,
    setTimer: (fn, ms) => {
      const t = { fn, ms, live: true };
      timers.push(t);
      return () => (t.live = false);
    },
  });
  const fire = () => timers.filter((t) => t.live).forEach((t) => t.fn());
  return { player, navigate, timers, fire };
}

describe('player state', () => {
  it('cues the first track at start, with nothing hovered or loading', () => {
    expect(setup().player.get()).toEqual({ cued: 0, hover: -1, loading: null });
  });

  it('cues what is hovered and keeps the cue when the pointer leaves', () => {
    const { player } = setup();
    player.hover(2);
    expect(player.get()).toMatchObject({ cued: 2, hover: 2 });
    player.hover(-1);
    expect(player.get()).toMatchObject({ cued: 2, hover: -1 });
  });

  it('notifies subscribers with the new and previous state, only on change', () => {
    const { player } = setup();
    const seen = vi.fn();
    player.subscribe(seen);
    player.hover(1);
    player.hover(1);
    expect(seen).toHaveBeenCalledTimes(1);
    expect(seen).toHaveBeenCalledWith({ cued: 1, hover: 1, loading: null }, { cued: 0, hover: -1, loading: null });
  });

  it('ignores hover, cue and play while a track is loading', () => {
    const { player } = setup();
    player.play(1);
    player.hover(2);
    player.cue(0);
    player.play(2);
    expect(player.get()).toEqual({ cued: 1, hover: 1, loading: 1 });
  });

  it('navigates when the scene reports arrival, once', () => {
    const { player, navigate, fire } = setup();
    player.play(2);
    expect(navigate).not.toHaveBeenCalled();
    player.arrive();
    fire();
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('https://c');
  });

  it('falls back to a timer if the scene never arrives (paused loop)', () => {
    const { player, navigate, timers, fire } = setup();
    player.play(0);
    expect(timers[0].ms).toBe(3900);
    fire();
    expect(navigate).toHaveBeenCalledWith('https://a');
  });

  it('navigates at once under reduced motion', () => {
    const { player, navigate } = setup(true);
    player.play(1);
    expect(navigate).toHaveBeenCalledWith('https://b');
  });

  it('reset (page restored from the back/forward cache) stops the load and its timer', () => {
    const { player, navigate, fire } = setup();
    player.play(1);
    player.reset();
    fire();
    expect(navigate).not.toHaveBeenCalled();
    expect(player.get()).toEqual({ cued: 1, hover: -1, loading: null });
    player.hover(2);
    expect(player.get().hover).toBe(2);
  });
});
