// The shape of a play, in seconds from its press: the disc lifts, travels to the tray,
// drops in and spins up; when it lands the play time starts.
export const LOAD = { lift: 0.3, travel: 1.1, drop: 1.4, spin: 1.8 } as const;

/** How long a play lasts, counted from when the disc lands in the tray. */
export const PLAY_MS = 30_000;
