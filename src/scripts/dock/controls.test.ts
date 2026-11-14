import { describe, expect, it, vi } from 'vitest';
import type { Track } from '../../lib/format';
import { createPlayerState } from '../player-state';
import { kickerView, pick, playView, stepView } from './controls';

const LOAD_MS = 1400;

const track = (name: string): Track => ({
  name,
  description: null,
  language: null,
  topics: [],
  url: `https://github.com/SairaDev02/${name}`,
  pushedAt: '2026-11-12T10:00:00Z',
  commits: 3,
  firstCommit: null,
  lastCommit: null,
  lyrics: [],
});

const tracks = ['tidepool', 'paper-lantern', 'quiet-notes', 'empty-box'].map(track);

/** A player on a hand-driven clock, cued on the first track. */
function setup() {
  let t = 0;
  const player = createPlayerState({ loadMs: LOAD_MS, playMs: 30_000, next: (i) => (i + 1) % 4, now: () => t });
  const advance = (ms: number) => void (t += ms);
  return { player, advance };
}

describe('kickerView', () => {
  it('reads Ready to play while nothing plays', () => {
    const { player } = setup();
    expect(kickerView(player.get(), player.progress())).toBe('Ready to play');
  });

  it('names the load, then the play', () => {
    const { player, advance } = setup();
    player.play(1);
    expect(kickerView(player.get(), player.progress())).toBe('Loading · opened in a new tab');

    advance(LOAD_MS);
    expect(kickerView(player.get(), player.progress())).toBe('Now playing');

    advance(30_000);
    expect(kickerView(player.get(), player.progress())).toBe('Now playing');

    // The play is over on the clock, and the label goes back with it.
    player.check();
    expect(kickerView(player.get(), player.progress())).toBe('Ready to play');
  });
});

describe('playView', () => {
  it('offers to play the Cue while nothing plays', () => {
    const { player } = setup();
    player.cue(2);
    expect(playView(player.get(), tracks)).toBe('Play quiet-notes, opens in a new tab');
  });

  it('offers to reopen the playing repository', () => {
    const { player, advance } = setup();
    player.play(1);
    advance(LOAD_MS);
    expect(playView(player.get(), tracks)).toBe('Reopen paper-lantern in a new tab');
  });
});

describe('stepView', () => {
  it('names the step by the Queue while nothing plays', () => {
    const queue = [0, 1, 2, 3];
    const { player } = setup();
    expect(stepView('prev', player.get(), queue, tracks)).toEqual({ to: 3, label: 'Previous: empty-box' });
    expect(stepView('next', player.get(), queue, tracks)).toEqual({ to: 1, label: 'Next: paper-lantern' });
  });

  it('says a step opens a tab while a disc plays', () => {
    const queue = [0, 1, 2, 3];
    const { player, advance } = setup();
    player.play(1);
    advance(LOAD_MS);
    expect(stepView('prev', player.get(), queue, tracks)).toEqual({
      to: 0,
      label: 'Play previous: tidepool, opens in a new tab',
    });
    expect(stepView('next', player.get(), queue, tracks)).toEqual({
      to: 2,
      label: 'Play next: quiet-notes, opens in a new tab',
    });
  });

  it('steps the Queue order, not the track numbers', () => {
    // The Queue panel moved paper-lantern to the end: cued tidepool, then quiet-notes.
    const queue = [0, 2, 3, 1];
    const { player } = setup();
    expect(stepView('next', player.get(), queue, tracks)).toEqual({ to: 2, label: 'Next: quiet-notes' });
  });
});

describe('pick', () => {
  it('cues while nothing plays', () => {
    const { player } = setup();
    const open = vi.fn();
    pick(2, player, open);
    expect(open).not.toHaveBeenCalled();
    expect(player.get()).toEqual({ cued: 2, hover: -1, play: null, blocked: null });
  });

  it('opens the repository and plays during a play', () => {
    const { player, advance } = setup();
    player.play(0);
    advance(LOAD_MS);
    const open = vi.fn();
    pick(3, player, open);
    // The tab opens at the gesture; the disc's own load and play follow from the play.
    expect(open).toHaveBeenCalledWith(3);
    expect(player.get().cued).toBe(0);
  });
});
