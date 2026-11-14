// The Dock's controls and their names: the label above the title, Play, Prev, Next and a
// Queue pick. While nothing plays the picks move the Cue; during a play they open the chosen
// repository's tab and play its disc. Their names say which, so a listener knows what
// pressing them does.
import type { Track } from '../../lib/format';
import type { PlayerSnapshot, PlayerState, Progress } from '../player-state';
import { stepFrom } from './queue';

/** The label above the Dock's title, in the Queue panel's top section too. */
export function kickerView(s: PlayerSnapshot, p: Progress | null): string {
  if (!s.play || !p) return 'Ready to play';
  return p.phase === 'load' ? 'Loading · opened in a new tab' : 'Now playing';
}

export interface PlayView {
  /** The button's accessible name: it names its target and what pressing it does. */
  label: string;
  /** A play is running, so pressing it reopens the playing repository's tab. */
  reopen: boolean;
}

/** The Play button: it opens the Cue's repository, or the playing one's tab again. */
export function playView(s: PlayerSnapshot, tracks: readonly Track[]): PlayView {
  const i = s.play?.i ?? s.cued;
  return s.play
    ? { label: `Reopen ${tracks[i].name} in a new tab`, reopen: true }
    : { label: `Play ${tracks[i].name}, opens in a new tab`, reopen: false };
}

/** A pick cues while nothing plays and plays during a play. */
const mode = (s: PlayerSnapshot) => (s.play ? 'play' : 'cue');

/**
 * Runs a pick. During a play `openAndPlay` opens the repository's tab inside the gesture
 * — a pick must not take the visitor away from this page — and plays the disc.
 */
export function pick(i: number, player: PlayerState, openAndPlay: (i: number) => void): void {
  if (mode(player.get()) === 'play') openAndPlay(i);
  else player.cue(i);
}

export type Step = 'prev' | 'next';

export interface StepView {
  /** The track the step lands on, along the Queue. */
  to: number;
  /** The button's accessible name: it names its target and what pressing it does. */
  label: string;
}

/** The Prev and Next buttons: one step along the Queue from the Cue. */
export function stepView(step: Step, s: PlayerSnapshot, queue: readonly number[], tracks: readonly Track[]): StepView {
  const to = stepFrom(queue, s.cued, step === 'next' ? 1 : -1);
  const name = tracks[to].name;
  const label =
    mode(s) === 'play'
      ? `Play ${step === 'next' ? 'next' : 'previous'}: ${name}, opens in a new tab`
      : `${step === 'next' ? 'Next' : 'Previous'}: ${name}`;
  return { to, label };
}
