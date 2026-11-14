# Opening the repository in a new tab: user activation and background-tab timing

Research for issue #39 (child of map #35). Researched 2026-11-14.

Labels: **[spec]** HTML Living Standard text, **[src]** engine source read on `main` on 2026-11-14, **[doc]** vendor or MDN documentation, **[measured]** run here, **[inference]** reasoned from the above and not directly confirmed.

## Short answer

1. **Open at the gesture, not at the end of the animation.** Chromium would still allow a `window.open` 2.4 s after the click (5 s window), and Firefox probably would, but WebKit's source forwards a click to a timer only for 1 s. A `window.open` at 2.4 s is therefore likely blocked in Safari and on iOS. WebKit was not run here, so this is an inference from source.
2. **Letting the anchor open the tab itself is the safest form.** A `target="_blank" rel="noopener"` anchor, or `window.open(url, "_blank", "noopener")` called synchronously in the handler, always runs inside the gesture. A native anchor also keeps Ctrl, Cmd, Shift and middle-click behaviour for free.
3. **Opening at the gesture means the opener tab is usually hidden for the whole play time.** Chromium then throttles timers to one wake-up per second and stops `requestAnimationFrame`. So the play timer must be a wall-clock deadline, not a frame count or a chain of timeouts, and the scene must be redrawn from the clock on return.

## 1. User activation

### Definitions

