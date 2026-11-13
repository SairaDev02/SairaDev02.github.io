# web.dev audit of the live site

Research for issue #10 (map: #6). Question: measured against current web.dev guidance, what gaps does the deployed site at `https://sairadev02.github.io/` have? This audit covers performance, accessibility, best practices, SEO basics, Core Web Vitals field data and Baseline. The PageSpeed work merged in PRs #2 and #3 is the baseline. This file reports gaps only. It proposes no redesign of the G home page.

- **Date:** 2026-11-13. Live site `Last-Modified: Fri, 13 Nov 2026 11:04:13 GMT`, the build of `main` at `fa87da1`.
- **Tools:** Lighthouse 13.6.0 (CLI) on local Chrome 157.0.8103.51 headless. PageSpeed Insights web UI (Lighthouse 13.6.0 on HeadlessChromium 157.0.8103.38). axe-core 4.14.0 through @axe-core/playwright 4.14.0 and Playwright 1.65.0 (Chrome channel). web-features 3.46.0 and compute-baseline 0.5.0. Node 26.13.0.
- **Other references:** Modern Web Guidance v1.0.0 (`GoogleChrome/modern-web-guidance`, released 2026-11-10), read as markdown from the `v1.0.0` tag. Its guides are cited below by ID, for example `accessibility/accessibility`.
- **Evidence grades:** **M** = measured on the live site in this audit. **D** = stated in official documentation (source named). **I** = my inference from M and D.

## Raw scores

Lighthouse CLI, three runs per mode. Mobile uses the default Moto G Power emulation with simulated slow 4G and 4x CPU throttling. Desktop uses `--preset=desktop`.

| Run | Perf | A11y | Best practices | SEO | FCP | LCP | TBT | CLS | SI |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Mobile 1 | 94 | 100 | 96 | 100 | 1.2 s | 1.2 s | 270 ms | 0.002 | 2.3 s |
| Mobile 2 | 95 | 100 | 96 | 100 | 1.1 s | 1.1 s | 240 ms | 0 | 2.4 s |
| Mobile 3 | 95 | 100 | 96 | 100 | 0.9 s | 0.9 s | 250 ms | 0 | 1.8 s |
| Desktop 1 | 100 | 100 | 96 | 100 | 0.3 s | 0.3 s | 0 ms | 0.003 | 0.7 s |
| Desktop 2 | 100 | 100 | 96 | 100 | 0.3 s | 0.3 s | 0 ms | 0.003 | 0.8 s |
| Desktop 3 | 100 | 100 | 96 | 100 | 0.2 s | 0.2 s | 0 ms | 0.003 | 0.7 s |
| PSI mobile | 91 | 100 | 100 | 100 | 0.8 s | 0.8 s | 380 ms | 0.003 | 1.3 s |
| PSI desktop | 97 | 100 | 100 | 100 | 0.2 s | 0.2 s | 140 ms | 0.003 | 0.6 s |

PSI also scored the new "Agentic Browsing" category at 3/3.

Audits that failed in the local runs (mobile run 1; desktop fails the same audits except the TBT-related ones):

```json
{
  "errors-in-console": { "score": 0, "item": "GET /favicon.ico -> 404" },
  "cache-insight": { "score": 0.5, "displayValue": "Est savings of 123 KiB", "cacheLifetimeMs": 600000 },
  "network-dependency-tree-insight": { "score": 0, "longestChain": "document -> lexend-latin-wght-normal.woff2, 959 ms" },
  "total-blocking-time": { "score": 0.81, "displayValue": "270 ms" },
  "max-potential-fid": { "score": 0.71, "displayValue": "190 ms" }
}
```

On mobile, the LCP element is text: `p.label` "PUBLIC PLAYLIST · 4 REPOSITORIES". Its LCP breakdown is 310 ms TTFB and 732 ms render delay. The page has no images.

## Core Web Vitals field data

| Finding | Grade | Source |
| --- | --- | --- |
| CrUX has no data for this site. PageSpeed Insights shows "No Data" under "Discover what your real users are experiencing" for both mobile and desktop. Keyless PSI API calls failed with HTTP 429 (quota), so the check used the PSI web UI. | M | PSI report, 2026-11-13 19:15 GMT+8 |
| CrUX includes a page or origin only if it is publicly discoverable and "sufficiently popular". The minimum visitor count is not disclosed. | D | Chrome for Developers, "CrUX methodology" |
| So every Core Web Vitals statement in this file is lab data, and INP cannot be measured in the field today. | I | |

