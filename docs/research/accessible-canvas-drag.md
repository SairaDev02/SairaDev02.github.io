# Accessible canvas and drag interaction

Research for issue #38 (child of map #35). Question: how should a canvas picture whose items are dragged (discs into a tray, out of it, into the sky) be made accessible alongside a DOM track list that does the same jobs?

Read 2026-11-14. "Verified" means read on the cited primary page; "inferred" is my reasoning from those pages and the code. Modern Web Guidance v1.0.0 guides have no frontmatter or ID field, so they are cited by file path under `skills/modern-web-guidance/guides/`. There was no existing research-notes convention in the repo; this file sits in `docs/research/`.

## 1. What the code does today

- `src/components/CdPlayer.astro`: `<canvas role="img" aria-label=...>`; the label says the track list below does the same. No focusable children, no per-disc semantics.
- `src/scripts/player/cd-player.ts`: pointer events with capture; a 4 px threshold turns a press into a drag; `pointercancel` cancels; `touchstart` is `preventDefault`ed (non-passive) only when it lands on a disc; canvas has `touch-action: pan-y`. A plain click on a disc already plays it. There is no Escape handling.
- `src/scripts/home.ts` and `TrackList.astro`: each track is a real `<a>` row (an `<ol>`, one tab stop per row); a plain click calls `player.play(i)`. Hover and focus both call `player.hover(i)`.
- `src/components/Lcd.astro`: `.main` has `aria-live="polite" aria-atomic="true"`, and `lcdView` changes it on hover, drag-over-tray and load. So a hover cue is announced (inferred noise; not tested with a screen reader).
- `e2e/a11y.spec.ts`: axe scans the page in static states only. Nothing exercises drag, a status message or a drag alternative.

## 2. Requirements that apply

