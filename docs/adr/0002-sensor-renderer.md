# The sensor view renders with lazy-loaded three.js on the GPU

Status: accepted (spec: issue #58; owner's choice of 2026-11-20)

## Context

The sensor view is a dithered 3D terrain with one Asset per repository, printed in process inks. Three ways to draw it were weighed:

- **Today's CPU dither** (`src/scripts/render/dither.ts`, the CD player's renderer). No dependency, but a 3D terrain with markers, shading and an 8x8 Bayer pass in JavaScript keeps the main thread busy: the CD picture measured about 51% busy once running, on a throttled phone profile (375x812 at 3x, CPU 4x slower, slow 4G).
- **Hand-written WebGL2.** Smallest payload, but the owner would maintain the context, buffers, picking maths and shader plumbing by hand.
- **three.js.** The prototype (`prototype/defense` at `c3d5057`, `?d=4`) ran at 11-13% main-thread busy in the same profile. three.js costs about 132 KB gzipped (109 KB Brotli); tree-shaking to named imports does not reduce it (139 KB gzipped), because the WebGL renderer is the floor.

The prototype's weakness was loading: its JS was 155 KB on load, the scene arrived about 2.1 s in, into an unsized frame, and CLS measured 0.408.

## Decision

Use three.js on the GPU, in a separate chunk that is never requested before the load event.

- `src/scripts/sensor/boot.ts` (part of the initial JS) asks `src/scripts/lazy.ts` to load `src/scripts/sensor/scene.ts` when the browser is idle after load, or once the view is within one viewport of the screen and load has fired.
- The frame reserves its box in CSS (aspect ratio 512:224, 256:320 at 600 px and below), so the scene's arrival shifts nothing. The HUD and card are absolutely positioned.
- Shaders compile on mount, before the first frame, which keeps the arrival out of Total Blocking Time.
- The frame loop and whole-pixel scaling stay the site's own (`render/canvas.ts`): 30 fps, still frames until the first input, paused off screen and in hidden tabs, one still frame under reduced motion.

## Consequences

- The scene chunk is about the size of three.js (budget 150 KB gzipped); the initial JS stays within 20 KB gzipped. Neither the page's text nor the board waits for it.
- If WebGL is unavailable the view stays an empty frame and the board remains the whole interface.
- The background field reuses `lazy.ts`, `render/canvas.ts` and `gpu/bayer.ts`.
- Lab numbers come from one machine; the owner confirms 30 fps on a mid-range phone by hand. If it fails, a runtime fallback (drop the field first, then hold a still frame) becomes a follow-up.
