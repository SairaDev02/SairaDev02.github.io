// The Open route: the one way the page opens an Asset's repository, shared by the asset
// board and the sensor view.
//
//   openAsset(asset)   -> opens the Asset's repository, or announces the Blocked tab.
//   isOpened(index)    -> whether the Asset was opened during this visit.
//   onOpened(listener) -> calls `listener(asset)` after each successful Open; returns an
//                         unsubscribe function. The board marks its rows through this.
//
// Call `openAsset` synchronously inside the user's gesture handler (click, Enter, tap):
// the browser only allows the new tab there. The route then
//   1. calls window.open(url, '_blank') (not `noopener` in the features: that always
//      returns null and would hide a block),
//   2. treats null as a blocked tab: announces "New tab blocked. Click <name> again, or
//      use the link's menu" and marks nothing,
//   3. otherwise sets `opener = null`, marks the Asset Opened (in memory, for the visit),
//      notifies subscribers and announces "Opened <name> in a new tab".
// Announcements go to the page's one polite status region, `[data-status]`.

import type { Asset } from './assets';

const opened = new Set<number>();
const listeners = new Set<(asset: Asset) => void>();

/** Whether the Asset was opened during this visit. */
export const isOpened = (index: number) => opened.has(index);

/** Calls `listener` after each successful Open. Returns a function that stops it. */
export const onOpened = (listener: (asset: Asset) => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

/** The page's one status region: Open and blocked-tab messages only. */
const announce = (message: string) => {
  const region = document.querySelector<HTMLElement>('[data-status]');
  if (!region) return;
  // Clearing first lets the same message be announced again on a repeat.
  region.textContent = '';
  requestAnimationFrame(() => (region.textContent = message));
};

/** Opens the Asset's repository in a new tab; when the browser blocks it, says so and marks nothing. */
export function openAsset(asset: Asset) {
  const win = window.open(asset.url, '_blank');
  if (!win) {
    announce(`New tab blocked. Click ${asset.name} again, or use the link's menu`);
    return;
  }
  win.opener = null;
  opened.add(asset.index);
  for (const listener of listeners) listener(asset);
  announce(`Opened ${asset.name} in a new tab`);
}
