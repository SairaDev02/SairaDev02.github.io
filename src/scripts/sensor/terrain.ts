// Deterministic terrain and Asset placement for the sensor view.

const hash = (x: number, y: number) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const smooth = (t: number) => t * t * (3 - 2 * t);
const vnoise = (x: number, y: number) => {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = smooth(x - xi);
  const yf = smooth(y - yi);
  const a = hash(xi, yi);
  const b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1);
  const d = hash(xi + 1, yi + 1);
  return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
};
const fbm = (x: number, y: number) => {
  let h = 0;
  let amp = 1;
  let f = 1;
  for (let o = 0; o < 5; o++) {
    h += amp * vnoise(x * f, y * f);
    amp *= 0.5;
    f *= 2.03;
  }
  return h;
};

/** Terrain height: a ridge across the middle and a basin in front of the camera. */
export const height = (x: number, z: number) =>
  (fbm(x * 0.035 + 7.3, z * 0.035 - 2.1) - 0.9) * 16 + 6 * Math.exp(-((x * 0.04) ** 2)) - 4 * Math.exp(-((z - 25) ** 2) / 400);

/** Where Asset `i` stands on the ground plane: a golden-angle spiral seeded by its name. */
export const placeAsset = (i: number, name: string) => {
  const seed = [...name].reduce((a, ch) => a + ch.charCodeAt(0), 0);
  const a = i * 2.399 + (seed % 10) * 0.05;
  const r = 14 + 9 * Math.sqrt(i + 0.5) + (seed % 7);
  return { x: Math.cos(a) * r, z: Math.sin(a) * r * 0.8 };
};
