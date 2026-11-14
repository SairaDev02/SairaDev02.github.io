# Music-app conventions for a portfolio player

Research for issue #37 (child of map #35). Read 2026-11-14. Patterns only; no single app's look or layout is described or recommended.

**Question.** Which interaction conventions of music players carry over to a site that presents repositories as tracks, and which mislead because nothing plays audio?

## The site, as it is and as the owner intends it

- `src/scripts/player-state.ts` is the single writer of `cued` (sticky), `hover` (transient) and `loading`. `play(i)` runs a load animation, then `arrive()` navigates to the repository. Nothing produces audio, and there is no "paused" or "playing" state: only "cued" and "loading".
- `src/scripts/dock/dock.ts` has transport (shuffle, prev, play, next), a waveform whose fill is tied to the load animation (`LOAD.go`), Lyrics (README lines highlighted every 2.6 s) and a Queue panel (reorder by drag or buttons). The kicker reads "Up next" until a load starts, then "Now playing".
- `src/scripts/dock/queue.ts` keeps a permutation and derives "next up" by wrapping round the cued track.
- Owner's direction: play opens the repository in a **new tab**, the disc keeps "playing" in the picture for a set time, then returns.

## What the sources say

### Transport and state

- Platform media controls are derived from player state, not drawn independently. In Android 13+ the first slot shows Play when not playing, a spinner when buffering and Pause when playing; previous and next appear only if the player supports them, and an unsupported slot is left empty or reserved so the others do not shift. [Android: media controls](https://developer.android.com/media/implement/surfaces/mobile)
- Apple: do not repurpose audio controls, keep their meanings consistent, and ignore controls the app does not support. Build custom controls only for commands the system lacks. [HIG: Playing audio](https://developer.apple.com/design/human-interface-guidelines/playing-audio) (read via its JSON mirror, `tutorials/data/design/human-interface-guidelines/playing-audio.json`)
- Apple, for custom players: follow the system player's behaviour closely, because small differences frustrate people who do not know which habits still work; Space should play/pause with a keyboard. [HIG: Playing video](https://developer.apple.com/design/human-interface-guidelines/playing-video)
- The W3C Media Session spec models only `playing`, `paused` and `none`, and says a page should register handlers only for actions it can actually handle. The active session is the one with audio focus: a tab that is playing audio or whose media the user expects to control. This site has no audio, so it should not claim a session. [W3C Media Session](https://www.w3.org/TR/mediasession/)

### Progress and the scrubber

- Android's seek bar maps to playback position and duration; with no duration the seek bar shows no progress. Seeking is a separate capability (`ACTION_SEEK_TO`) the app opts into. [Android: media controls](https://developer.android.com/media/implement/surfaces/mobile)
- Apple: progress indicators are transient, should be determinate when the duration is known, must report accurately (no racing to 90% then crawling), should keep moving, and should offer cancel when feasible. [HIG: Progress indicators](https://developer.apple.com/design/human-interface-guidelines/progress-indicators)
- NN/g: delays over 1 s need an indication that work is under way; over 10 s a percent-done indicator and a way to cancel; 2 to 10 s call for something subtler than a full bar. [NN/g: Response times](https://www.nngroup.com/articles/response-times-3-important-limits/)
- A scrubber that can be dragged is a slider: `role="slider"`, `aria-valuenow/min/max`, `aria-valuetext` where the number is not meaningful, arrow/Home/End keys. The pattern page says nothing about non-interactive progress. [WAI-ARIA APG: Slider](https://www.w3.org/WAI/ARIA/apg/patterns/slider/)

### Mini-player and now-playing

- Android's mini-player pattern (Media3 `MiniController`) is a compact persistent bar showing title, artist, artwork and progress with play/pause, meant to stay while the user browses. [Android Developers Blog: Media3 1.11](https://android-developers.googleblog.com/2026/08/media3-1-11-whats-new.html)
- Apple's HIG has no standalone now-playing section; its only guidance is the watchOS "Now Playing view" so people can control audio without leaving the app. [HIG: Playing audio](https://developer.apple.com/design/human-interface-guidelines/playing-audio)
- Tapping the system media notification opens the app's session activity, i.e. the compact control surface leads to the full player. [Android: media controls](https://developer.android.com/media/implement/surfaces/mobile)

### Queue, reorder and drag

- Apple: offer alternatives to dragging; show a drag image and valid/invalid target feedback; spring the item back on a failed drop; allow undo or cancel. [HIG: Drag and drop](https://developer.apple.com/design/human-interface-guidelines/drag-and-drop)
- WCAG 2.2 SC 2.5.7 (AA): anything done by dragging must also work with a single pointer without dragging; up/down buttons for reordering and click-the-track for sliders are named as valid alternatives. Keyboard support does not satisfy it by itself. [WCAG 2.2: Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html)

### New tab

- NN/g: default to the same tab. A new tab is justified when people need to compare, track several items, or use the original page as a launching point. Warn beforehand with a consistent icon and descriptive text. New tabs break Back, which hurts mobile most. [NN/g: New browser windows and tabs](https://www.nngroup.com/articles/new-browser-windows-and-tabs/)
- WCAG SC 3.2.5 (AAA): context changes such as a new window should happen only on request; advance warning helps people who cannot see the change. [WCAG 2.2: Change on Request](https://www.w3.org/WAI/WCAG22/Understanding/change-on-request.html)

### Moving content and motion

- WCAG SC 2.2.2 (A): moving or auto-updating content that starts automatically, lasts over 5 s and sits beside other content needs pause, stop or hide. Exceptions: essential movement and preload animations the user cannot interact with. The control must not trap focus. [WCAG 2.2: Pause, Stop, Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html)
- SC 2.3.3 (AAA): motion triggered by interaction can be turned off; `prefers-reduced-motion` is a sufficient technique. [WCAG 2.2: Animation from Interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html)

## Verdict by convention

| Convention | Verdict | Why |
|---|---|---|
| Transport row (prev, play, next) with a play icon | Carries over, meaning stated | Recognised glyphs and placement are the shared vocabulary. The label must say what happens (it already does: "Play: open the cued repository"). Do not add controls the site cannot honour (HIG: do not repurpose; Android leaves unsupported slots empty). |
| Pause | Misleads | Opening another tab cannot be paused. A Stop or Return control is meaningful for the disc during the play period; a Pause is not. Detail belongs to #41. |
| Play state model (play, buffering, pause) | Carries over, narrowed | Android's play / spinner / pause slot fits "cued / loading / playing". Today the code has no "playing" state distinct from "loading"; the new model needs one. |
| Persistent bottom now-playing bar | Carries over | The mini-player pattern fits a browse-while-cued surface. It must not claim a media session (no audio, no OS controls). |
| Waveform fill as progress | Carries over if truthful | Fill should track the real elapsed time of the set play period at an even pace (HIG). Today it tracks only the 2.4 s load. |
| Draggable scrubber / seek | Misleads | Seeking implies a media timeline to jump within; a repository has none. Keep the waveform display-only. If it ever becomes interactive it needs slider semantics and a non-drag path. |
| "Now playing" vs "Up next" wording | Carries over, with care | Readers take "now playing" to mean sound is being produced. Use it only while the disc is in its play period; "Up next" suits a merely cued track. Not for a hovered row. |
| Lyrics as README text | Carries over as a metaphor | Time-synced highlight is the convention, but the sync here is invented (fixed 2.6 s per line). SC 2.2.2 applies to auto-advancing highlight beside other content lasting over 5 s: pace it to play time or give a pause path, and keep the reduced-motion behaviour. |
| Queue with "Now playing" and "Next up" | Carries over | Familiar model for an ordered list. Reordering earns its place only if something consumes the order (open question on the map). |
| Auto-advance to the next track | Misleads | Music apps advance because audio is already running. Here advancing means opening another tab, which needs a user gesture; do not imply it will happen. |
| Shuffle | Carries over, low stakes | Understood as order randomisation. It needs a visible effect on the queue or it feels inert. |
| Reorder by drag | Carries over with alternatives | Needs a non-drag path (the up/down buttons already satisfy SC 2.5.7) and spring-back or cancel feedback. |
| Drag the disc out to eject | Carries over from drag-and-drop guidance | Needs a visible non-drag Eject or Return control, valid/invalid target feedback and spring-back; undo is cheap because the disc returns by default. |
| Volume, mute, output routing, audio focus, Media Session, lock-screen controls | Misleads | No audio exists. Omit them; do not register Media Session handlers. |
| Resume last session | Misleads | Android resumption restarts playback; here there is nothing to resume. |
| New tab on play | Departs from the NN/g default; defensible | The page is a launching point and the CD must stay visible while the tab is away, which fits NN/g's launching-point case. Mitigate: announce it before activation (icon plus text such as "opens in a new tab"), do not assume Back works, and note SC 3.2.5 (AAA, advisory). |
| Elapsed / remaining time labels | Mixed | Meaningful only for the set play period. The repository's first-to-last commit span is a different quantity and should not be styled as a duration. |

## Cross-cutting findings

1. **State drives controls.** Platform sources derive visible controls from a small player state. This site needs one more state than today (`playing` after `loading`), and the controls should follow it.
2. **Honest affordances.** Where a music convention implies audio or a seekable timeline, show only what the site can deliver. Omitting unsupported controls is the platform-recommended handling.
3. **Determinate over invented progress.** Apple and NN/g agree on accurate, steady, determinate progress; the set play time is a real duration, so it supports a truthful bar.
4. **Time-based motion needs a pause path.** The disc "playing" for a set time and the lyric highlight are auto-moving content (SC 2.2.2); the reduced-motion path that exists for load should extend to play.
5. **Every drag has a non-drag path.** Both queue reorder and eject need one (SC 2.5.7).

## Gaps and limits

- Material Design 3's component pages (m3.material.io) are script-rendered and could not be read, and a search returned no readable Material spec for mini-players or sliders. Material coverage here comes from Android's own media documentation and the Media3 `MiniController` announcement. Treat any "Material says" claim as unverified.
- Apple's HIG pages were read through their JSON mirror because the HTML page returned no body. The Android Auto media UX page returned 404 and was not used.
- NN/g has no article specific to music players; the guidance used is general (tabs, response times).
- Pages were summarised by a fetch tool, not read verbatim; verify exact wording before quoting.
- Other apps' behaviour was deliberately not surveyed; the question asked for platform guidance and published research.
