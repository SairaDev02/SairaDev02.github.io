import { describe, expect, it } from 'vitest';
import { naturalOrder, reorder, shuffleAround, stepFrom, upNext } from './queue';

describe('upNext', () => {
  it('lists everything after the cued track, wrapping round to the start', () => {
    expect(upNext([0, 1, 2, 3], 2)).toEqual([3, 0, 1]);
    expect(upNext([0, 1, 2, 3], 0)).toEqual([1, 2, 3]);
  });
});

describe('stepFrom', () => {
  it('moves along the play order and wraps at both ends', () => {
    const q = [2, 0, 3, 1];
    expect(stepFrom(q, 0, 1)).toBe(3);
    expect(stepFrom(q, 1, 1)).toBe(2);
    expect(stepFrom(q, 2, -1)).toBe(1);
  });
});

describe('shuffleAround', () => {
  it('keeps the cued track first and shuffles the rest into a permutation', () => {
    let seed = 0.7;
    const random = () => (seed = (seed * 9301 + 0.49297) % 1);
    const q = shuffleAround(6, 4, random);
    expect(q[0]).toBe(4);
    expect([...q].sort()).toEqual(naturalOrder(6));
    expect(q).not.toEqual([4, 0, 1, 2, 3, 5]);
  });

  it('handles a single track', () => {
    expect(shuffleAround(1, 0)).toEqual([0]);
  });
});

describe('reorder', () => {
  it('moves a next-up track and rebuilds the queue starting at the cued track', () => {
    // cued 1, next up [2, 3, 0]; move 2 to the end -> [3, 0, 2]
    expect(reorder([0, 1, 2, 3], 1, 0, 2)).toEqual([1, 3, 0, 2]);
    expect(reorder([0, 1, 2, 3], 1, 2, 0)).toEqual([1, 0, 2, 3]);
  });

  it('clamps the target into the list', () => {
    expect(reorder([0, 1, 2], 0, 0, 9)).toEqual([0, 2, 1]);
    expect(reorder([0, 1, 2], 0, 1, -4)).toEqual([0, 2, 1]);
  });
});
