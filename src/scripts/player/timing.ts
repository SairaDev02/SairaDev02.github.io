// Load sequence, in seconds from the start of a load: the disc lifts, travels to the tray,
// drops in, spins up, and the page navigates to the repository at GO.
export const LOAD = { lift: 0.3, travel: 1.1, drop: 1.4, spin: 1.8, go: 2.4 } as const;

/** Navigate anyway if the picture's loop is paused (off screen) and never arrives. */
export const FALLBACK_MS = (LOAD.go + 1.5) * 1000;
