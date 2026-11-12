// Display formats shared by the server-rendered page and its scripts.
import type { Repo } from './github';

/** Track number from a zero-based index: 0 -> "01". */
export const trackNo = (i: number) => String(i + 1).padStart(2, '0');

/** "2026-11-12T…" -> "2026.11.12"; missing -> "—". */
export const dotDate = (iso: string | null) => (iso ? iso.slice(0, 10).replaceAll('-', '.') : '—');

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export const languageOf = (r: Pick<Repo, 'language'>) => r.language ?? 'Text';

/** What the page's scripts get about each repository (the waveforms are server-rendered). */
export type Track = Omit<Repo, 'wave'>;

export const toTrack = ({ wave: _wave, ...track }: Repo): Track => track;
