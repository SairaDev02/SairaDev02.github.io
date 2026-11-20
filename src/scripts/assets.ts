// The Assets of the page, read from the asset board's rows (the board is the one place the
// server renders them). The sensor view reads its Assets from here too, so the view and
// the board always agree on index, tag and details.
//
// An Asset's index is its zero-based position on the board: the row's `data-asset`.
import type { AssetStatus } from '../lib/format';

export interface Asset {
  /** Zero-based position on the board; the key every module shares. */
  index: number;
  /** "A-01" onwards, matching the board number. */
  tag: string;
  name: string;
  /** The repository's URL: what Open opens. */
  url: string;
  /** "Text" when the repository has no language. */
  language: string;
  commits: number;
  /** Last push, "2026.10.20". */
  pushed: string;
  /** Active: pushed within the last 30 days. */
  status: AssetStatus;
}

/** The board's rows, in order. */
export const boardRows = (): HTMLAnchorElement[] => [...document.querySelectorAll<HTMLAnchorElement>('a[data-asset]')];

const isStatus = (value: string | undefined): value is AssetStatus => value === 'active' || value === 'dormant';
const count = (value: string | undefined) => (value !== undefined && /^\d+$/.test(value) ? Number(value) : null);

/**
 * The Asset a board row stands for, or null when the row's data is malformed. The server
 * writes every row, so a malformed one is a build bug: it is left out rather than shown wrong.
 */
export const assetOf = (row: HTMLAnchorElement): Asset | null => {
  const { asset, tag, name, language, commits, pushed, status } = row.dataset;
  const index = count(asset);
  const commitCount = count(commits);
  if (index === null || commitCount === null || !tag || !name || !language || !pushed || !isStatus(status)) return null;
  return { index, tag, name, url: row.href, language, commits: commitCount, pushed, status };
};

/** Every well-formed Asset, in board order. */
export const readAssets = (): Asset[] => boardRows().flatMap((row) => assetOf(row) ?? []);
