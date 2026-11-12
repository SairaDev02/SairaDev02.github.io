import { describe, expect, it } from 'vitest';
import { WAVE_BINS, binCommits, waveBars } from './wave';

const DAY = 86_400_000;

describe('binCommits', () => {
  it('returns empty bins when there are no commits', () => {
    expect(binCommits([])).toEqual(new Array(WAVE_BINS).fill(0));
  });

  it('spans the first to the last commit: first lands in bin 0, last in the final bin', () => {
    const wave = binCommits([0, 10 * DAY, 100 * DAY], 10);
    expect(wave).toEqual([1, 1, 0, 0, 0, 0, 0, 0, 0, 1]);
  });

  it('counts every commit once, in any input order', () => {
    const dates = [5, 3, 9, 1, 1, 7].map((d) => d * DAY);
    const wave = binCommits(dates, 4);
    expect(wave.reduce((a, b) => a + b, 0)).toBe(6);
    expect(wave[0]).toBe(2); // the two commits on day 1
  });

  it('puts a single commit, or same-day commits, in the first bin', () => {
    expect(binCommits([DAY, DAY], 3)).toEqual([2, 0, 0]);
  });
});

describe('waveBars', () => {
  it('draws empty slices as a 1px line and busy slices at least 2px tall, centred', () => {
    const [empty, one, max] = waveBars([0, 1, 100], { height: 24 });
    expect(empty).toEqual({ x: 0, y: 11.5, h: 1 });
    expect(one.h).toBeGreaterThanOrEqual(2);
    expect(max).toEqual({ x: 6, y: 0, h: 24 });
  });

  it('scales by square root so one busy slice does not flatten the rest', () => {
    const [quarter] = waveBars([25, 100], { height: 20 });
    expect(quarter.h).toBe(10);
  });

  it('can share one scale across waves', () => {
    const [bar] = waveBars([4], { height: 20, max: 16 });
    expect(bar.h).toBe(10);
  });
});
