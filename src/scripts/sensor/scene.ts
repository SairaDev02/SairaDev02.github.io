// The sensor view: a three.js terrain with one Asset per repository, rendered at a low
// pixel grid and printed in process inks. This module is the lazy chunk (boot.ts loads it
// after the page has painted); the DOM HUD is built here with DOM methods only.
//
// Separations: the scene renders to a target whose channels carry inks (red: terrain tone
// in four levels; green: live, full, or the highlighter, up to half; blue: focus), and one
// full-screen pass quantizes them through an 8x8 Bayer matrix, each ink offset a few
// pixels. Light multiplies the inks onto paper; Dark replaces on key black, focus on top.
//
// Frame loop and scaling are the site's own (render/canvas.ts frameLoop): 30 fps, still
// frames until the first input, paused off screen and in hidden tabs, one still frame under
// reduced motion; the grid is scaled by whole device pixels with its width following the
// frame. A Preview reaches the scene through preview.ts (onPreview); the view sets it too.
import {
  BufferAttribute,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  LinearSRGBColorSpace,
  Mesh,
  MeshBasicMaterial,
  NearestFilter,
  OctahedronGeometry,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  Raycaster,
  RingGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three';
import { plural } from '../../lib/format';
import { frameLoop } from '../render/canvas';
import { BAYER_GLSL, inkOf } from '../gpu/bayer';
import { type Asset, readAssets } from '../assets';
import { isOpened, onOpened, openAsset } from '../open';
import { getPreview, onPreview, setPreview } from '../preview';
import { currentTheme, onThemeChange } from '../theme';
import { height, placeAsset } from './terrain';

/** Base grids (device pixels at scale 1): wide, and portrait on phones. */
const WIDE = { w: 512, h: 224 };
const TALL = { w: 256, h: 320 };
const SIZE = 280; // terrain side, world units: wide enough to reach the haze
const PICK = 28; // CSS px

const terrainVert = /* glsl */ `
  varying vec3 vPos;
  varying vec3 vNormal;
  void main() {
    vPos = position;
    vNormal = normal;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const terrainFrag = /* glsl */ `
  uniform float uSweep;
  uniform vec3 uPointer;
  uniform float uPointerOn;
  uniform float uPaperMode;
  varying vec3 vPos;
  varying vec3 vNormal;
  void main() {
    vec3 n = normalize(vNormal);
    // Low sun from the left: slopes read as light and shadow, flats stay dark.
    float diff = pow(max(dot(n, normalize(vec3(-0.75, 0.55, 0.35))), 0.0), 1.6);
    float c = abs(fract(vPos.y * 0.25) - 0.5);
    float contour = 1.0 - smoothstep(0.0, 0.035, c);
    vec2 g = abs(fract(vPos.xz / 20.0) - 0.5);
    float grid = smoothstep(0.485, 0.5, max(g.x, g.y));
    float lum = 0.02 + 0.72 * diff + 0.2 * contour + 0.1 * grid;
    // Radar sweep: a bright leading edge with a fading trail.
    float ang = atan(vPos.z, vPos.x);
    float d = mod(uSweep - ang, 6.2831853);
    float sweep = exp(-d * 2.5) * smoothstep(80.0, 10.0, length(vPos.xz));
    // Pointer: a hot dot and a ring where the cursor meets the ground.
    float pd = length(vPos.xz - uPointer.xz);
    float hot = uPointerOn * (1.0 - smoothstep(0.6, 1.2, pd));
    float pring = uPointerOn * (1.0 - smoothstep(0.0, 0.3, abs(pd - 4.0)));
    float fog = smoothstep(70.0, 190.0, length(cameraPosition - vPos));
    // The sweep and the pointer are the yellow highlighter (green at half scale: full
    // green means live, cyan), kept out of the terrain's tone.
    float mark = clamp(sweep * 0.55 + pring + hot, 0.0, 1.0) * (1.0 - fog);
    // On paper red is ink: a hillshade the right way round, contours and grid as dark lines.
    float tone = uPaperMode > 0.5 ? max(0.62 * (1.0 - diff), max(0.9 * contour, 0.4 * grid)) : lum;
    gl_FragColor = vec4(mix(tone, 0.0, fog), 0.5 * mark, 0.0, 1.0);
  }
`;
const printFrag = /* glsl */ `
  uniform sampler2D tScene;
  uniform vec2 uRes;
  uniform vec3 uLevels[4];
  uniform vec3 uC;
  uniform vec3 uM;
  uniform vec3 uY;
  uniform float uPaperMode;
  ${BAYER_GLSL}
  void main() {
    vec2 p = gl_FragCoord.xy;
    vec4 s = texture2D(tScene, p / uRes);
    // Each ink is screened through the same matrix, offset so the dots sit beside each other.
    float tk = bayer8(p);
    float tm = bayer8(p + vec2(2.0, 5.0));
    float ty = bayer8(p + vec2(6.0, 3.0));
    float live = step(0.75, s.g);
    float mark = (1.0 - live) * s.g * 2.0;
    float v = clamp(s.r, 0.0, 1.0) * 3.0;
    float lv = clamp(floor(v) + step(tk, fract(v)), 0.0, 3.0);
    vec3 col = lv < 0.5 ? uLevels[0] : lv < 1.5 ? uLevels[1] : lv < 2.5 ? uLevels[2] : uLevels[3];
    if (uPaperMode > 0.5) {
      if (mark > ty) col *= uY;
      if (live > 0.5) col *= uC;
      if (s.b > tm) col *= uM;
    } else {
      if (mark > ty) col = uY;
      if (live > 0.5) col = uC;
      if (s.b > tm) col = uM;
    }
    gl_FragColor = vec4(col, 1.0);
  }
`;

/** A DOM element with a class and optional text: the HUD is built with these, never from strings. */
const make = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) => {
  const el = document.createElement(tag);
  el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
};

type Box = { x: number; y: number; w: number; h: number };
const overlap = (a: Box, b: Box) =>
  Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

export function mountSensor(frame: HTMLElement) {
  const assets: Asset[] = readAssets();
  let renderer: WebGLRenderer;
  const canvas = make('canvas', 'sensor-canvas');
  try {
    renderer = new WebGLRenderer({ canvas, antialias: false });
  } catch {
    return; // No WebGL: the board below is the whole interface.
  }
  canvas.setAttribute('role', 'img');
  canvas.setAttribute(
    'aria-label',
    `Sensor view of terrain with ${assets.length} assets, one per public repository. The asset board below lists the same repositories.`,
  );
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = LinearSRGBColorSpace;
  const narrow = matchMedia('(max-width: 600px)');
  let W = WIDE.w;
  let H = WIDE.h;
  const target = new WebGLRenderTarget(W, H, { magFilter: NearestFilter, minFilter: NearestFilter });

  // ---------- scene ----------
  const scene = new Scene();
  scene.background = new Color(0, 0, 0);
  const camera = new PerspectiveCamera(38, W / H, 1, 400);
  const geo = new PlaneGeometry(SIZE, SIZE, 220, 220);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as BufferAttribute;
  for (let i = 0; i < pos.count; i++) pos.setY(i, height(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();
  const light = () => (currentTheme() === 'light' ? 1 : 0);
  const uniforms = { uSweep: { value: 0 }, uPointer: { value: new Vector3() }, uPointerOn: { value: 0 }, uPaperMode: { value: light() } };
  const terrain = new Mesh(geo, new ShaderMaterial({ vertexShader: terrainVert, fragmentShader: terrainFrag, uniforms }));
  scene.add(terrain);

  // Markers: a spinning octahedron on a mast over a ground ring. Colour is the separations.
  const markers = assets.map((asset) => {
    const { x, z } = placeAsset(asset.index, asset.name);
    const group = new Group();
    group.position.set(x, height(x, z), z);
    const core = new Mesh(new OctahedronGeometry(1.7), new MeshBasicMaterial());
    core.position.y = 6;
    const mast = new Mesh(new CylinderGeometry(0.12, 0.12, 6, 4), new MeshBasicMaterial({ color: new Color(0.9, 0, 0) }));
    mast.position.y = 3;
    const ring = new Mesh(new RingGeometry(3, 3.6, 40), new MeshBasicMaterial({ side: DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.3;
    group.add(core, mast, ring);
    scene.add(group);
    return { core, ring };
  });

  // ---------- print pass ----------
  const post = new Scene();
  const postCam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const printUniforms = {
    tScene: { value: target.texture },
    uRes: { value: new Vector2(W, H) },
    uLevels: { value: [new Color(), new Color(), new Color(), new Color()] },
    uC: { value: new Color() },
    uM: { value: new Color() },
    uY: { value: new Color() },
    uPaperMode: { value: light() },
  };
  /** Reads the inks and terrain levels from the page's custom properties. */
  const recolour = () => {
    uniforms.uPaperMode.value = printUniforms.uPaperMode.value = light();
    [0, 1, 2, 3].forEach((n) => printUniforms.uLevels.value[n].copy(inkOf(`--terrain-${n}`)));
    printUniforms.uC.value.copy(inkOf('--ink-c'));
    printUniforms.uM.value.copy(inkOf('--ink-m'));
    printUniforms.uY.value.copy(inkOf('--ink-y'));
  };
  recolour();
  post.add(
    new Mesh(
      new PlaneGeometry(2, 2),
      new ShaderMaterial({ fragmentShader: printFrag, uniforms: printUniforms, vertexShader: 'void main(){gl_Position=vec4(position.xy,0.,1.);}' }),
    ),
  );
  // Compile both programs now, before the first frame, so no frame pays for it.
  renderer.compile(scene, camera);
  renderer.compile(post, postCam);

  // ---------- HUD (aria-hidden; the board is the accessible version) ----------
  const hud = make('div', 'sensor-hud');
  hud.setAttribute('aria-hidden', 'true');
  for (const c of ['tl', 'tr', 'bl', 'br']) hud.append(make('i', `corner ${c}`));
  const hint = make('span', 'readout tl');
  const setHint = () => (hint.textContent = narrow.matches ? 'Tap an asset, again to open' : 'Point at an asset · click to open');
  setHint();
  const clock = make('span', 'readout tr clock', '--:--:-- UTC');
  const coord = make('span', 'readout bl grid', 'Grid ---.- / ---.-');
  const activeCount = assets.filter((a) => a.active).length;
  const count = make('span', 'readout br count', `${String(assets.length).padStart(2, '0')} assets · ${activeCount} active`);
  const crossX = make('i', 'cross-x');
  const crossY = make('i', 'cross-y');
  const lock = make('div', 'lock');
  lock.hidden = true;
  for (let i = 0; i < 4; i++) lock.append(make('i', ''));
  const card = make('div', 'card');
  card.dataset.sensorCard = '';
  card.hidden = true;
  const cardStatus = make('b', 'card-status');
  const cardName = make('strong', 'card-name');
  const cardMeta = make('span', 'card-line');
  const cardSeen = make('span', 'card-line');
  card.append(cardStatus, cardName, cardMeta, cardSeen);
  hud.append(hint, clock, coord, count, crossX, crossY, lock);
  const tags = assets.map((asset) => {
    const el = make('span', `tag${asset.active ? ' is-live' : ''}`, asset.tag);
    el.dataset.sensorTag = asset.tag;
    hud.append(el);
    return el;
  });
  hud.append(card);
  frame.append(canvas, hud);
  const tick = () => (clock.textContent = `${new Date().toISOString().slice(11, 19)} UTC`);
  tick();
  setInterval(tick, 1000);

  // Whole-pixel scale: k device pixels per grid pixel, the grid widened to fill the frame.
  const resize = () => {
    const base = narrow.matches ? TALL : WIDE;
    const dpr = devicePixelRatio || 1;
    const avail = Math.floor(frame.clientWidth * dpr);
    const k = Math.max(1, Math.round(avail / base.w));
    W = Math.floor(avail / k);
    H = Math.round((W * base.h) / base.w);
    renderer.setSize(W, H, false);
    target.setSize(W, H);
    printUniforms.uRes.value.set(W, H);
    camera.aspect = W / H;
    // Phones: the picture sits higher, leaving the bottom of the view for the docked card.
    if (narrow.matches) camera.setViewOffset(W, H, 0, Math.round(H * 0.14), W, H);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    canvas.style.width = `${(W * k) / dpr}px`;
    canvas.style.height = `${(H * k) / dpr}px`;
    loop.redraw();
  };

  // ---------- pointer ----------
  const ray = new Raycaster();
  const ndc = new Vector2();
  let pointer: { x: number; y: number } | null = null;
  const screen = assets.map(() => ({ x: 0, y: 0 }));
  /** The Preview was set by this view (not by a row), so only this view clears it. */
  let mine = false;
  const pick = (p: { x: number; y: number }) => {
    let best = -1;
    let bestD = PICK;
    screen.forEach((s, i) => {
      const d = Math.hypot(s.x - p.x, s.y - p.y);
      if (d < bestD) (bestD = d), (best = i);
    });
    return best;
  };
  const local = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height };
  };
  frame.addEventListener('pointermove', (e) => {
    // A finger only taps (below); its moves are page scrolls.
    if (e.pointerType === 'touch') return;
    const p = local(e);
    pointer = p;
    ndc.set((p.x / p.w) * 2 - 1, -(p.y / p.h) * 2 + 1);
    crossX.style.translate = `0 ${p.y}px`;
    crossY.style.translate = `${p.x}px 0`;
    hud.classList.add('has-pointer');
    ray.setFromCamera(ndc, camera);
    const g = ray.intersectObject(terrain, false)[0];
    if (g) {
      uniforms.uPointer.value.copy(g.point);
      uniforms.uPointerOn.value = 1;
      coord.textContent = `Grid ${(g.point.x + 500).toFixed(1)} / ${(g.point.z + 500).toFixed(1)} · El ${(g.point.y * 12 + 300).toFixed(0)} m`;
    }
    const i = pick(p);
    if (i >= 0) (mine = true), setPreview(i);
    else if (mine) (mine = false), setPreview(null);
    frame.style.cursor = i >= 0 ? 'pointer' : 'crosshair';
    loop.redraw();
  });
  frame.addEventListener('pointerleave', (e) => {
    // A finger "leaves" as it lifts: keep what it acquired on screen.
    if (e.pointerType === 'touch') return;
    pointer = null;
    uniforms.uPointerOn.value = 0;
    hud.classList.remove('has-pointer');
    if (mine) (mine = false), setPreview(null);
    loop.redraw();
  });
  // Touch has no hover: the first tap previews an Asset, a second tap on the same one opens
  // it, a tap on bare ground clears. pointerup carries the user activation the new tab
  // needs. The click that follows a touch is ignored.
  let touched = false;
  frame.addEventListener('pointerup', (e) => {
    if (e.pointerType !== 'touch') return;
    touched = true;
    const i = pick(local(e));
    if (i < 0) (mine = false), setPreview(null);
    else if (getPreview() === i) openAsset(assets[i]);
    else (mine = true), setPreview(i);
  });
  frame.addEventListener('click', () => {
    if (touched) return void (touched = false);
    const i = pointer ? pick(pointer) : -1;
    if (i >= 0) openAsset(assets[i]);
  });

  // ---------- card placement ----------
  // The card goes beside its marker wherever (right, left, below, above) it hides the least
  // of the other tags, markers and corner readouts, inside the view. It keeps its spot
  // until another is clearly better (150 px2), so it doesn't flicker as the view turns.
  const tagAt = assets.map(() => ({ x: 0, y: 0 }));
  const readouts = [hint, clock, coord, count];
  let side = 0;
  const placeCard = (p: { x: number; y: number }, cw: number, ch: number, focus: number) => {
    const w = card.offsetWidth;
    const h = card.offsetHeight;
    const gap = 26;
    const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));
    const obstacles: Box[] = [
      { x: p.x - gap, y: p.y - gap, w: gap * 2, h: gap * 2 }, // its own marker and brackets
      ...readouts.filter((c) => c.offsetWidth).map((c) => ({ x: c.offsetLeft, y: c.offsetTop, w: c.offsetWidth, h: c.offsetHeight })),
    ];
    assets.forEach((_, i) => {
      if (i === focus) return;
      obstacles.push({ x: tagAt[i].x - 4, y: tagAt[i].y - 4, w: tags[i].offsetWidth + 8, h: tags[i].offsetHeight + 8 });
      obstacles.push({ x: screen[i].x - 10, y: screen[i].y - 10, w: 20, h: 20 });
    });
    // Every spot that still touches the marker, sliding along each side in small steps.
    // Level with the marker is preferred; each step away costs a little.
    const spots: { x: number; y: number; pen: number }[] = [];
    for (let dy = 12 - h; dy <= -12; dy += 6) {
      const pen = Math.abs(dy + 18);
      spots.push({ x: p.x + gap, y: p.y + dy, pen }, { x: p.x - gap - w, y: p.y + dy, pen: pen + 4 });
    }
    for (let dx = 20 - w; dx <= -20; dx += 10) {
      const pen = 60 + Math.abs(dx + w / 2) * 0.5;
      spots.push({ x: p.x + dx, y: p.y + gap, pen }, { x: p.x + dx, y: p.y - gap - h, pen: pen + 4 });
    }
    const boxes = spots.map((s) => ({ x: clamp(s.x, 8, cw - w - 8), y: clamp(s.y, 8, ch - h - 8), w, h }));
    const cost = boxes.map((b, k) => obstacles.reduce((sum, o, j) => sum + overlap(b, o) * (j === 0 ? 4 : 1), 0) + spots[k].pen);
    const best = cost.indexOf(Math.min(...cost));
    if (side < 0 || side >= cost.length || cost[best] < cost[side] - 150) side = best;
    return boxes[side];
  };

  // ---------- frame ----------
  const v = new Vector3();
  // Motion time, continuous across the still frames and the running loop.
  let time = 4;
  let prev = 0;
  let shown = -2;
  let shownText = '';
  const restart = (el: HTMLElement, name: string) => {
    el.classList.remove(name);
    void el.offsetWidth; // restart the animation
    el.classList.add(name);
  };
  const frameFn = (t: number, still: boolean) => {
    if (still) prev = 0;
    else {
      if (prev) time += Math.min(t - prev, 0.1);
      prev = t;
    }
    const lean = pointer ? (pointer.x / canvas.clientWidth - 0.5) * 0.15 : 0;
    const R = narrow.matches ? 110 : 92;
    camera.position.set(Math.sin(time * 0.05 + lean) * R, narrow.matches ? 74 : 52, Math.cos(time * 0.05 + lean) * R);
    camera.lookAt(0, -6, 0);
    uniforms.uSweep.value = ((time * 0.9) % (Math.PI * 2)) - Math.PI;

    const preview = getPreview();
    const focus = preview ?? -1;
    markers.forEach((m, i) => {
      const sel = i === focus;
      m.core.rotation.y = time * (sel ? 3 : 0.6);
      m.ring.scale.setScalar(sel ? 1.25 : 1);
      // Separations: focus is magenta (blue) alone, live is cyan (green), the rest K (red).
      const core = (m.core.material as MeshBasicMaterial).color;
      if (sel) core.setRGB(0, 0, 1);
      else if (assets[i].active) core.setRGB(0, 1, 0);
      else core.setRGB(0.9, 0, 0);
      (m.ring.material as MeshBasicMaterial).color.setRGB(sel ? 0 : 0.9, 0, sel ? 1 : 0);
    });

    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(post, postCam);

    // Tags follow their markers, nudged down where two would overlap, flipped at the edge.
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    markers.forEach((m, i) => {
      m.core.getWorldPosition(v).project(camera);
      screen[i] = { x: (v.x * 0.5 + 0.5) * cw, y: (-v.y * 0.5 + 0.5) * ch };
    });
    const placed: { x: number; y: number }[] = [];
    [...screen.keys()]
      .sort((a, b) => screen[a].y - screen[b].y)
      .forEach((i) => {
        const opened = isOpened(i);
        const text = opened ? `${assets[i].tag} ↗` : assets[i].tag;
        if (tags[i].textContent !== text) tags[i].textContent = text;
        const tw = tags[i].offsetWidth || 44;
        let x = screen[i].x + 14;
        const y0 = screen[i].y - 9;
        let y = y0;
        if (x + tw > cw) x = screen[i].x - 14 - tw;
        while (placed.some((p) => Math.abs(p.x - x) < tw + 2 && Math.abs(p.y - y) < 20)) y += 20;
        placed.push({ x, y });
        tagAt[i] = { x, y };
        tags[i].style.translate = `${x}px ${y}px`;
        tags[i].classList.toggle('is-sel', i === focus);
        tags[i].classList.toggle('is-opened', opened);
        tags[i].classList.add('is-placed');
      });

    // The previewed Asset: brackets on the marker and the card.
    const narrowNow = narrow.matches;
    if (focus >= 0) {
      const a = assets[focus];
      const p = screen[focus];
      lock.style.translate = `${p.x}px ${p.y}px`;
      const text = `${a.tag} · ${isOpened(focus) ? 'Opened' : 'In view'}`;
      if (focus !== shown || text !== shownText) {
        cardStatus.textContent = text;
        cardName.textContent = a.name.toUpperCase();
        cardMeta.textContent = `${a.language} · ${plural(a.commits, 'commit')}`;
        cardSeen.textContent = `Uplink ${a.pushed} · ${a.active ? 'Active' : 'Dormant'}`;
      }
      if (focus !== shown) {
        card.hidden = lock.hidden = false;
        restart(lock, 'is-locking');
        restart(card, 'is-in');
        side = -1; // a new Asset picks its spot afresh
      }
      let box: Box;
      if (narrowNow) {
        // Phones: docked along the bottom (CSS), where the picture leaves room for it.
        card.style.translate = '';
        box = { x: card.offsetLeft, y: card.offsetTop, w: card.offsetWidth, h: card.offsetHeight };
      } else {
        box = placeCard(p, cw, ch, focus);
        card.style.translate = `${box.x}px ${box.y}px`;
      }
      // Where no spot was clear, a tag under the card moves to the other side of its marker
      // if that side is clear.
      assets.forEach((_, i) => {
        if (i === focus) return;
        const t = { ...tagAt[i], w: tags[i].offsetWidth, h: tags[i].offsetHeight };
        if (!overlap(box, t)) return;
        const flipped = { ...t, x: tagAt[i].x > screen[i].x ? screen[i].x - 14 - t.w : screen[i].x + 14 };
        if (flipped.x >= 0 && flipped.x + t.w <= cw && !overlap(box, flipped)) tags[i].style.translate = `${flipped.x}px ${flipped.y}px`;
      });
      shownText = text;
    } else if (shown !== -1) {
      card.hidden = lock.hidden = true;
      shownText = '';
    }
    shown = focus;
    frame.classList.toggle('has-card', focus >= 0);
    if (!frame.hasAttribute('data-ready')) frame.setAttribute('data-ready', '');
  };
  const loop = frameLoop(canvas, frameFn);
  resize();
  new ResizeObserver(resize).observe(frame);
  narrow.addEventListener('change', () => (setHint(), resize()));
  onPreview(() => loop.redraw());
  onOpened(() => loop.redraw());
  // The theme notification: read the inks again and redraw at once.
  onThemeChange(() => (recolour(), loop.redraw()));
}
