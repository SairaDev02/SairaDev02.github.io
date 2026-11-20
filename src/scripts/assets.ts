// The Assets of the page, read from the asset board's rows (the board is the one place the
// server renders them). The sensor view reads its Assets from here too, so the view and
// the board always agree on index, tag and details.
//
// An Asset's index is its zero-based position on the board: the row's `data-asset`.

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
  /** Pushed within the last 30 days. */
  active: boolean;
}

/** The board's rows, in order. */
export const boardRows = (): HTMLAnchorElement[] => [...document.querySelectorAll<HTMLAnchorElement>('a[data-asset]')];

/** The Asset a board row stands for. */
export const assetOf = (row: HTMLAnchorElement): Asset => ({
  index: Number(row.dataset.asset),
  tag: row.dataset.tag!,
  name: row.dataset.name!,
  url: row.href,
  language: row.dataset.language!,
  commits: Number(row.dataset.commits),
  pushed: row.dataset.pushed!,
  active: row.dataset.status === 'active',
});

/** Every Asset, in board order. */
export const readAssets = (): Asset[] => boardRows().map(assetOf);
