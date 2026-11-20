// The background field: a contour field seen from low altitude, flying slowly forward
// behind the page. Contour lines every 2 units (every fifth brighter), a 16-unit survey
// grid, dithered into the stock toward the horizon and cleared to the stock above it. It
// tilts down as the page scrolls (not under reduced motion) and turns a little with the
// pointer. No ambient pings: only a Preview starts one magenta ping near the viewer.
//
// Drawn at a third of the device resolution and scaled by whole pixels. The frame loop,
// the theme notification and the Preview are the sensor view's (render/canvas.ts, theme.ts,
// preview.ts); the three.js import is the same chunk the view uses.
import { Color, Mesh, PerspectiveCamera, PlaneGeometry, Scene, ShaderMaterial, Vector3, WebGLRenderer, LinearSRGBColorSpace } from 'three';
import { frameLoop, reducedMotion } from '../render/canvas';
import { BAYER_GLSL, inkOf } from '../gpu/bayer';
import { onPreview } from '../preview';
import { onThemeChange } from '../theme';

/** Device pixels per field pixel. */
const K = 3;
const PINGS = 3;
/** A Preview's ping: strength, growth in units per second, life in seconds. */
const PING = { gain: 0.6, speed: 9, life: 2.4 } as const;

const vert = /* glsl */ `
  uniform float uTravel;
  varying vec2 vS;   // ground position in terrain space (moves with the ground)
  varying float vH;
  varying float vDist;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i), b = hash(i + vec2(1, 0)), c = hash(i + vec2(0, 1)), d = hash(i + vec2(1, 1));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  float fbm(vec2 p) { float h = 0.0, a = 0.5; for (int o = 0; o < 4; o++) { h += a * vnoise(p); p *= 2.03; a *= 0.5; } return h; }
  void main() {
    vec3 p = position;
    vS = vec2(p.x, p.z - uTravel);
    vH = (fbm(vS * 0.028 + 11.0) - 0.5) * 30.0;
    p.y = vH;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vDist = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const frag = /* glsl */ `
  uniform vec3 uBg;
  uniform vec3 uLine;
  uniform vec3 uMajor;
  uniform vec3 uPing;
  uniform vec3 uPings[${PINGS}]; // x, z in terrain space; age in seconds (< 0: none)
  varying vec2 vS;
  varying float vH;
  varying float vDist;
  ${BAYER_GLSL}
  void main() {
    float t = bayer8(gl_FragCoord.xy);
    // Full near, gone at the horizon.
    float fade = 1.0 - smoothstep(30.0, 230.0, vDist);
    float minor = 1.0 - smoothstep(0.0, 0.07, abs(fract(vH * 0.5) - 0.5));
    float major = 1.0 - smoothstep(0.0, 0.025, abs(fract(vH * 0.1) - 0.5));
    vec2 g = abs(fract(vS / 16.0) - 0.5);
    float grid = smoothstep(0.48, 0.5, max(g.x, g.y)) * 0.55;
    vec3 col = uBg;
    if (max(minor, grid) * fade > t) col = uLine;
    if (major * fade > t) col = uMajor;
    for (int i = 0; i < ${PINGS}; i++) {
      float age = uPings[i].z;
      if (age < 0.0) continue;
      float d = length(vS - uPings[i].xy);
      float ring = 1.0 - smoothstep(0.0, 0.9, abs(d - age * ${PING.speed.toFixed(1)}));
      float core = 1.0 - smoothstep(0.0, 1.2, d);
      float life = 1.0 - smoothstep(0.0, ${PING.life.toFixed(1)}, age);
      if (max(ring, core * 0.8) * life * fade * ${PING.gain.toFixed(1)} > t) col = uPing;
    }
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function mountField() {
  const canvas = document.createElement('canvas');
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: false, powerPreference: 'low-power' });
  } catch {
    return; // No WebGL: the page simply has no field.
  }
  canvas.className = 'field';
  canvas.dataset.field = '';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = LinearSRGBColorSpace;

  const scene = new Scene();
  const camera = new PerspectiveCamera(55, 1, 1, 400);
  const pings = Array.from({ length: PINGS }, () => new Vector3(0, 0, -1));
  const uniforms = {
    uTravel: { value: 0 },
    uBg: { value: new Color() },
    uLine: { value: new Color() },
    uMajor: { value: new Color() },
    uPing: { value: new Color() },
    uPings: { value: pings },
  };
  const recolour = () => {
    uniforms.uBg.value.copy(inkOf('--bg'));
    uniforms.uLine.value.copy(inkOf('--field-line'));
    uniforms.uMajor.value.copy(inkOf('--field-major'));
    uniforms.uPing.value.copy(inkOf('--ink-m'));
    // Above the horizon is the stock itself.
    renderer.setClearColor(uniforms.uBg.value);
  };
  recolour();
  const geo = new PlaneGeometry(320, 320, 200, 200);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, -100);
  scene.add(new Mesh(geo, new ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms })));

  const resize = () => {
    const dpr = devicePixelRatio || 1;
    const W = Math.ceil((innerWidth * dpr) / K);
    const H = Math.ceil((innerHeight * dpr) / K);
    renderer.setSize(W, H, false);
    canvas.style.width = `${(W * K) / dpr}px`;
    canvas.style.height = `${(H * K) / dpr}px`;
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    loop.redraw();
  };

  // Pings live in terrain space, so they drift toward the viewer with the ground.
  const born = new Array<number>(PINGS).fill(-Infinity);
  let next = 0;
  let travel = 0;
  const ping = () => {
    const k = next++ % PINGS;
    pings[k].set((Math.random() - 0.5) * 50, -travel - 45 - Math.random() * 70, 0);
    born[k] = performance.now() / 1000;
  };

  let px = 0;
  addEventListener('pointermove', (e) => (px = e.clientX / innerWidth - 0.5), { passive: true });

  const loop = frameLoop(canvas, (t, still) => {
    const scroll = still && reducedMotion() ? 0 : scrollY;
    const p = Math.min(1, scroll / Math.max(1, document.documentElement.scrollHeight - innerHeight));
    // Forward travel with time; the page's scroll adds a little and tilts the view down.
    travel = (still ? 6 : t) * 3 + scroll * 0.06;
    uniforms.uTravel.value = travel;
    camera.position.set(px * 6, 26 - p * 6, 0);
    camera.rotation.set(-0.16 - p * 0.42, -px * 0.12, 0, 'YXZ');
    // One still frame (before any input, or under reduced motion) shows no ping.
    pings.forEach((v, i) => {
      const age = t - born[i];
      v.z = still || age > PING.life ? -1 : age;
    });
    renderer.render(scene, camera);
  });
  resize();
  addEventListener('resize', resize);
  // Scrolling reveals a new view even between frames; under reduced motion it changes nothing.
  if (!reducedMotion()) addEventListener('scroll', loop.redraw, { passive: true });
  onThemeChange(() => (recolour(), loop.redraw()));
  onPreview((index) => {
    if (index === null || reducedMotion()) return;
    ping();
  });
}
