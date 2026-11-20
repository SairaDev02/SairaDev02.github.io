# Design: Sensor CMYK

The visual system of this site: a sensor view of dithered terrain, printed in process
inks. Light prints on paper, Dark on key black. Tokens live in `src/styles/global.css`;
this document explains them. The spec is issue #58.

## Inks

Four inks, one meaning each.

| Ink | Meaning |
| --- | --- |
| Black (K) | The terrain, text and structure |
| Cyan | Live: an Active repository |
| Magenta | Focus: the previewed Asset, its brackets and card, the hovered row, the focus ring |
| Yellow | The highlighter: the sweep, the pointer, the first-load reveal |

- Marks (dots, bars, borders, brackets, markers) use the pure inks, except where a mark
  that carries state would fall below 3:1 against its background. On paper, pure cyan is
  2.42:1, so the live chip's dot and outline and a live tag's outline use the cyan text
  ink in Light. The owner chose this on 2026-11-20.
- Text tied to an ink uses the text-ink token, because pure cyan and magenta fail 4.5:1
  on paper.
- Yellow is never text and never the only carrier of a meaning.
- Colour is never the only signal: Active versus Dormant also shows by the shape of the
  mark and in text, focus also by brackets.

## Tokens

Light is the default and the fallback without script. Dark replaces every value.

| Token | Dark (key) | Light (paper) | Use |
| --- | --- | --- | --- |
| `--bg` (stock) | `#0a0c0e` | `#f2efe6` | Page and view background |
| `--fg` | `#e3e7ea` | `#1b1b1c` | Text, K structure |
| `--muted` | `#8d97a1` | `#5d5b56` | Secondary text |
| `--terrain-0` to `-3` | `#07090b` `#2b3138` `#7d8791` `#e3e7ea` | `#f2efe6` `#c9c5bb` `#6c6a64` `#1b1b1c` | Dither levels |
| `--ink-c` | `#18c0ff` | `#00a6e2` | Cyan marks: live |
| `--ink-m` | `#ff3dad` | `#e6007e` | Magenta marks: focus |
| `--ink-y` | `#ffe94a` | `#ffe500` | Yellow highlighter |
| `--ink-c-text` | = `--ink-c` | `#006f99` | Cyan text |
| `--ink-m-text` | = `--ink-m` | `#b8005f` | Magenta text |
| `--field-line` / `--field-major` | `#1a1f24` / `#262c32` | `#dcd8ce` / `#c8c4b9` | The background field |
| `--line` / `--line-strong` | K at 18% / 26% | K at 18% / 26% | 1 px hairlines |

- Square corners. 1 px hairlines in K at 12 to 26% strength.
- A few legacy names (`--accent`, `--on-accent`, `--sun`, `--sun-core`, `--on-sun`,
  `--shade-0` to `-3`, `--glass`) remain, mapped onto these tokens in `global.css`. The
  shared Button, the header, the 404 card and the dev-only link-preview route
  (`src/dev/og-card.astro`) still use them; new code uses the tokens above.

## Light multiplies, Dark replaces

Light is ink on paper: inks multiply over the stock, so marks darken what is under them.
Dark is light on key black: the inks replace what is under them, so they are brighter
values (the Dark column) rather than the same inks.

## Theme setting

A fieldset "Colour theme" of three native radios, System, Light and Dark, in the header
after the navigation. Each option is at least 24 by 24 CSS px.

- `localStorage` key `theme` holds `light` or `dark`. System removes the key. A storage
  failure falls back to System, silently.
- A blocking inline script in the head (`src/scripts/theme-init.js`) sets `data-theme` on
  the root to `light` or `dark` before first paint. Its hash is in `astro.config.mjs`.
- `src/scripts/theme.ts` owns the attribute after load: the radios, and changes of the
  device's `prefers-color-scheme` while on System. A change crossfades in 320 ms with a
  view transition, unless reduced motion is on or the API is missing.
- Scenes subscribe with `onThemeChange` (the `themechange` event on `document`, detail
  `{ theme }`) and re-read their colours from the custom properties.
- The home page and the 404 page share the tokens and the setting.

## Header

Brand, last push, navigation, theme setting: four columns on wide screens, the header
sticky with scroll padding so a focused element is never under it. On phones the columns
stack, the setting has its own row, and the header scrolls away.

## Type

| Face | Use |
| --- | --- |
| Lexend Exa | Large display text (the name heading) |
| Lexend | Labels, buttons, titles |
| IBM Plex Mono | Body text, dates, readouts |
| Pixelify Sans | Pixel accents |

All four are OFL and self-hosted through Fontsource packages.

## Rendering

- 8x8 Bayer ordered dither indexed by screen position; quantize is the last step.
- Whole-device-pixel scaling of a fixed grid (512x224 wide, 256x320 on phones).
- 30 fps cap; loops pause off screen and in hidden tabs; reduced motion draws still
  frames and keeps only colour changes.
