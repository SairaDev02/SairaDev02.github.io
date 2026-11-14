// The Dock's picks: Prev, Next and a Queue pick. While nothing plays they move the Cue;
// during a play they open the chosen repository's tab and play its disc. Their names say
// which, so a listener knows what pressing them does.
import type { Track } from '../../lib/format';
import type { PlayerSnapshot, PlayerState } from '../player-state';
import { stepFrom } from './queue';

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
