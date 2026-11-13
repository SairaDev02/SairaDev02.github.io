# Link preview requirements across platforms

Research for issue #8 (map: #6). Gathered 2026-11-13. Every claim names its source and
the date the source gives. "Docs silent" means the platform publishes nothing on the
point; anything listed there is observational and unverified.

## Question

What metadata and image do Slack, Discord, LinkedIn, X, Facebook, iMessage, WhatsApp and
Mastodon need to render a rich preview of a link? This covers Open Graph and Twitter Card
tags, image dimensions, format, size limits and alt text, how long each platform caches a
preview and how to refresh it, and the options for generating preview images at build
time in Astro 7 on a static GitHub Pages build.

## Current state of the site (observed 2026-11-13)

- `src/layouts/BaseLayout.astro` emits only `<title>`, `meta name="description"` and
  `meta name="theme-color" content="#dfe9fb"`. The live page at
  https://sairadev02.github.io/ has no `og:*`, no `twitter:*`, no canonical link, and no
  icon links.
- The live HTML is about 101 KB, well under the 1 MB fetch limits of Apple and Meta.
- GitHub Pages serves it with `Cache-Control: max-age=600`. Pages sets the headers, and
  the site cannot change them.
- `astro.config.mjs` sets `site: 'https://sairadev02.github.io'`, so absolute URLs can be
  built from `Astro.site`.
- The deploy workflow rebuilds nightly at 03:17 UTC (`.github/workflows/deploy.yml`).
  Previews are cached by URL (see below), so an image that changes nightly at the same URL
  would go stale on most platforms.

## Common baseline (facts)