- Transient activation duration is "a constant number" defined by the user agent and "expected be at most a few seconds"; the standard gives no value. [spec: interaction.html#transient-activation-duration]
- Activation triggering input events (`isTrusted` true): `keydown` (not Esc, not UA-reserved shortcuts), `mousedown`, `pointerdown` **only when `pointerType` is `mouse`**, `pointerup` **only when `pointerType` is not `mouse`**, and `touchend`. [spec: interaction.html#activation-triggering-input-event; same list on MDN, Web/Security/User_activation]
- Consequence: for a mouse, activation starts at **press**, not release. For touch and pen it starts at **release**.
- Consuming activation sets the window's last activation timestamp to negative infinity, in every window of the page. [spec: interaction.html#consume-user-activation]

### `window.open` and `target=_blank`

- Rules for choosing a navigable, `_blank` case: if the active window "does not have transient activation" and a popup blocker is enabled, no new navigable is made; otherwise it **consumes user activation**. [spec: document-sequences.html#the-rules-for-choosing-a-navigable, step 8] One gesture therefore buys one new tab; a second `window.open` after the first has no activation left.
- The same rules apply to link navigation, since "follow the hyperlink" calls them. [spec: links.html#following-hyperlinks, step 7]
- `target="_blank"` implies `noopener` unless the link has `rel=opener`. [spec: links.html#get-an-element's-noopener]
- `window.open(url, "_blank", "noopener")` returns `null` (step 18 of the window open steps). `noopener` and `noreferrer` are stripped before the popup check, so they do not turn the tab into a popup window. An empty feature string is not a popup either. `noreferrer` implies `noopener`. [spec: nav-history-apis.html#window-open-steps, #popup-window-is-requested]
- With `noopener` the opener keeps no handle to the new tab, so it cannot tell when the tab is closed or focused. Any "return" logic has to key off the opener's own `visibilitychange`, `focus` or `pageshow`.

### Engine values

| Engine | Window | Source |
|---|---|---|
| Chromium | **5 s.** `kActivationLifespan = base::Seconds(5)`, with the comment that it should be long enough for network round trips "yet not too long to make an 'unattended' page feel activated". | [src] `third_party/blink/public/common/frame/user_activation_state.h` |
| WebKit | Transient activation is also **5 s** (`defaultTransientActivationDuration { 5_s }`) in `LocalDOMWindow.cpp`, but the popup check is `allowPopUp()`, which tests `UserGestureIndicator::processingUserGesture()`, not the 5 s window. A timer carries the gesture only if it fires within **1 s**: `maximumIntervalForUserGestureForwarding { 1_s }; // One second matches Gecko.` `consumeTransientActivation()` runs when a window is created. | [src] `Source/WebCore/page/LocalDOMWindow.cpp`, `dom/UserGestureIndicator.h`, `page/DOMTimer.cpp` |
| Firefox | **5000 ms** default for `dom.user_activation.transient.timeout`. I did not read the default in `StaticPrefList.yaml` (the fetch truncated); the 5000 default comes from Mozilla Bugzilla 1509933 as returned by search, and a Tor Browser issue (#42869) proposes locking it at 5000. A Gecko test (`dom/base/test/useractivation/test_popup_blocker_async_callback.html`) shows `window.open` allowed from a 500 ms `setTimeout`, `fetch` and service-worker callbacks, and blocked at a 2000 ms timer once the timeout pref is lowered to 1000 ms. Firefox also has `dom.disable_open_click_delay = 1000` (a setTimeout-delay cap on carrying the click permission); I did not establish how it interacts with the activation timeout. | [src] `StaticPrefList.yaml`, Gecko test; Bugzilla 1509933 |

### Is `window.open` at 2.4 s still allowed?

- **Chromium: yes** (5 s). [src] Measured: activation stayed true for about 5.0 s after the click (see Measurements).
- **Firefox: probably yes**, by the activation-timeout test above. Not measured (not installed here).
- **WebKit / Safari / iOS: probably no.** The popup check looks at the live gesture token, and timers forward it for at most 1 s, so a 2.4 s `setTimeout` loses it. This is **[inference]** from source; it was not run. The WebKit tree also has an iOS-specific quirk that can set `popupAllowed` to true, whose conditions I did not read. A WebKit bug thread and developer reports (not primary) say the same: short timers work, 3 s timers get "Popup blocked".
- The only portable design is to call `window.open` (or let the anchor navigate) inside the gesture's event handler.

### What counts as the gesture

- Mouse press (`pointerdown`/`mousedown`) is the activating event. A drag-and-drop release (`pointerup`) does **not** renew activation for a mouse. Touch and pen activate on `pointerup`/`touchend`, so a touch drop does.
- A keyboard press counts (`keydown`), except Esc and reserved shortcuts. Measured: Enter activates, Escape does not.
- `click` itself is not in the trigger list, but it always follows a `mousedown` or touch release that already activated, so a `click` handler is inside the window.
- Dragging an object for longer than 5 s with a mouse leaves a `pointerup` handler with no activation in Chromium. Open on the press, or require the drop within a few seconds. Do not rely on the drop for a mouse.

### Mobile

- iOS Safari uses WebKit's rules above (1 s forwarding). All iOS browsers use WebKit, so Chrome and Firefox on iOS inherit them. **[inference]**
- Android Chrome shares Chromium's 5 s window **[inference]**; Firefox for Android shares Gecko's. None was run.

## 2. Background tab timing

When the new tab takes focus, the opener becomes `hidden`: "the document's tab being in the background … or the device's screen is off" [doc: MDN, Page Visibility API]. `visibilitychange` fires on it.

### requestAnimationFrame and rendering

- "`requestAnimationFrame()` calls are paused in most browsers when running in background tabs." [doc: MDN, Window.requestAnimationFrame]
- The standard allows a non-visible navigable to drop to "4 rendering opportunities per second" and removes hidden documents from the rendering update. The callback timestamp comes from the event loop's last render opportunity time. [spec: webappapis.html#rendering-opportunity, #update-the-rendering]
- The existing canvas loop (and `FALLBACK_MS`) must therefore be treated as paused while hidden. The `go` step at 2.4 s cannot be driven by frames.
- CSS animations and transitions: I found no primary source stating their behaviour when hidden. **[inference]** They run on the document timeline, which advances with rendering, so when the tab becomes visible they show the state for the current time; any logic that depends on `animationend` or `transitionend` may fire late. Not verified.

### Timers

- Spec: a timer waits until the document "has been fully active for a further `timeout` milliseconds (not necessarily consecutively)", with step 4.3 allowing implementation-defined extra waiting; nested timers (level over 5) are clamped to 4 ms. [spec: timers-and-user-prompts.html#run-steps-after-a-timeout, #timer-initialisation-steps] Timers are never exact.
- Chromium (Chrome 88, January 2021): hidden pages with chain count under 5 or hidden under 5 minutes get **basic throttling, timers checked once per second**. **Intensive throttling (once per minute)** needs all of: hidden more than 5 minutes, chain count 5 or more, silent for 30 s, no WebRTC. Pages that played sound in the last 30 s get minimal throttling. [doc: developer.chrome.com/blog/timer-throttling-in-chrome-88; MDN Window.setTimeout agrees]
- Firefox desktop: minimum 1 s for inactive tabs; Firefox for Android: **15 minutes** and may unload the tab; no throttling with an `AudioContext`. Background tracking scripts may be throttled to 10 s after 30 s. [doc: MDN, Window.setTimeout]
- WebKit: hidden pages align timers to a 1 s interval (2015 source, `hiddenPageAlignmentInterval` 1.0), and a 2016 change (bug 154578) made it grow with hidden time. Current Safari behaviour not confirmed. [src history via WebKit Bugzilla 98474, 144155, 154578; weak]
- Frozen pages: "JavaScript timers and fetch callbacks don't run" until resume; `freeze` and `resume` events exist; `pagehide` with `persisted` true means the page enters the back/forward cache; `pageshow` with `persisted` true means restore. [doc: developer.chrome.com/docs/web-platform/page-lifecycle-api]
- iOS tab suspension: no primary source read; assume timers can stop entirely for a hidden or backgrounded page. **[inference]**

### Writing the play timer

- Store a wall-clock deadline when play starts (`Date.now()`, or `performance.now()` plus the start; see below) and derive all progress from `now - start`. Never count frames or accumulate `setTimeout` ticks.
- Arm one `setTimeout(finish, remaining)` as a best effort. In Chromium a single timer on a hidden page fires within about 1 s of its due time (basic throttling); this is documented, not measured here. A single non-chained timer is not subject to intensive throttling (chain count is below 5).
- Also check the deadline from `visibilitychange` (when `visibilityState` becomes `visible`), `pageshow` (including `persisted`), `focus` and `resume`, and call `finish` at once if `now >= deadline`. This covers frozen tabs, suspended mobile tabs and bfcache restores, where the timer may never fire.
- `Date.now()` is wall clock and survives suspend; `performance.now()` is monotonic and may not count time the device slept (platform-dependent; **[inference]**, not verified here). Prefer `Date.now()` for a multi-second deadline that must survive sleep, and guard against backwards clock changes by clamping.
- `finish` must be idempotent (the timer and a visibility check may both run) and must render the final state directly from the clock, without animating through skipped frames.
- On return the user sees whatever the last painted frame was until the first rAF callback; call a synchronous draw (or state apply) from the `visibilitychange` handler to avoid a stale frame flash. **[inference]**

## 3. Modified clicks and keyboard

- Spec leaves open-in-background-tab to the user agent: the standard says only that the UA "may allow the user to indicate a preference regarding whether the hyperlink is to be used for navigation". [spec: links.html]
- `home.ts` already returns early for `button !== 0` and for meta, ctrl, shift or alt, so those keep the browser's native behaviour. Middle-click dispatches `auxclick`, not `click` **[inference, long-standing browser behaviour; not re-verified]**, so it is naturally not intercepted. If the handler is changed to open a tab at the gesture, a `preventDefault` plus `window.open` loses these; letting the anchor navigate natively (`target="_blank" rel="noopener"`) and only listening for the gesture to start the play keeps them.
- A Ctrl/Cmd/middle click opens a **background** tab in most browsers, so the opener stays visible and the animation runs normally. A plain click (new tab in the foreground) is the hidden-opener case.
- Keyboard Enter on a focused anchor counts as activation (`keydown`) and the anchor's activation behaviour follows it.

## 4. Measurements

Script: `docs/research/new-tab-activation/activation-probe.cjs`, output `probe-output.txt`.

- Engine: **Chromium 158.0.8127.18** via `playwright-core` 1.65.0, headless. Firefox and WebKit were **not** installed on this machine (only Chromium), so no cross-engine measurement; nothing was downloaded.
- `page.evaluate` runs with a user gesture and renews activation itself, which first made every reading `true`; the probe now samples `navigator.userActivation.isActive` on an in-page 50 ms timer and reads the log at the end.

Results (activation span, ms from page load; event times alongside):

| Scenario | Activating event at | Activation ended at | Length from the event |
|---|---|---|---|
| Mouse click | pointerdown 311 | 5316 | 5.0 s |
| Mouse down, hold 3 s, release | pointerdown 310, pointerup 3325 | 5313 | 5.0 s from press; **release did not renew it** |
| Enter keydown | 305 | 5364 | 5.06 s |
| Escape keydown | 313 | 5004 (from the setup call at about 50) | **no renewal** |
| Touch tap (synthetic) | pointerdown/up 310 | 5313 | 5.0 s |

The 5 s Chromium window, mouse activation on press, and Esc exclusion match the standard and `user_activation_state.h`. Not measured: popup blocker behaviour (Playwright launches Chromium with popup blocking disabled), hidden-tab throttling (headless pages are never hidden), real touch, other engines.

## 5. Consequences for the design

- The disc "plays" for N seconds while the opener is mostly hidden. Whether the user ever sees the animation depends on whether they return before it ends; the design should be correct under both.
- Open at the gesture. If the owner wants the tab to open at the end of the load animation anyway, that works in Chromium and (probably) Firefox, but is likely blocked in Safari and on iOS, which would need a fallback, such as an "open" affordance on the player, that itself needs a fresh gesture.
- Keep one writer of play state (the existing single-writer `player-state.ts`) holding `{ startedAt, durationMs }`; everything else derives from `Date.now()`.
- Replace the paused-canvas `FALLBACK_MS` navigation with the deadline checks above.

## Sources

- HTML Living Standard: https://html.spec.whatwg.org/multipage/interaction.html (user activation), .../document-sequences.html (rules for choosing a navigable), .../nav-history-apis.html (window open steps, popup check), .../links.html, .../webappapis.html (rendering), .../timers-and-user-prompts.html
- MDN: https://developer.mozilla.org/en-US/docs/Web/Security/User_activation, .../Window/setTimeout, .../Window/requestAnimationFrame, .../Web/API/Page_Visibility_API
- Chrome: https://developer.chrome.com/blog/timer-throttling-in-chrome-88, https://developer.chrome.com/docs/web-platform/page-lifecycle-api
- Chromium source: https://github.com/chromium/chromium/blob/main/third_party/blink/public/common/frame/user_activation_state.h
- WebKit source: https://github.com/WebKit/WebKit/tree/main/Source/WebCore (`page/LocalDOMWindow.cpp`, `dom/UserGestureIndicator.h`, `page/DOMTimer.cpp`); WebKit Bugzilla 98474, 144155, 154578
- Firefox: https://github.com/mozilla-firefox/firefox (`dom/base/PopupBlocker.cpp`, `modules/libpref/init/StaticPrefList.yaml`, `dom/base/test/useractivation/test_popup_blocker_async_callback.html`); Mozilla Bugzilla 1509933
