// Preview: which Asset is shown as previewed. One at a time, and it changes nothing else.
//
//   setPreview(index | null) -> previews that Asset, or clears the Preview.
//   getPreview()             -> the previewed Asset's index, or null.
//   onPreview(listener)      -> calls `listener(index | null)` whenever the Preview
//                               changes; returns an unsubscribe function.
//
// The board's rows set it (a pointer on a row, focus on a row; leaving and blur clear it).
// The sensor view subscribes to show brackets and the card, and sets it itself when an
// Asset is pointed at or first-tapped. A Preview is never announced.

let current: number | null = null;
const listeners = new Set<(index: number | null) => void>();

export const getPreview = () => current;

/** Previews the Asset at `index`; null clears. Listeners run only when it changes. */
export const setPreview = (index: number | null) => {
  if (index === current) return;
  current = index;
  for (const listener of listeners) listener(index);
};

/** Calls `listener` whenever the Preview changes. Returns a function that stops it. */
export const onPreview = (listener: (index: number | null) => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};