- **Open Graph protocol** (https://ogp.me/, undated spec). The required properties are
  `og:title`, `og:type`, `og:image` and `og:url`. `og:image` takes the structured
  properties `:url`, `:secure_url`, `:type`, `:width`, `:height` and `:alt`. The spec says
  that a page that specifies `og:image` "should specify `og:image:alt`", and that alt text
  is "a description of what is in the image (not a caption)". Within an array, the first
  tag wins. The spec sets no image dimensions or formats. Type `website` has no extra
  properties.
- **No platform runs JavaScript.** Tags must be in the HTML the server sends. Apple
  (TN3156) and Discord (link-previews overview) both state this. Astro's static output
  already meets it.
- **Absolute URLs.** Meta requires absolute `og:url` and `og:image` (Link Sharing FAQ).
  Discord accepts root-relative URLs starting with `/`. Absolute URLs are the safe common
  form.

## Per-platform findings

### Facebook (and Messenger and Instagram link shares)

Sources: Meta for Developers, "Images in Link Shares", "Webmasters", "Sharing Best
Practices", "Changing Link Data", "Link Sharing FAQ" and "Meta Web Crawlers"
(developers.facebook.com/documentation/sharing/..., fetched 2026-11-13; most pages
undated).

- **Tags.** The "basic tags for all content types" are `og:url`, `og:title`,
  `og:description`, `og:image` and `fb:app_id`. `og:type` defaults to `website`.
  `fb:app_id` only enables Facebook Insights, so it is optional for previews.
- **Image.**
  - Minimum 200x200 px, and the file "must not exceed 8 MB".
  - Use "at least 1200 x 630" for high-resolution displays. Below 600x315 the image shows
    "much smaller".
  - Keep the aspect ratio close to 1.91:1 to avoid cropping.
  - `og:image:type` values: image/jpeg, image/gif, image/png.
- **Dimensions tags.** `og:image:width` and `og:image:height` let the first share render
  the image immediately. Without them, the first sharer may see no image while Meta fetches
  it asynchronously.
- **Crawler.** `facebookexternalhit/1.1`. Open Graph tags must appear within the first
  1 MB of the page. The crawler accepts only gzip and deflate encodings. FacebookExternalHit
  crawls for "Facebook, Instagram, or Messenger"; the crawler page does not mention
  WhatsApp.
- **Caching.**
  - Images are cached by URL "and won't be updated unless the URL changes". To change an
    image, publish it at a new URL and keep the old one.
  - Meta re-scrapes link metadata "automatically every 30 days" ("Changing Link Data"). The
    Best Practices page instead mentions a "standard 24 hour update period"; the two Meta
    pages disagree.
  - Refresh with the Sharing Debugger (https://developers.facebook.com/tools/debug/) or the
    Graph API `POST /?id={url}&scrape=true`. Refreshing does not update previews in posts
    that already exist.

### X (Twitter)

Source: X Developer Platform, "Cards markup", "Summary Card with Large Image" and
"Troubleshooting Cards". **As of 2026-11-13 these pages redirect to the docs.x.com
overview.** The facts below come from Wayback Machine copies dated 2026-01-24 to
2026-02-04 (for example
https://web.archive.org/web/20260201012312/https://developer.x.com/en/docs/x-for-websites/cards/overview/markup).
X no longer publishes current card documentation.

- **Tags.** `twitter:card` selects the layout. If `og:type`, `og:title` and
  `og:description` exist but `twitter:card` is absent, "a summary card may be rendered".
  To get the large-image layout, set `twitter:card` to `summary_large_image`.
- **Fallbacks to Open Graph.**
  - `twitter:title` falls back to `og:title` (max 70 characters).
  - `twitter:description` falls back to `og:description` (max 200 characters).
  - `twitter:image` falls back to `og:image`.
  - `twitter:image:alt` falls back to `og:image:alt` (max 420 characters).
- **`twitter:site`.** The markup reference says "Either twitter:site or twitter:site:id is
  required", but the large-image page marks it optional. This site has no X account.
- **Image (summary_large_image).**
  - Aspect ratio 2:1, minimum 300x157, maximum 4096x4096.
  - Under 5 MB, in JPG, PNG, WEBP or GIF (first frame only). SVG is not supported.
  - X says not to use a generic site-wide image; this one-page site has no per-page
    alternative.
- **Crawler and caching.**
  - User agent `Twitterbot/1.0`, which follows Google's robots.txt specification.
  - The crawler re-indexes card tags "roughly every seven days".
  - The documented refresh method was the Card Validator; observationally, its preview
    function no longer works.
  - Observational, not in docs: sharing the URL with a new query string fetches a fresh
    card. Since about 2023, X shows large-image cards as the image with a domain overlay,
    without the title text.

### LinkedIn

Sources: LinkedIn Help, "Make your website shareable on LinkedIn" (a521928, "last updated
3 years ago") and "Use Post Inspector to refresh URL" (a6233775, "last updated 3 years
ago"). Both fetched 2026-11-13.

- **Tags.** `og:title`, `og:image`, `og:description` and `og:url`.
- **Image.**
  - At most 5 MB, minimum 1200x627 px, aspect ratio 1.91:1.
  - JPG, PNG or GIF. These formats are listed under the ad specifications on the same page.
  - "Images less than 401 pixels wide display as a thumbnail image."
- **Caching.** LinkedIn documents no cache duration; 7 days is a figure from third-party
  posts only. The Post Inspector (https://www.linkedin.com/post-inspector/) refreshes the
  preview, but only for new posts. Existing posts keep their old preview.
- **Docs silent.** LinkedIn documents nothing about its crawler user agent, robots.txt
  behaviour or alt text.

### Slack

Sources: Slack, "Slack Robots" (https://api.slack.com/robots, undated) and "Unfurling links
in messages" (https://docs.slack.dev/messaging/unfurling-links-in-messages/, undated). Both
fetched 2026-11-13.

- **Tags.** Classic unfurls look for "oEmbed and Twitter Card / Open Graph tags". The docs
  publish no order of precedence among them.
- **Crawler.**
  - User agent `Slackbot-LinkExpanding 1.0`. It fetches as little of the page as it can,
    using HTTP Range headers, and also fetches a referenced image to check it.
  - "We do not currently honor robots.txt files."
- **Caching.** Responses are "cached globally across the service for around 30 minutes".
  There is no refresh tool.
- **Docs silent.** Slack publishes no image dimension, size or format limits, and does not
  say whether it reads alt text.
- **Observational.** Slack's 2015 platform blog post on unfurling (Medium, now returns
  403) and third-party write-ups say:
  - oEmbed takes precedence over Twitter and Open Graph tags.
  - `twitter:card=summary_large_image` gives a large image, and other cards give a
    thumbnail.
  - Slack shows `twitter:label1`/`twitter:data1` pairs.

### Discord

Source: Discord, "Link Previews" overview
(https://docs.discord.com/developers/link-previews/overview, undated, fetched 2026-11-13).
This is new official documentation; earlier Discord behaviour was observational only.

- **Tags read.**
  - `og:title`, `og:description`, `og:site_name`, `og:image` (with `:width`, `:height`,
    `:type`, `:alt`) and `og:type`.
  - `twitter:title`, `twitter:description`, `twitter:image`, `twitter:image:alt` and
    `twitter:card`.
  - `theme-color`, which sets the accent colour and must be 6- or 8-digit hex. The site's
    existing `#dfe9fb` will be used.
  - `<title>` with `meta name="description"` as a pair, but only when no Open Graph or
    Twitter title or description exists.
  - oEmbed, read after Open Graph. Its fields only fill gaps.
- **Precedence.** For title, description and site name, the first non-empty tag wins. For
  layout, colour and date tags, the last one wins. Keys are case-sensitive.
- **Layout.**
  - With no layout tag: text and a small image.
  - With `twitter:card=summary_large_image`: text and a large image below it.
  - Two or more `og:image` tags: a gallery of up to 4 images.
- **Image.**
  - png, gif, jpg/jpeg, webp or avif.
  - Declare `og:image:width` and `og:image:height`. Without them, Discord fetches the
    image to measure it.
  - The docs give no per-image byte limit, only a 50 MB limit on the total fetch.
- **Limits.**
  - Title 70 bytes and description 350 bytes; longer text is trimmed.
  - Alt text up to 4,096 characters; over that, "No preview at all".
  - The fetch must finish in 10 s, with at most 5 redirects.
- **Caching.** About 30 minutes. Share the URL with a new query string (for example
  `?v=2`) to see changes immediately. The Embed Debugger
  (https://discord.com/developers/embeds) shows what Discord parsed.

### iMessage (Apple Messages)

Source: Apple, "TN3156: Create rich previews for Messages" (revision history: first
published 2017-09-08 as TN2444, republished 2024-04-30), fetched 2026-11-13.

- **Tags.**
  - `og:title` and `og:image`, plus `og:site_name` for the site name.
  - Apple: "Do not put the site name or other branding in the `og:title`."
  - `og:video` or `twitter:player:stream` can point to a playable video file.
- **Icon.** Provide a high-resolution icon as well: an `apple-touch-icon`, a favicon, or a
  `<link rel>` icon. Icons should be square and at least 108 px per side. The site has
  none today.
- **Image.**
  - At least 900 px wide. Images under 150 px wide "may be ignored or presented as icons".
  - The main page is limited to 1 MB, and all associated resources together to 10 MB.
  - Apple calls these "guidelines only".
- **Text in images.** Apple advises: "Avoid text in preview images", because images
  display at varying sizes. Text belongs in metadata, which is also accessible.
- **Fetching.** Metadata must be the same for every user agent. Messages does not follow
  meta redirects and does not run JavaScript; server-side redirects are followed.
- **Docs silent.** Apple documents no caching, refresh method, user agent or alt text
  handling.
- **Observational.** The sender's device builds the preview and sends it with the message,
  so a preview never updates after sending.

### WhatsApp

Sources: WhatsApp Help Center, "How to disable link previews" (faq.whatsapp.com
445453537819972, undated), and the WhatsApp Business Platform "Text messages" docs
(developers.facebook.com/documentation/business-messaging/whatsapp/messages/text-messages,
undated). Both fetched 2026-11-13.

- **Docs silent.** WhatsApp publishes no tag, image or cache requirements. The Business
  docs say only that the client "attempt[s] to render a link preview" of the first URL in
  a message.
- **Inference.** The help article offers disabling previews for links you send "to protect
  your IP address". This implies the sender's device fetches the page, as with iMessage,
  so there is no server cache to refresh, and a preview never changes after sending.
- **Observational, from community posts only.** WhatsApp reads `og:title`,
  `og:description` and `og:image`. Images above roughly 300 KB are often dropped, older
  advice capped them at about 400x400, and newer reports say the limits were raised. The
  safe course is a 1200x630 image well under 300 KB.

### Mastodon (and other fediverse servers that copy its behaviour)

Sources: the Mastodon source code at v4.7.5 (released 2026-11-03), files
`app/lib/link_details_extractor.rb`, `app/models/preview_card.rb` and
`app/services/fetch_link_card_service.rb`. Also the Mastodon docs, "PreviewCard" entity
(docs.joinmastodon.org/entities/PreviewCard/), and the Mastodon blog, "Highlighting
journalism on Mastodon" (2024-07-02).

- **Tags.**
  - Title: JSON-LD `headline`, then `og:title`, then `<title>`.
  - Description: JSON-LD `description`, then `og:description`, then
    `meta name="description"`.
  - Image: `og:image`. Its alt text comes from `og:image:alt` and is stored as
    `image_description`.
  - Site name: `og:site_name`.
  - Canonical URL: `link rel=canonical` or `og:url`, accepted only on the same origin.
  - Icon: `apple-touch-icon` or `icon`.
  - Language: `og:locale` or `<html lang>`.
- **JSON-LD precedence.** JSON-LD is used only when its `@type` is `WebPage` or
  `NewsArticle`. When it is, its `headline` and `description` override the Open Graph
  values. This matters if the structured-data work adds a `WebPage` node.
- **Image.**
  - JPEG, PNG, GIF or WebP, under 8 MB.
  - Mastodon downscales the stored image to 230,400 px (640x360 at 16:9) and computes a
    blurhash.
- **Author attribution.** `meta name="fediverse:creator" content="@user@server"` shows a
  clickable author byline. It works only if that account lists the site's domain under
  Author Attribution in its profile.
- **Caching.**
  - Each server fetches and caches the card on its own.
  - A server refetches a URL's card only when it is more than 2 weeks old or has no image.
  - The site owner cannot refresh it. Observationally, a new query string makes a new card.

## Requirements matrix (facts, condensed)

| Platform | Reads | Large image when | Image limits | Alt text | Cache / refresh |
|---|---|---|---|---|---|
| Facebook | og:* | ≥600x315; best ≥1200x630, 1.91:1 | ≥200x200, ≤8 MB, jpeg/png/gif | (not documented) | 30 days (or "24 h"); Sharing Debugger / Graph `scrape=true`; image cached by URL |
| X | twitter:* → og:* | `twitter:card=summary_large_image` | 2:1, 300x157–4096x4096, <5 MB, jpg/png/webp/gif | `twitter:image:alt` → `og:image:alt`, ≤420 chars | ~7 days; validator gone |
| LinkedIn | og:* | ≥401 px wide (else thumbnail) | ≥1200x627, 1.91:1, ≤5 MB | silent | undocumented; Post Inspector (new posts only) |
| Slack | oEmbed, twitter:*, og:* | silent (obs.: `summary_large_image`) | silent | silent | ~30 min; no tool |
| Discord | og:*, twitter:*, theme-color, oEmbed | `twitter:card=summary_large_image` | png/gif/jpg/webp/avif; declare width/height | og/twitter alt, ≤4,096 chars | ~30 min; new query string; Embed Debugger |
| iMessage | og:*, icons | ≥900 px wide recommended | page ≤1 MB, resources ≤10 MB | silent | silent (obs.: built on sender device) |
| WhatsApp | silent (obs.: og:*) | silent | silent (obs.: ≤~300 KB) | silent | silent (inferred: sender device) |
| Mastodon | JSON-LD, og:*, icons | client-dependent | jpeg/png/gif/webp, <8 MB, stored ≤640x360 | `og:image:alt` | per server, 2 weeks; no tool |

## Build-time image generation in Astro 7 (facts)

Versions checked on npm on 2026-11-13: astro 7.4.11, satori 0.63.2, sharp 0.35.5,
astro-og-canvas 0.13.3 and @resvg/resvg-js 2.6.2.

- **Static file endpoints.** Docs: https://docs.astro.build/en/guides/endpoints/. In a
  static build, "your custom endpoints are called at build time to produce static files".
  For example, `src/pages/og.png.ts` becomes `/og.png`, and the endpoint can return binary
  data in a `Response`. A dynamic filename with `getStaticPaths()` (for example
  `og-[hash].png.ts`) can put a content hash in the URL.
- **`getImage()` from `astro:assets`.** Docs:
  https://docs.astro.build/en/reference/modules/astro-assets/. It is server-only and
  converts a source image to `png`, `jpeg`, `webp` or `avif`. Output goes to
  `/_astro/<name>.<hash>.<ext>`, so the URL changes when the image changes. That suits
  Meta's cache-by-URL rule. `src` must be made absolute with `new URL(img.src, Astro.site)`.
- **sharp is already installed.** It is an optional dependency of astro 7.4.11 and is in
  this repo's `package-lock.json` at 0.35.5. It can encode PNG or JPEG and rasterise SVG.
- **Satori** (https://github.com/vercel/satori, MPL-2.0).
  - It turns JSX or plain object trees into SVG, using Taffy layout (flexbox, grid and
    block) and a CSS subset.
  - It needs font data passed in. TTF, OTF, WOFF and WOFF2 are supported, so the
    Fontsource files work.
  - "Variable fonts are rendered as their default instance". To use a specific weight,
    load static-weight files.
  - Its README recommends sharp to convert the SVG to PNG.
- **astro-og-canvas** (https://github.com/delucis/astro-og-canvas).
  - Its `OGImageRoute` helper generates `getStaticPaths` and `GET` for an endpoint.
  - It renders with CanvasKit WASM and supports astro ^5, ^6 and ^7 as peer dependencies.
  - It offers a fixed template (title, description, logo, background, border, fonts),
    so the layout is less flexible than Satori.
- **Reusing the site's own renderer.**
  - `src/scripts/render/canvas.ts` and `text-mask.ts` depend on the DOM (`matchMedia`,
    `getComputedStyle`).
  - `dither.ts` only mentions `ImageData` in a comment and is unit-tested under Vitest
    (`dither.test.ts`), so it appears to be DOM-free.
  - Rendering the picture in Node into an RGBA buffer and encoding it with sharp might be
    possible, but this is unverified.
  - Alternatively, a Playwright screenshot during the build would work, since Playwright
    is already a dev dependency. That would add a browser to the deploy job.

## Recommendations (inference, for the decision session)

These are proposals, not facts. Each one needs the owner's decision.

1. **Tag set** in `BaseLayout.astro`, all with absolute URLs:
   - `og:type=website`, `og:url` (also as `link rel=canonical`), `og:title`,
     `og:description`, `og:site_name=SairaDev02` and `og:locale=en_US`.
   - `og:image`, `og:image:type`, `og:image:width=1200`, `og:image:height=630` and
     `og:image:alt`.
   - `twitter:card=summary_large_image`.
   - Skip the duplicate `twitter:title`/`description`/`image`/`image:alt` tags; X and
     Discord fall back to the Open Graph values.
   - Omit `twitter:site` and `fb:app_id`: there is no account, and they are not needed
     for previews.
   - Following Apple, keep `og:title` free of the site name and put "SairaDev02" in
     `og:site_name`. This needs a choice of title wording.
2. **One image, 1200x630 PNG (or JPEG), well under 300 KB.**
   - That size meets Facebook (≥1200x630), LinkedIn (≥1200x627), Apple (≥900 wide),
     Discord, Mastodon and X.
   - X crops to 2:1, removing about 15 px at the top and bottom, so keep content inside a
     safe area.
   - Mastodon stores it at 640x360, so detail must survive downscaling.
   - The 300 KB cap is a hedge for WhatsApp, based on observation only. A palette-limited
     dithered image should compress well as PNG.
3. **Keep the image's URL stable unless the image changes, and content-hash it.**
   - Use either `getImage()` (a `/_astro/...hash.png` URL) or an endpoint with the hash in
     its filename. A changed image then gets a new URL, which Meta needs.
   - Avoid nightly-changing data in the image, such as repository counts. Platforms cache
     for 30 minutes to 30 days, and a constantly changing image would show inconsistent
     previews.
4. **Pick the generation approach by how much brand fidelity matters.**
   - (a) **Simplest:** a hand-made or one-off-rendered PNG committed under `src/assets/`
     and passed through `getImage()`. This adds no new dependency and suits a one-page site.
   - (b) **Satori plus sharp** in a static endpoint. This adds one dependency (satori), and
     sharp is already present. It fits if the card should show live text in the site's
     fonts.
   - (c) **astro-og-canvas.** This is the fastest to set up but the least on-brand.
   - (d) **Reusing the dithered renderer** in Node or Playwright is the most on-brand and
     the most work, and is unverified.
   - Apple advises against text in the image, which favours (a) with mostly graphic
     content.
5. **Alt text.** Write one `og:image:alt` of 420 characters or fewer, which fits X's limit
   and is far under Discord's 4,096.
6. **Icons.** Add an `apple-touch-icon` (square, at least 108 px; 180x180 is conventional)
   and a favicon. iMessage and Mastodon use them in previews, which overlaps the map's
   "Icons, favicon, manifest" item.
7. **Verification after deploy.**
   - Check each platform: Facebook Sharing Debugger, LinkedIn Post Inspector, Discord
     Embed Debugger, and a post in a private Slack channel.
   - The repo's Playwright e2e tests can assert the tags and the image dimensions. Whether
     to make that a CI gate is the owner's call.

## Open questions that may deserve tickets

- **Card content.** What the image shows (wordmark only, a still of the dithered scene,
  or the latest repo) and the exact `og:title` wording. These are design decisions for the
  owner.
- **Mastodon and JSON-LD.** If the structured-data ticket adds a `WebPage` JSON-LD node,
  its `headline` and `description` replace `og:title` and `og:description` in Mastodon
  cards. The two must be worded together.
- **`fediverse:creator`.** It applies only if the owner has a fediverse account to
  attribute, and must not reveal identity beyond the handle.
- **X documentation removed.** X's card documentation now exists only in archives. X
  behaviour should be verified by a real post after launch.
