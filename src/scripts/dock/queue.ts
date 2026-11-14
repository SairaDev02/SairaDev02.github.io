// Play order for the now-playing dock: a permutation of track indices. Up next is
// everything after the cued track, wrapping round, so prev/next follow the queue.

export type Queue = readonly number[];

export const naturalOrder = (n: number): number[] => Array.from({ length: n }, (_, i) => i);

export function upNext(queue: Queue, cued: number): number[] {
  const at = queue.indexOf(cued);
  return [...queue.slice(at + 1), ...queue.slice(0, at)];
}

export function stepFrom(queue: Queue, cued: number, dir: 1 | -1): number {
  const n = queue.length;
  return queue[(queue.indexOf(cued) + dir + n) % n];
}

/** The cued track first, then the others in random order (Fisher–Yates). */
export function shuffleAround(n: number, cued: number, random: () => number = Math.random): number[] {
  const rest = naturalOrder(n).filter((i) => i !== cued);
  for (let k = rest.length - 1; k > 0; k--) {
    const j = Math.floor(random() * (k + 1));
    [rest[k], rest[j]] = [rest[j], rest[k]];
  }
  return [cued, ...rest];
}

/** Moves next-up entry `from` to position `to`; the queue restarts at the cued track. */
export function reorder(queue: Queue, cued: number, from: number, to: number): number[] {
  const next = upNext(queue, cued);
  const [moved] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(next.length, to)), 0, moved);
  return [cued, ...next];
}