## Gaps, ranked

Severity: **Medium** = fails a WCAG AA or Level A criterion, a scored Lighthouse audit or a "good" threshold, or affects a goal on the map. **Low** = best practice or guidance not followed, with small practical effect. "Fact" rows are evidence. The **Recommendation** line after each table is my advice.

### G1. Dimmed lyric lines and the lyrics panel title fail text contrast (Medium)

| Fact | Grade | Source |
| --- | --- | --- |
| In the Lyrics panel, lines that are not current use `color: #ffffff80` (50% white) on a `linear-gradient(165deg, #2f55e4, #1d3fd0 45%, #13238a)`. The current line is `#ffd60a`. | M | computed styles, live page |
| Measured on rendered pixels (text hidden, median background under each line's box), 412 px viewport, text 17.6 px / weight 600: **2.94 to 3.91 : 1** for each dimmed line. Normal text needs 4.5 : 1. | M | Playwright screenshot sampling |
| At 1350 px the lines are 25.6 px (large text, needs 3 : 1). The top line measured **2.97 : 1**. | M | same |
| The panel title (`#ffd60a` on about `#2c52e1`, 14 px / 600) measured **4.37 : 1** on desktop and **4.47 : 1** on mobile, against 4.5 : 1 required. | M | same; hand calculation agrees (4.37) |
| axe did not flag these. It reports colour contrast as "incomplete" (37 to 58 nodes) because the backgrounds are gradients, overlapping layers or pseudo-elements. Lighthouse's accessibility score of 100 therefore does not cover contrast here. | M | axe 4.14.0 `incomplete` results |
| The same pixel method found **no** AA failures in the main page or the queue panel (mobile and desktop). | M | same |
| `docs/DESIGN.md` says "Colour contrast has not been measured yet." | M | repo |
| Text contrast must be at least 4.5 : 1 for regular text and 3 : 1 for large text (WCAG 1.4.3 Contrast (Minimum), Level AA). | D | Modern Web Guidance `visual-design/browser-ui-theming` (contrast bullet); `accessibility/accessibility` §9 defers to the `color` guide |

**Recommendation:** raise the dim level of non-current lines (for example a higher alpha or a lighter tint) until every line passes 4.5 : 1 against the lightest part of the gradient. Darken or enlarge the yellow panel title slightly. This is a palette tweak within G, not a redesign. Add a contrast assertion to the e2e suite only if the owner approves.

### G2. No favicon or icons: a console error and no favicon in search results (Medium)

| Fact | Grade | Source |
| --- | --- | --- |
| `/favicon.ico`, `/favicon.svg` and `/apple-touch-icon.png` all return 404 (GitHub's generic 404 page). The page has no `<link rel="icon">` and no `apple-touch-icon`. | M | `curl`; page `<head>` |
| Chrome requests `/favicon.ico` by default and logs "Failed to load resource: 404". Lighthouse `errors-in-console` fails, so Best Practices scores 96 in every local run. (PSI scored 100. Its run did not log the favicon request.) | M | Lighthouse runs above |
| Google Search shows a site favicon only from a `<link rel="icon">` (or `apple-touch-icon`) on the home page. The icon must be square, at least 8x8 px, recommended larger than 48x48 px, and crawlable. Google uses one favicon per hostname. | D | Google Search Central, "Define a favicon to show in search results" |

**Recommendation:** add an SVG favicon plus a 48x48-multiple PNG or ICO, and an `apple-touch-icon` (180x180), in the G palette. This also resolves the console error. The map's "Icons, favicon, web app manifest, 404 page" item covers it.

### G3. Mobile main-thread blocking: TBT is above "good", and interaction latency nears the INP limit under throttling (Medium, lab only)

| Fact | Grade | Source |
| --- | --- | --- |
| Mobile TBT: 240 to 270 ms locally and 380 ms on PSI. Lighthouse's mobile TBT bands are 0 to 200 ms green and 200 to 600 ms orange. Desktop TBT is 0 ms locally and 140 ms on PSI. | M + D | runs above; Chrome for Developers, "Total Blocking Time" |
| Long Animation Frames at 4x CPU throttling, during load. First frame: 393 ms (188 ms blocking), of which **228 ms is style and layout with no script**. Then setup chunks resumed after `scheduler.yield()` of 133 ms and 120 ms, and the first `IntersectionObserver` render callback at 88 ms. Total blocking 402 ms. | M | LoAF observer, Playwright with CDP throttling |
| After the first scroll wakes the animation loop, **every animation frame is a long task** of 80 to 136 ms at 4x throttling (14 in 3 s, 753 ms blocking). The loop's cost spacing (`COST_SPACING = 2`) leaves gaps between frames but does not shorten the frames themselves. | M | LoAF; `src/scripts/render/canvas.ts` |
| Lab interaction latency (Event Timing, 12 taps on "Next in queue" during animation): worst **56 ms** at 1x CPU and **192 ms** at 4x. INP is "good" at or below 200 ms at p75 in the field. | M + D | Event Timing observer; web.dev "Interaction to Next Paint (INP)" (updated 2025-09-02) |
| Guidance: yield to the main thread within about 50 ms budgets (`performance/break-up-long-tasks`). Attribute heavy scripts with the Long Animation Frames API and report them from production (`performance/identify-heavy-scripts`). | D | Modern Web Guidance v1.0.0 |

**Recommendation:** (a) split each animation frame's dither and render work so no single task exceeds about 50 ms on a 4x-throttled device, or move it off the main thread; (b) cut the 228 ms initial style and layout (the document is 100 KB of inline CSS and SVG); (c) since CrUX has no data, report INP and LoAF from real users through the planned analytics. Performance scores stay at or above 91 regardless, so this is about headroom, not a failing score.

### G4. Queue "cue" buttons fail Label in Name (Low to Medium)

| Fact | Grade | Source |
| --- | --- | --- |
| With the Queue panel open, axe reports `label-content-name-mismatch` (serious, WCAG 2.5.3, Level A) on all four cue buttons. Example: `aria-label="Cue pi-tools-saira"`, visible text "pi-tools-saira TypeScript · 32 commits". The cued one is labelled `aria-label="unmei-vn, cued"`. | M | axe 4.14.0 with the panel open |
| Lighthouse does not see this because the panel is closed at load. Its accessibility score of 100 reflects only the closed state. | M | same |
| The guide asks that a control's visible text be included in its accessible name. It also advises against repeating state (such as "cued") in the label when ARIA can expose it. | D | Modern Web Guidance `accessibility/accessibility` §3 "Choosing the name" |

**Recommendation:** label the cue buttons with their visible text, for example `aria-labelledby` pointing at the name and meta spans, or drop `aria-label` and add a visually hidden "Cue". Expose "cued" through `aria-current` or `aria-pressed` instead of the name.

### G5. No custom 404 page (Low)

| Fact | Grade | Source |
| --- | --- | --- |
| Missing paths return GitHub's generic "Page not found · GitHub Pages" page (HTTP 404, 9,379 bytes). It has no site branding and no link home. | M | `curl` `/does-not-exist` |
| A `404.html` at the root of the publishing source replaces it. Astro builds `src/pages/404.astro` to `404.html`. | D | GitHub Docs, "Creating a custom 404 page"; detail in `research/github-pages-limits` (#11) |

**Recommendation:** add `src/pages/404.astro` in the G palette, with a link home. It needs no `noindex`, because Pages already serves it with status 404.

### G6. Placeholder content is live (Low)

| Fact | Grade | Source |
| --- | --- | --- |
| The header nav links "Writing", "Resume" and "Contact" scroll to footer blocks that read "No posts yet.", "Coming soon." and a literal `[email placeholder]`. | M | live HTML |

**Recommendation:** remove empty destinations from the nav, or fill them, before the site is promoted for branded search. Whether Contact shows anything beyond the GitHub link is an owner decision: the map limits identity to the handle.

### G7. No Content Security Policy (Low)

| Fact | Grade | Source |
| --- | --- | --- |
| The page has no CSP header or meta tag. Lighthouse `csp-xss` reports "No CSP found in enforcement mode". This is informative and does not affect the score. | M | Lighthouse |
| The page loads no third-party resources. Every request is same-origin (`/_astro/*`), the only script is a same-origin module, and there are no forms or user input. | M | Lighthouse network requests |
| On static hosting that cannot set headers, the fallback is a `<meta http-equiv="Content-Security-Policy">`. `frame-ancestors`, `report-uri` and `sandbox` are not supported in meta. The `Connection-Allowlist` header (Chrome and Edge 152+) needs headers, so it is unavailable here. | D | Modern Web Guidance `security/restrict-outbound-connections` (fallback strategy); W3C CSP3 §3.3 |
| Astro's `security.csp` option emits a hashed meta CSP. A test build of this repo worked on Astro 7.4.11. | D + M | `research/github-pages-limits` (#11) |

**Recommendation:** optional hardening. The risk is low because nothing third-party or user-supplied reaches the page. If adopted, use Astro `security.csp`, plus `object-src 'none'`, `base-uri 'self'` and `form-action 'none'`.

### G8. No web app manifest (Low, optional)

| Fact | Grade | Source |
| --- | --- | --- |
| The page has no `<link rel="manifest">`, and `/manifest.webmanifest` and `/site.webmanifest` return 404. `<meta name="theme-color" content="#dfe9fb">` is present. | M | page `<head>`, `curl` |
| A manifest needs `name` or `short_name`, `start_url`, `display`, 192x192 and 512x512 icons, and a stable `id`. Installation is a progressive enhancement. | D | Modern Web Guidance `pwa/install-web-app`; web.dev "Add a web app manifest" |

**Recommendation:** installability is not a goal on the map. A minimal manifest is still cheap and gives Android and desktop a proper icon and name. Bundle it with G2 if wanted.

### G9. Smaller guidance gaps (Low)

| Fact | Grade | Guide |
| --- | --- | --- |
| No skip link. Five header links come before `<main>`. A `<main>` landmark exists, which offers an alternative bypass. | M | `accessibility/accessibility` §1 "Skip links" (WCAG 2.4.1) |
| `user-select: none` is unprefixed. Safari supports only `-webkit-user-select` (web-features: `user-select` limited availability), so Safari ignores it. It is also set on `.q-item`, which contains repository names (content text). | M + D | `visual-design/browser-ui-theming` ("DON'T apply `user-select: none` to content text") |
| No `color-scheme` declaration (computed `normal`). The page is light-only, so under an OS dark theme, browser-drawn UI such as scrollbars may not match. | M | `visual-design/browser-ui-theming` |
| `.page { min-height: 100vh }` uses `vh` rather than `dvh`. | M | `css/responsive-design` |
| `font-display: swap` without `font-size-adjust` or `size-adjust` fallbacks. The measured CLS is 0 to 0.003, so the practical effect is negligible. | M | `visual-design/visually-stable-font-fallbacks` |
| `github.com/SairaDev02` footer link target is 189x19 px, under 24 px tall. It is inline text, which WCAG 2.5.8 exempts, so this is not a failure. | M + D | `accessibility/accessibility` §5 "Target sizes" |

### Not fixable on GitHub Pages (platform limits, for the record)

These items appear in Lighthouse but cannot be changed without custom headers. Details are in `research/github-pages-limits` (#11).

| Fact | Grade |
| --- | --- |
| `cache-insight`: every file, including hashed `/_astro/*` fonts and JS, is served with `Cache-Control: max-age=600`. Est. savings 123 KiB on repeat visits. | M |
| HSTS is `max-age=31556952` with no `includeSubDomains` or `preload`. No COOP header, no `X-Frame-Options` or `frame-ancestors`, no Trusted Types header (Lighthouse "Trust and safety", informative). | M |

## What passes (no gap)

| Area | Evidence | Grade |
| --- | --- | --- |
| HTTPS | `http://` returns 301 to `https://`, and HSTS is present. | M |
| LCP and CLS | LCP 0.9 to 1.2 s mobile and 0.2 to 0.3 s desktop. CLS 0 to 0.003. Both are well inside "good". The baseline from PRs #2 and #3 holds. | M |
| Fonts | All WOFF2, `font-display: swap`, two critical faces preloaded, no render-blocking requests (`render-blocking-insight` passes). | M |
| Images | The page has no `<img>`, `<video>`, `<audio>` or CSS `url()` backgrounds; the art is canvas and inline SVG. Image formats, `performance/deliver-optimized-decorative-images` and `performance/lazy-load-video-and-audio` do not apply. | M |
| Third parties | None. `security/secure-external-subresources` (SRI, CORS, referrer policy) does not apply. | M |
| axe at load | 0 violations in mobile, desktop, reduced-motion and dark-scheme contexts (WCAG 2.0/2.1/2.2 A and AA plus best-practice tags). | M |
| Keyboard | All 18 tab stops are in a logical order, and each shows a 2 px solid focus outline. | M |
| Motion | `prefers-reduced-motion` is honoured: the canvas draws still frames only (`frameLoop`), with four reduced-motion media blocks in the CSS. | M |
| Canvas | `<canvas role="img" aria-label="…">`, and the DOM track list provides the same actions. The in-canvas lettering is decorative text from `text-mask.ts`. `visual-design/expose-canvas-content-to-browser-features` (HTML-in-Canvas) is Chrome 157+ only and "not natively supported by any major browser yet". Its recommended fallback is real HTML alongside the canvas, which the site already does. | M + D |
| Structure | One `<h1>`, `lang="en"`, `<header>`, `<nav aria-label="Main">`, `<main>`, `<footer>`, a polite live region for the now-playing state, `viewport-fit=cover` with `env(safe-area-inset-*)`. | M |
| SEO basics | Lighthouse SEO 100: title, meta description, `robots.txt` allows everything. `llms.txt` is served. Canonical, Open Graph, sitemap and structured data are absent, but other tickets on the map own those. | M |
| Baseline | compute-baseline over 108 CSS properties, at-rules, selectors and JS APIs found in the live CSS and bundle: 103 widely available. 2 newly available: `backdrop-filter` (2024-09-16; the panel stays readable without it) and canvas `willReadFrequently` (ignored where unsupported). 3 limited: `scheduler.yield` (feature-detected, with a `setTimeout` fallback in `yieldToMain`), `overscroll-behavior` (progressive) and `user-select` (see G9). Lighthouse's informative "Baseline Features" audit (data as of 2026-10-22) agrees. It also lists `canvas-2d-alpha` as limited (the `alpha` context option, which is ignored where unsupported) and `round-mod-rem` as newly available. Everything else it lists is widely available. No feature without a fallback is limited. | M |

## Modern Web Guidance v1.0.0

These are the guides checked, as the coordinator scoped them.

| Guide | Applies? | Result |
| --- | --- | --- |
| `performance/deliver-optimized-decorative-images` | No: no CSS images | n/a |
| `performance/lazy-load-video-and-audio` (the only `lazy-load*` guide) | No: no media | n/a |
| `performance/identify-heavy-scripts` | Yes | Gap G3: no LoAF reporting from real users, and CrUX has no data |
| `performance/break-up-long-tasks` (adjacent) | Yes | Gap G3: animation frames run 80 to 136 ms at 4x CPU |
| `visual-design/expose-canvas-content-to-browser-features` | Partly | No gap: the API is not Baseline, and the DOM-equivalent fallback is in place |
| `visual-design/visually-stable-font-fallbacks` | Yes | Minor (G9). CLS is already about 0 |
| `visual-design/browser-ui-theming` | Yes | G1 (contrast), G9 (`user-select`, `color-scheme`) |
| `accessibility/accessibility` | Yes | G1, G4, G9 (skip link). Landmarks, headings, focus and keyboard pass |
| `security/secure-external-subresources` | No: no external subresources | n/a |
| `security/restrict-outbound-connections` | Partly | G7: only the meta-CSP fallback is possible on Pages |
| `pwa/install-web-app` | Optional | G8: no manifest |
| `css/responsive-design` | Yes | Minor (G9: `100vh`). `clamp()` type passes (max/min ratio is 1.45 to 1.94, within 2.5) |

## Method notes and limits

- The contrast figures come from my own rendered-pixel method (text made transparent, median background pixel inside each text box, semi-transparent text blended over it). It is not a certified tool. Text clipped by or under the open panels produced false positives, which I excluded by hand: page text under the panel, and lyric lines scrolled out of the panel.
- TBT and LoAF depend on the machine. PSI's TBT (380 ms) was higher than the local runs (240 to 270 ms). The latency figures are a lab proxy for INP, not field INP.
- Only the home page was audited, since it is the only HTML page.