| SC | Level | Verified requirement | Consequence here |
|---|---|---|---|
| [2.5.7 Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) | AA | Anything done by dragging must be possible with a single pointer without dragging. Sufficient: click an item then click the destination, move buttons, a menu of destinations (technique G219). Keyboard alone does not satisfy it unless the keyboard operation also has controls that can be clicked or tapped. Failure F108. | Each drag job needs a click/tap path: load, eject, drop in the sky. Keyboard-only support is not enough. |
| [2.1.1 Keyboard](https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html) | A | Everything keyboard-operable unless the function depends on the path of movement. "Dragging objects to a location" is explicitly not path-dependent, so it must be keyboard-operable. | The canvas gestures need a keyboard route; the DOM controls provide it. |
| [2.5.8 Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) | AA | Targets at least 24 by 24 CSS px, or a 24 px circle on each undersized target not hitting another target. Exception: another control on the same page does the same job and meets the size ("equivalent"). The page says nothing canvas-specific. | The DOM buttons must be 24 px or larger. Disc hit areas on the canvas are covered by the equivalent exception while the list controls pass (inferred: the page does not address canvas). |
| [2.5.2 Pointer Cancellation](https://www.w3.org/WAI/WCAG22/Understanding/pointer-cancellation.html) | A | Completion on the up-event plus a way to abort. For drag and drop: release outside a valid target returns the item (technique G210). | Already how `endDrag(cancelled)` works; keep drop-on-release and add Escape. |
| [2.5.1 Pointer Gestures](https://www.w3.org/WAI/WCAG22/Understanding/pointer-gestures.html) | A | Applies to multipoint or path-based gestures; a simple drag is not path-based and is covered by 2.5.7 instead. | Not a separate burden. Do not add swipe or flick gestures. |
| [4.1.3 Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | AA | Results of an action and progress, added without a change of focus, must be programmatically determinable (`role=status`, techniques ARIA22, ARIA23, ARIA19). The page warns live regions can be too chatty and advises user testing. `alert` or assertive on unimportant content is a failure. | Loaded, ejected, returned, dropped need a status message. Use polite, not assertive. |
| [2.3.3 Animation from Interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html) | AAA | Motion animation triggered by interaction can be disabled unless essential; technique C39 (`prefers-reduced-motion`). Colour or opacity changes without perceived movement are not motion. | AAA, so not a conformance target at AA, but the site already honours the media query; keep doing so for disc flight, return and eject. |
| [2.2.2 Pause, Stop, Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html) | A | Moving content that starts automatically, lasts over 5 s and sits beside other content needs a pause, stop or hide control. "Starts automatically" includes motion triggered by hover, focus or scrolling into view. | Open point: an ambient sky loop plus a disc that animates back on a timer may count. The render loop already stops under reduced motion; a visible pause control is not designed yet. I did not research 2.2.1 Timing Adjustable for the timed return; flag it for the playback ticket (#41). |

## 3. Keyboard access to canvas items

Verified sources:

- HTML spec (canvas, [best practices](https://html.spec.whatwg.org/multipage/canvas.html#best-practices)): authors "must also provide content that... conveys essentially the same function or purpose"; descendants of `<canvas>` (fallback content) can be focused while the bitmap shows; "authors should have a one-to-one mapping of interactive regions to focusable areas in the fallback content"; focus does not affect mouse events.
- [MDN canvas element](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/canvas): the canvas is a bitmap, not exposed as semantic HTML; "In general, you should avoid using canvas in an accessible website or app." Canvas permits only `a`, `button` and checkbox, radio or button `input` descendants as interactive content.
- [MDN drawFocusIfNeeded](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/drawFocusIfNeeded): Baseline, draws a ring only; the author handles focus events, redraws and hit-testing.
- [ARIA in HTML](https://www.w3.org/TR/html-aria/#el-canvas): canvas has no implicit role; any role is allowed. I did not find, in the part read, a statement about `role=img` and descendants. From the ARIA spec as I know it, `img` has presentational children, which would hide focusable fallback children (unverified here; test if option C is chosen).
- [APG keyboard interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/): a composite widget is one Tab stop; roving `tabindex` moves DOM focus (browser scrolls it into view); `aria-activedescendant` keeps focus on the container and the author scrolls and draws the indicator. Focus must stay visible and never fall to `body`.
- [APG Listbox](https://www.w3.org/WAI/ARIA/apg/patterns/listbox/): no drag-and-drop pattern; the rearrangeable example uses buttons. I only read the listbox page and the keyboard practices page, so I cannot say APG has no drag pattern anywhere.
- Modern Web Guidance `ui-behaviors/drag-and-drop.md` and `ui-behaviors/drag.md`: visible buttons or a menu are the best default alternative; arrow-key and grab-move-drop modes are second choices; `Escape` cancels; use real `<button>` handles with names naming the action; non-drag alternatives for single-pointer users.
- Modern Web Guidance `visual-design/expose-canvas-content-to-browser-features.md` (HTML-in-Canvas, `drawable`): the guide says both "support starts in Chrome 157" and "not natively supported by any major browser yet". Contradictory and Chrome-only at best; treat as not usable for this site yet.

## 4. Options

| | Option | For | Against |
|---|---|---|---|
| A (recommended) | Canvas stays a labelled picture (`role="img"`, one name). The DOM track list is the accessible interface and gains the missing controls. | No second set of items to keep in sync with scaled pixel-grid geometry; one Tab stop per row already exists; single-pointer and keyboard alternatives come from the same buttons; reuses the shared `player` state. | Keyboard and screen-reader users never touch the picture; the label must say so honestly. Eject and sky-drop need a home in the list or the dock. |
| B | Overlay DOM buttons positioned over the discs (roving tabindex, canvas under them). | Keyboard focus appears on the picture itself. | Duplicates the list for assistive tech (two ways to reach every disc); geometry must track the canvas CSS scale and the two grids; overlays can intercept pointer events and break the drag code; more focus-ring styling in the pixel style. |
| C | Focusable fallback buttons inside `<canvas>` plus `drawFocusIfNeeded`. | The HTML spec's own pattern. | Needs a canvas path per disc for the ring and a redraw on focus; collides with `role="img"` (see section 3, unverified); same duplication as B. |
| D | HTML-in-Canvas. | Real DOM drawn in the canvas. | Experimental, guide contradicts itself on support. |

Recommended patterns under A:

1. Keep every canvas gesture as a shortcut, never the only route. Per-track controls in the track list row (or the dock's now-playing controls) cover: load into the player, eject from the player, drop in the sky. Each is a real `<button>` of at least 24 by 24 CSS px (larger under `@media (pointer: coarse)`, per `accessibility/accessibility.md`).
2. Name controls by action and track ("Load X into player", "Eject X"). Where a control toggles Load and Eject, change the label rather than also setting `aria-pressed` (`ui-behaviors/motion.md` warns against both). The Queue panel test in `e2e/a11y.spec.ts` already checks label-content-name mismatch; keep that rule running.
3. Do not add roving focus to the canvas. If the owner wants focus on the picture later, choose B and place overlay geometry from one function shared with `scene.ts` (inferred).
4. Update the canvas `aria-label`: it should name what the picture shows and point to the list controls, without describing the drag (the list is the interface).
5. Add an Escape key handler while a drag is active (the drag guide cancels with Escape; pointer cancellation 2.5.2 is already met by release-outside).

## 5. Announcing state changes without noise

Verified: `role=status` is `aria-live=polite` and `aria-atomic=true` and must not take focus ([MDN status role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/status_role)); 4.1.3 allows it for results and progress; `accessibility/accessibility.md` section 8 says one polite and one assertive region per page, in the DOM from load, assertive only for critical messages, no live region for plain "Loading..." (use progress), debounce rapid updates, and do not send messages into inert DOM; `ui-behaviors/drag-and-drop.md` says announce only committed position changes and cancellations, reset the text and delay about 500 ms so refocus does not swallow it; `ui-components/persistent-toast-notifications.md` says keep the container in the DOM, announce text only.

Recommended (inferred from the above):

- One visually hidden `role="status"` region in the page shell, rendered in the initial HTML, written only by `player-state` transitions.
- Announce: loaded ("X is loading", once), playing, ejected, dropped in the sky, returned to the shelf, and drag cancelled. Do not announce: hover or focus cues, drag-over-tray, animation frames, the 2.4 s load progress.
- Remove `aria-live` from the LCD `.main` (it re-announces every hover cue), and keep the LCD as the visible state. Not tested with a screen reader; verify during implementation with NVDA and VoiceOver as the guide advises.
- The new tab (#41) moves the user away; include "opened in a new tab" in the load message, since it is the result of the action.

## 6. Reduced motion

- Keep `prefers-reduced-motion` handling (already in `render/canvas.ts`). Under it, apply states instantly and draw on demand; do not use a global duration override (`ui-behaviors/motion.md`).
- Final state must still appear: disc in tray, disc back home. Motion guide caveat: `animationend` and `transitionend` never fire when animation is skipped. The code's `player.arrive()` is called from the frame loop, so check the reduced path (`player-state.ts` goes straight to `go(i)` today) for the return step too.
- The return timer and the "playing" state should not depend on animation finishing.
- Use colour or opacity cues rather than movement where a cue is needed.

## 7. Touch versus pointer drag

- Verified: `accessibility/accessibility.md` says not to use `touch-action: none` for custom gestures (scope to an axis such as `pan-y`); `ui-behaviors/drag.md` and `drag-and-drop.md` apply `touch-action: none` only to a small handle, use pointer capture, primary button only, track the `pointerId`, and ignore other pointers.
- Today's code uses `pan-y` plus a non-passive `touchstart` that blocks scroll only on a disc. That matches the intent (page still scrolls elsewhere). Risk (inferred): on a phone, if discs fill most of the canvas, a vertical swipe that starts on a disc drags it instead of scrolling the page; keep the disc footprint small relative to the canvas width, or test on a real device before the spec fixes the layout.
- A tap on a disc already plays it, which is the single-pointer alternative for loading. Eject and sky-drop have no tap route yet, so they need the buttons above.
- DOM buttons are enlarged under `pointer: coarse`.
- Hover cannot be the only way to cue a disc (`user-experience/natural-interactions.md`); focus on list rows already cues, a tap does not cue without playing. Keep it that way, or add select-then-confirm if the spec wants a cue without loading.

## 8. Testing hooks (suggested, not decided)

- Playwright: tab to a row's Load button, press Enter, assert the status region text and the dock; same for Eject.
- Axe scan in the state with a disc loaded (the existing scans are static only).
- A test that no live region text changes on hover.
- Manual: NVDA with Firefox, VoiceOver with Safari, TalkBack, at 200% zoom.

## 9. Sources

WCAG 2.2 Understanding: 2.5.7, 2.5.8, 2.1.1, 4.1.3, 2.3.3, 2.2.2, 2.5.1, 2.5.2 (links in section 2). HTML Standard canvas best practices. MDN: canvas element, drawFocusIfNeeded, status role. ARIA in HTML (canvas). WAI-ARIA APG: keyboard interface practices, Listbox. Modern Web Guidance v1.0.0 (`GoogleChrome/modern-web-guidance`, tag v1.0.0): `accessibility/accessibility.md`, `ui-behaviors/drag-and-drop.md`, `ui-behaviors/drag.md`, `ui-behaviors/motion.md`, `user-experience/natural-interactions.md`, `visual-design/expose-canvas-content-to-browser-features.md`, `ui-components/persistent-toast-notifications.md`, `accessibility/accessible-generated-content.md` (checked: no live-region guidance).

## Mismatches found

- The canvas `aria-label` says the list "does the same"; true today for loading only. It stops being true once eject and sky-drop exist unless the list gains controls (section 4, item 1).
- The LCD live region announces hover cues (section 1).
