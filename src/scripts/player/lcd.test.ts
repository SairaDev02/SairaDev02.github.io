import { describe, expect, it } from 'vitest';
import type { Track } from '../../lib/format';
import { createPlayerState, type PlayerSnapshot } from '../player-state';
import { IDLE_INFO, IDLE_TITLE, lcdView } from './lcd';

const LOAD_MS = 1400;
const PLAY_MS = 30_000;

const track = (name: string, over: Partial<Track> = {}): Track => ({
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
  ...over,
});

const tracks = [
  track('tidepool', { language: 'Rust', description: 'Command-line synthesiser for tide charts.', pushedAt: '2026-11-14T09:00:00Z' }),
  track('paper-lantern', { language: 'TypeScript', description: 'A static site generator for zines.' }),
  track('quiet-notes'),
  track('empty-box', { description: 'Nothing in here yet.' }),
];

/** The faceplate's five lines: the big digits, the small slot, the title, the info line,
 * the lamp (and the Eject button's track while a play runs). */
const view = (s: Partial<PlayerSnapshot>, progress: ReturnType<ReturnType<typeof setup>['player']['progress']> = null, drag: { i: number; overTray: boolean } | null = null) =>
  lcdView({ cued: 0, hover: -1, play: null, blocked: null, ...s }, progress, drag, tracks);

function setup() {
  let t = 0;
  const player = createPlayerState({ loadMs: LOAD_MS, playMs: PLAY_MS, next: (i) => (i + 1) % 4, now: () => t });
  const advance = (ms: number) => void (t += ms);
  return { player, advance };
}

/** The info line the Preview shows: language · dotted date · description. */
const INFO = 'Rust · updated 2026.11.14 · Command-line synthesiser for tide charts.';

describe('lcdView', () => {
  it('asks for a disc when nothing is previewed, playing or blocked', () => {
    expect(view({})).toEqual({ num: '--', of: '/04', title: IDLE_TITLE, info: IDLE_INFO, lamp: 'drag', eject: null });
    expect(IDLE_TITLE).toBe('Pick a disc');
    expect(IDLE_INFO).toBe('Each disc is a repository. Click one or drag it into the player to open it in a new tab.');
  });

  it('shows a previewed disc by name and its info line, with no lamp', () => {
    expect(view({ hover: 1 })).toEqual({
      num: '02',
      of: '/04',
      title: 'paper-lantern',
      info: 'TypeScript · updated 2026.11.12 · A static site generator for zines.',
      lamp: 'none',
      eject: null,
    });
  });

  it('fills a missing language and description without empty dots', () => {
    expect(view({ hover: 2 }).info).toBe('Text · updated 2026.11.12');
  });

  it('asks for the release when a disc is held over the tray', () => {
    expect(view({ hover: 0 }, null, { i: 0, overTray: true })).toEqual({
      num: '01',
      of: '/04',
      title: 'Release to play',
      info: `tidepool · opens in a new tab · ${INFO}`,
      lamp: 'load',
      eject: null,
    });
  });

  it('asks for the swap when another disc is held over the tray during a play', () => {
    const { player, advance } = setup();
    player.play(0);
    advance(LOAD_MS + 1000);
    expect(view(player.get(), player.progress(), { i: 1, overTray: true }).title).toBe('Release to swap');
  });

  it('leaves the play on the faceplate when the playing disc is held over the tray again', () => {
    const { player, advance } = setup();
    player.play(0);
    advance(LOAD_MS + 1000);
    const v = view(player.get(), player.progress(), { i: 0, overTray: true });
    expect(v.title).toBe('tidepool');
    expect(v.eject).toBe('tidepool');
  });

  it('reads the load as a play still on its way, with the LOAD lamp', () => {
    const { player } = setup();
    player.play(0);
    expect(view(player.get(), player.progress())).toEqual({
      num: '01',
      of: '/04',
      title: 'Loading tidepool',
      info: `Opened in a new tab · ${INFO}`,
      lamp: 'load',
      eject: null,
    });
  });

  it('counts the play in the big digits and keeps its length in the small slot', () => {
    const { player, advance } = setup();
    player.play(0);
    advance(LOAD_MS + 12_000);
    expect(view(player.get(), player.progress())).toEqual({
      num: '0:12',
      of: '/0:30',
      title: 'tidepool',
      info: INFO,
      lamp: 'none',
      eject: 'tidepool',
    });
  });

  it('counts a play past one minute in m:ss', () => {
    expect(view({ play: { i: 0, startedAt: 0 } }, { phase: 'playing', elapsed: 75_000, done: 1 }).num).toBe('1:15');
  });

  it('says a tab was blocked, and which disc would open it', () => {
    expect(view({ blocked: 2 })).toEqual({
      num: '--',
      of: '/04',
      title: 'Tab blocked',
      info: 'Click the disc to open quiet-notes',
      lamp: 'none',
      eject: null,
    });
  });

  it('keeps a play ahead of a preview and of a disc held over the tray', () => {
    const { player, advance } = setup();
    player.play(0);
    advance(LOAD_MS + 1000);
    // A preview never reaches the faceplate during a play.
    expect(view({ ...player.get(), hover: 2 }, player.progress()).title).toBe('tidepool');
    // Nor does a blocked tab: a play always means the tab opened.
    expect(view({ ...player.get(), blocked: 3 }, player.progress()).title).toBe('tidepool');
  });

  it('keeps a drag over the tray ahead of a preview and of a blocked tab', () => {
    expect(view({ hover: 1, blocked: 2 }, null, { i: 0, overTray: true }).title).toBe('Release to play');
    expect(view({ blocked: 2 }).title).toBe('Tab blocked');
  });

  it('shows a dragged disc when it is not over the tray', () => {
    expect(view({ hover: 1 }, null, { i: 3, overTray: false }).title).toBe('empty-box');
  });

  it('shows a blocked tab ahead of the preview left behind by the blocked press', () => {
    // A blocked press leaves the pointer on the disc or row it pressed.
    expect(view({ hover: 0, blocked: 0 }).title).toBe('Tab blocked');
  });
});
