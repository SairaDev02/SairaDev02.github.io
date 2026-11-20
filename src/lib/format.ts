// Display formats shared by the server-rendered page and its scripts.
import type { Repo } from './github';

/** An Asset's tag from its zero-based index: 0 -> "A-01". */
export const assetTag = (i: number) => `A-${String(i + 1).padStart(2, '0')}`;

/** "2026-11-12T…" -> "2026.11.12"; missing -> "—". */
export const dotDate = (iso: string | null) => (iso ? iso.slice(0, 10).replaceAll('-', '.') : '—');

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export const languageOf = (r: Pick<Repo, 'language'>) => r.language ?? 'Text';

/** An Asset is Active when its repository was pushed within this many days. */
export const ACTIVE_DAYS = 30;

/** Active (pushed within the last 30 days of `now`) or Dormant. */
export const isActive = (pushedAt: string, now: Date) => now.getTime() - Date.parse(pushedAt) <= ACTIVE_DAYS * 86_400_000;

/**
 * The clock that decides Active: the build time. BUILD_NOW pins it, so the e2e build has
 * fixed statuses whatever day it runs.
 */
export const buildNow = (): Date => {
  const pinned: string | undefined = import.meta.env.BUILD_NOW;
  return pinned ? new Date(pinned) : new Date();
};
