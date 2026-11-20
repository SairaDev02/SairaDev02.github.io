// Shared GLSL and palette helpers for the dithered three.js scenes (the sensor view and,
// later, the background field): one 8x8 Bayer matrix, and colours read from the page's
// custom properties as given (no sRGB conversion: the passes carry tone, not light).
import { Color, ColorManagement } from 'three';

ColorManagement.enabled = false;

/** GLSL: `bayer8(gl_FragCoord.xy)` returns a threshold in [0, 1). */
export const BAYER_GLSL = /* glsl */ `
  float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
  float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
  float bayer8(vec2 a) { return bayer4(0.5 * a) * 0.25 + bayer2(a); }
`;

/** A custom property of the root as a three.js Color. */
export const inkOf = (name: string) => new Color(getComputedStyle(document.documentElement).getPropertyValue(name).trim());
