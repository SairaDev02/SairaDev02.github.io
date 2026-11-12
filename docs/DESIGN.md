# Design: cobalt dither with yellow light

The visual system of this site. It started from the owner's Four-Grey Ordered-Dither
Pixel Style and departs from it in colour, page tone and chrome (see "Departures").
Tokens live in `src/styles/global.css`; this document explains them.

## Idea

A music service playing a playlist of repositories. The picture is a lit, ordered-dithered
CD player in a cloudy sky; the chrome around it borrows from music apps: a track list, a
now-playing dock, lyrics and a queue.

## Colour

| Token | Value | Use |
| --- | --- | --- |
| `--shade-0` | `#13238a` | Picture level 0 (darkest) |
| `--shade-1` | `#2f55e4` | Picture level 1 |
| `--shade-2` | `#a9c3f6` | Picture level 2 |
| `--shade-3` | `#f6f9ff` | Picture level 3 (lightest) |
| `--sun` | `#ffd60a` | Light sources in the picture; small fills in the chrome |
| `--sun-core` | `#fff6c4` | Core of a light source |
| `--bg` | `#dfe9fb` | Page |
| `--fg` / `--on-sun` | `#0c1233` | Text; text on yellow |
| `--muted` | `#42507c` | Secondary text |
| `--accent` | `#1d3fd0` | Labels, links, active navigation |

- Everything lit in the picture uses the four blue levels. Only emissive things (the
  pointer star, the display digits, the LED, sparkles) use the two yellows.
- Yellow is never text on the pale page: too little contrast. Yellow fills carry navy text.
- Colour contrast has not been measured yet.

## Type

| Face | Use |
| --- | --- |
| Lexend Exa | Large display text (playlist title, counts) |
| Lexend | Labels, buttons, track titles |
| IBM Plex Mono | Body text, dates, the LCD counter digits |
| Pixelify Sans | Pixel accents: LCD title, lettering inside the picture |

All four are OFL and load from Google Fonts. Lexend Exa replaces Novecento Sans Wide,
whose free licence covers desktop installation only, not webfonts.

## Picture rendering

Kept from the Four-Grey style:

- 8×8 Bayer ordered dither indexed by screen position; quantize is the last step.
- Whole-device-pixel scaling: the canvas is a fixed grid (512×224 wide, 256×320 on
  phones) scaled by an integer factor.
- Per-pixel lighting of a height field with hard, height-sliced shadows.
- 30 fps cap; the loop pauses off screen and in hidden tabs; reduced motion draws still
  frames only.

## Chrome

- 1px hairlines in translucent accent, pill-shaped buttons and navigation.
- The picture sits in a rounded frame with a white rim and a soft blue glow.
- The page background is a pale sky gradient with soft drifting cloud blobs.
- The LCD faceplate under the picture has a fixed height so changing text never shifts
  the layout; long text scrolls as a marquee.

## Departures from the Four-Grey style

Colour (cobalt and yellow instead of four greys), a light page instead of a dark one,
gradients, glows, rounded corners and 1px instead of 2px lines. The owner chose these with
prototype variant G; the original Four-Grey document is unchanged.
