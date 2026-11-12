// Commit "waveform" of a repository: commit counts in equal slices of the repository's own
// lifetime (first to last commit), so every track spans the full width whatever its age.
// GitHub's stats/participation endpoint was rejected for this: it covers only 52 weeks.

export const WAVE_BINS = 48;

/** Counts commit timestamps (ms) into `bins` equal slices from the first to the last. */
export function binCommits(dates: readonly number[], bins = WAVE_BINS): number[] {
  const wave = new Array<number>(bins).fill(0);
  if (!dates.length) return wave;
  const t0 = Math.min(...dates);
  const span = Math.max(1, Math.max(...dates) - t0);
  for (const d of dates) wave[Math.min(bins - 1, Math.floor(((d - t0) / span) * bins))]++;
  return wave;
}

export interface WaveBar {
  x: number;
  y: number;
  h: number;
}

/** Bar pitch in SVG units: 2 wide, 1 gap. */
export const BAR_PITCH = 3;

/**
 * Bars mirrored about the centre line like an audio waveform. Heights scale by square
 * root so one busy slice does not flatten the rest; empty slices stay a 1px line.
 */
export function waveBars(wave: readonly number[], { height, max }: { height: number; max?: number }): WaveBar[] {
  const top = Math.sqrt(max ?? Math.max(1, ...wave));
  return wave.map((v, i) => {
    const h = v ? Math.max(2, (Math.sqrt(v) / top) * height) : 1;
    return { x: i * BAR_PITCH, y: (height - h) / 2, h };
  });
}
