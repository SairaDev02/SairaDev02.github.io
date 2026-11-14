# Live UX audit of the player (issue #36)

Audited 2026-11-14 on https://sairadev02.github.io/ (4 repositories live, so a 2x2 disc grid), Chromium via Playwright, read-only (no login, no forms). Widths 1280x800, 800x900, 375x740 (touch/mobile emulation), plus 1280 with `reducedMotion: 'reduce'`. Code read from `main` at `d266689`.

Files here: `audit.mjs` (main walk), `probe2.mjs` to `probe5.mjs` (follow-ups), `run.txt` and `raw-log.json` (raw output of the main walk; the last run ended on the expected navigation in the reduced-motion block), `shots/` (screenshots).

"Confirmed" means observed in the browser (and, where useful, matched to code). "Suspicion" means inferred from code or only partly reproduced.

## The lead: flat navy frame

- **Not reproduced as described.** Opening Lyrics or Queue never blanked the picture: the canvas kept its 6 colours with the panel open at 1280, 800 and 375, and at 1280x520 (`raw-log.json` "canvas colours with lyrics open"; `shots/probe-short-lyrics.png`).
- **A real flat-navy flash exists, but it comes from resizing across the 600 px breakpoint, panel or not.** At the switch the whole canvas is a single colour, `#13238a` (`--shade-0`, the frame's background), for about 0.1 s here (probe3: last flat sample at 83 to 100 ms; `shots/probe-resize-60ms.png`). Cause (code): `build()` in `cd-player.ts` assigns `canvas.width`/`height`, which clears the canvas, then the next frame takes several yielded tasks before `putImageData`. On a slow phone, rotating with a panel open could make this last long enough to look "stuck until the panel closed" (suspicion; not reproduced).
- The Lyrics panel itself is deep cobalt (`#24409f` to `#0f1c66`) and covers most of the picture on short viewports (defect P1), which is the most likely thing seen as a "navy frame" that "came back" on close.

## Defects

Severity: high = blocks a task, medium = visible or misleading in normal use, low = polish.

### Logic

| # | Defect | Width | Sev | Status |
|---|---|---|---|---|
| L1 | Moving the pointer over a disc or row changes the cued track, so the dock title, and an open Lyrics panel, change on a mere hover. Lyrics re-render and the highlight restarts at the first line (before hover: `01 unmei-vn`, line 2 lit after 6 s; hovering disc 02: `02 pi-tools-saira`, line 0 lit; it does not revert when the pointer leaves). Steps: open Lyrics, wait, hover disc 02 above the panel. `shots/probe-hover-while-lyrics.png`, `probe5.mjs` | 1280 (code: all) | medium | confirmed |
| L2 | Two cue models. After the pointer leaves a disc, the LCD returns to "Drag a disc" while the dock keeps that track. But a cue from the dock (Prev/Next, Queue pick) sets `hover` too, so the disc stays lifted, the LCD shows the track and its row stays highlighted with the equaliser glyph, until the pointer enters and leaves the picture. Steps: Next, or pick a Queue row, then look at the LCD, the row and the disc. `shots/w800-14-queue-open.png` (row 03 lit with equaliser and "Up next" in the dock) | 1280, 800, 375 | medium | confirmed |
| L3 | Shuffle is unreachable on phones without leaving the page: the dock's Shuffle button is `display: none` under 600 px and the Queue panel has no shuffle. The playlist header's Shuffle is `shuffle-play`, which starts a load and navigates after about 2.9 s. | 375 | medium | confirmed (`raw-log.json` "shuffle button hidden in dock") |
| L4 | Escape does not cancel a drag. A disc held over the tray keeps "Release to load" after Escape and loads on release; moving the pointer back out is the only way to cancel. Escape only closes panels. | 1280 | low | confirmed (`probe5.mjs`; no handler in `cd-player.ts`) |
| L5 | A disc dropped on the player body returns to its last resting place, which is the sky spot it was dropped to earlier, not its origin slot. Discs dropped in the sky stay there and can overlap other discs and the body edge; nothing resets them short of a reload. `shots/w1280-05-dropped-sky.png`, `w1280-06-dropped-body.png` | 1280, 800, 375 | low | confirmed (screenshots and `endDrag` in `scene.ts`) |
| L6 | During a load, Prev/Next/Shuffle/Play and Queue rows are still enabled and clicks are silently dropped; no disabled state, no `aria-disabled`. | all | low | confirmed |
| L7 | Under reduced motion, play, a row click, or a drop in the tray navigates immediately, with no "Loading" frame on the LCD or dock. | 1280 rm | low | confirmed (`audit.mjs` rm block: release in tray left the page at once) |
| L8 | Click to navigation takes about 2.9 to 3.4 s (2.4 s load plus navigation); a Back after load returns an idle page with no stuck load and a rendered canvas (but the cue resets to 01). Ruled out: stuck "loading" after Back in Chromium; bfcache itself is not exercised in headless Chromium (unverified). | 1280, 800, 375 | n/a | ruled out / unverified |

Dock Prev/Next/Shuffle/Queue only change the cue and the queue order; nothing plays on the site. That is today's model (map #35), not a new defect.

### Presentation

| # | Defect | Width | Sev | Status |
|---|---|---|---|---|
| P1 | The Lyrics and Queue panels (up to `min(60vh, 520px)`) cover the picture and LCD. At 375x740 the Lyrics panel starts at y=223 and hides most of the picture and the whole LCD; at 1280x520 it starts at y=119 and leaves 33 px of picture. Queue at 375 covers the discs. `shots/w375-13-viewport-lyrics-open-player.png`, `w375-14-queue-open.png`, `probe-short-lyrics.png` | 375, short desktop | medium | confirmed |
| P2 | Flat `#13238a` canvas for about 0.1 s (longer on slow devices) when the viewport crosses 600 px (rotate, resize). See "The lead". `shots/probe-resize-60ms.png` | crossing 600 | low | confirmed flash; persistence suspicion |
| P3 | Queue panel labels the cued track "Now playing" while nothing plays and the dock says "Up next". `shots/w375-14-queue-open.png` | all | low | confirmed (`NowPlaying.astro:27`, `dock.ts:39`) |
| P4 | Under reduced motion the LCD info line is clipped mid-word with no marquee and no ellipsis, so the description is unreadable on screen (full text stays in the DOM). `shots/rm-02-hover.png` | 1280 rm (any width with long text) | medium | confirmed |
| P5 | Small targets: dock Prev/Next/Shuffle/Lyrics/Queue are 32x32, Queue Move buttons 26x26, drag handle 22x26, against 44 CSS px as the comfortable size (24 px is the WCAG 2.2 AA floor, which the handle misses by 2 px, though spacing may excuse it). Play is 56x56. | all (matters at 375) | low | confirmed (measured) |

### Accessibility

| # | Defect | Width | Sev | Status |
|---|---|---|---|---|
| A1 | Focus is hidden behind the fixed dock: there is no `scroll-padding-bottom`, so tabbing to header Play/Shuffle and the footer links lands them under the 72 to 89 px dock (1280: Play and Shuffle, `crates.io` link; 375: track row 04 half hidden). `shots/probe-w1280-focus-under-dock.png`, `probe-w375-focus-under-dock.png` | 1280, 375 | medium | confirmed |
| A2 | Queue Move up/down: when the moved row reaches the first or last place its button is disabled and focus is lost to `<body>` (`document.activeElement` is BODY after Enter). A keyboard user restarts from the top of the page. | 1280 | medium | confirmed |
| A3 | The LCD main region is `aria-live="polite"` and changes on every hover, so a screen-reader user with a pointer gets announcements for each disc passed; the dock title is not live. | all | low | suspicion (not tested with a screen reader) |
| A4 | Ruled out: the canvas has `tabindex -1` (discs are not keyboard operable) but rows, the dock and the Queue buttons give equal paths; Escape closes panels and leaves focus on the toggle; Lyrics/Queue toggles have `aria-expanded` and `aria-controls`. | all | n/a | ruled out |

## Interactions walked

Hover and focus on discs and rows; click and drag to the sky, to the player body, and over the tray (held, then released outside the canvas); drag cancelled by Escape; click on empty body; Prev/Next/Shuffle; Lyrics, Queue, switching between them, Escape; Queue pick, move buttons; Tab order on a fresh load; play through the 2.4 s load (screenshots at 0.3, 1.2 and 1.9 s: `shots/*-17-load-*.png`) followed by the navigation to GitHub and Back; reduced motion hover, Lyrics and tray drop.

## Not verified

- Real touch dragging: Playwright cannot emit multi-point touch drags, so phone drags used mouse events under mobile emulation (`touch-action: pan-y` is set; confirmed only by computed style). Real device pixel ratios above 1 and iOS Safari were not tested.
- bfcache restore (headless Chromium does not reliably use it); screen reader output; slow-device timing of the resize flash.
- Playwright's `isMobile` run reaches GitHub in about 2.9 s; the first run showed 4.2 s because of timing between screenshots, not a defect (probe3 re-measured).
