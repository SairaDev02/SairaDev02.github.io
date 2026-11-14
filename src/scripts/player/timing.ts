// PROTOTYPE (map #35): load sequence, in seconds from the start of a play: the disc lifts,
// travels to the tray and drops in; the play time starts when it lands.
export const LOAD = { lift: 0.3, travel: 1.1, drop: 1.4, spin: 1.8 } as const;

/** Play time; `?playSec=8` shortens it for trying the return without waiting. */
export const PLAY_MS = (Number(new URLSearchParams(location.search).get('playSec')) || 30) * 1000;
