# Cookieless analytics for a static GitHub Pages site

Research for issue #12 (map: #6). Retrieved 2026-11-13.

**Question:** Which privacy-friendly, cookieless analytics tools fit a static personal site on GitHub Pages: GoatCounter, Plausible, Umami Cloud, Cloudflare Web Analytics (without Cloudflare DNS), and any strong newer option? Compare cost (a free tier for a personal site), script weight and its effect on performance, whether EU/GDPR rules require a consent banner, data ownership and export, and whether a site at `*.github.io` can use each one.

**Site as it stands (origin/main `fa87da1`):** one static Astro page at `https://sairadev02.github.io/`, no analytics, no CSP meta tag, one inline module script. GitHub Pages allows no custom headers and no server-side code, so a first-party proxy (`/js/script.js` rewritten to a vendor) is not possible.

**How this was sourced.** From this machine only GitHub, jsdelivr and some vendor docs hosts resolved; `plausible.io`, `goatcounter.com`, `umami.is`, `docs.umami.is` and the vendors' script CDNs did not. So:

- Vendor facts come from the vendor's own docs source on GitHub (GoatCounter `tpl/help/*.md`, `plausible/docs`, Umami source code) or the vendor's own pages where they loaded (Cloudflare).
- Where neither loaded, the fact comes from a search-engine excerpt of the vendor's own page. Each such fact is marked **(search excerpt)** and should be rechecked on the live page before it drives a decision.
- Script sizes were measured from published builds (GitHub tag via jsdelivr, npm package), not from the vendor CDN. The sizes say which build was measured.
- Legal facts come from the EDPB guidelines PDF and the CNIL's own pages. Vendor claims about consent are kept separate from regulator guidance.

## Facts: EU consent rules for analytics

### ePrivacy Article 5(3) is about the device, not about cookies

Source: Directive 2002/58/EC Art. 5(3), as amended by 2009/136/EC ([EUR-Lex](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:02002L0058-20091219)).

- Storing information on, or gaining access to information already stored on, a user's device needs consent, with two exemptions only: storage or access for the sole purpose of carrying out the transmission of a communication, or "strictly necessary" to provide a service the user explicitly requested.
- Analytics is not named as an exemption in the Directive.

Source: [EDPB Guidelines 2/2023 on the technical scope of Art. 5(3)](https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-22023-technical-scope-art-53-eprivacy-directive_en), version 2.0, adopted 2024-10-07 (v1.0 for consultation: 2023-11-14).

- **Para 33:** JavaScript that "instructs the browser of the user to send asynchronous requests with the targeted information" falls within Art. 5(3). An analytics script that reads screen width, referrer or language and sends it is therefore in scope even when it sets no cookie.
- **Para 50:** distributing code to the device counts as storage, "at the very least through the caching mechanism".
- **Para 51:** tracking pixels and dynamically built pixels are a "gaining of access". A no-JavaScript pixel is also in scope.
- **Paras 54-55:** IP-only tracking can be in scope, unless the entity can ensure the IP does not originate from the user's terminal equipment.
- **Para 56:** the guidelines do not analyse the exemptions. Being in scope "does not systematically mean that consent needs to be collected"; each case needs its own assessment.

**Consequence (fact, not opinion):** "cookieless" does not take an analytics script outside Art. 5(3). Whether it needs consent depends on whether an exemption applies, and that is decided per member state.

### CNIL (France): audience measurement can be exempt from consent

Source: [CNIL, "Cookies : solutions pour les outils de mesure d'audience"](https://www.cnil.fr/fr/cookies-et-autres-traceurs/regles/cookies-solutions-pour-les-outils-de-mesure-daudience), dated 2025-07-04. Older English summary: [CNIL Sheet n°16](https://www.cnil.fr/en/sheet-ndeg16-use-analytics-your-websites-and-applications), dated 2020-06-11.

The CNIL exempts audience-measurement "traceurs" (any tracker, not only cookies) from consent when all of these hold:

- The purpose is strictly limited to measuring the site's own audience, for the publisher alone.
- The output is anonymous statistics only.
- There is no cross-referencing with other processing, and non-anonymous data is not passed to third parties.
- There is no tracking across sites or apps. A provider serving many publishers must keep each publisher's data and trackers independent.
- Tracker lifetime is about 13 months and is not extended automatically on return visits. Collected data is kept at most 25 months.
- Users are informed (for example in a privacy policy). The 2020 sheet also requires that users can object; the 2025 page as fetched does not describe the opt-out mechanism.
- The 2020 sheet adds truncating the last byte of the IP address.
- Publishers should check whether the provider transfers data outside the EU.

The CNIL also states that national rules vary, so this is the French position, not an EU-wide rule. The CNIL page names no compliant tools.

### Proposed EU change (not law)

The Commission's "Digital Omnibus" proposal would add GDPR Article 88a with an explicit consent exemption for first-party, aggregated audience measurement. **(Secondary sources only.)** Trade-press reports say the Council agreed its negotiating mandate on 2026-10-21 and trilogue had not concluded. The official text could not be retrieved (the Commission page returned HTTP 500), so the wording and timing are unverified. Today, Art. 5(3) and national practice still govern.

### Vendor positions on consent (vendor claims, not regulator guidance)

- **GoatCounter:** "probably doesn't require a GDPR consent notice", because it collects no personal data and relies on legitimate interest. It notes GDPR case law is thin and enforcement differs by member state, and it advises a lawyer for certainty ([`tpl/help/gdpr.md`](https://github.com/arp242/goatcounter/blob/HEAD/tpl/help/gdpr.md)). This argument is about GDPR, and it does not address ePrivacy Art. 5(3).
- **Plausible:** "No cookies are set. There is nothing to consent to and no cookie banner is required" ([`docs/compliance.md`](https://github.com/plausible/docs/blob/HEAD/docs/compliance.md)).
- **Cloudflare:** it "does not use any client-side state, such as cookies or localStorage" and does not fingerprint visitors by IP or User-Agent ([cloudflare.com/web-analytics](https://www.cloudflare.com/web-analytics/)). The pages read make no GDPR or consent claim.
- **Umami, Simple Analytics, Rybbit:** their marketing says no consent banner is needed **(search excerpt)**.

## Facts: per tool

### GoatCounter (hosted goatcounter.com)

- **Cost:** free "for reasonable public usage. Running your personal website … is fine" ([terms](https://github.com/arp242/goatcounter/blob/HEAD/tpl/help/terms.md)). Donations are encouraged. Self-hosting is possible without restriction (modified EUPL-1.2).
- **What it stores:** aggregate counts per hour or day (path, referrer, browser, system, country, language, screen width), with no link between dimensions. IP + User-Agent + site are kept in memory only, for up to 8 hours, to count unique visits. It stores no IP, full User-Agent or tracker ID, and stores nothing in the browser (no cookies, localStorage or cache). Optional per-pageview rows are off by default. Each data dimension can be switched off ([privacy](https://github.com/arp242/goatcounter/blob/HEAD/tpl/help/privacy.md), [sessions](https://github.com/arp242/goatcounter/blob/HEAD/tpl/help/sessions.md), dated 2025-06-08).
- **Hosting:** Hetzner in Finland and Germany. The operator is in Ireland.
- **Export:** JSON export (ZIP), plus CSV of individual pageviews when that option is on, plus an API. The account and all data can be deleted ([export](https://github.com/arp242/goatcounter/blob/HEAD/tpl/help/export.md), [export-json](https://github.com/arp242/goatcounter/blob/HEAD/tpl/help/export-json.md)).
- **Retention on the hosted service:** not stated in the docs read.
- **Integration:** one `<script async data-goatcounter=… src="//gc.zgo.at/count.js">` tag. `count.js` may be self-hosted or inlined, and the `/count` endpoint stays compatible ([countjs-host](https://github.com/arp242/goatcounter/blob/HEAD/tpl/help/countjs-host.md)). A no-JavaScript image pixel is also offered (README). Works on any hostname, `*.github.io` included.
- **Beacon:** uses `navigator.sendBeacon`, with no `unload` handler.

### Plausible (hosted plausible.io)

- **Cost:** no free plan. A 30-day trial gives Business features with no credit card ([`docs/trial.md`](https://github.com/plausible/docs/blob/HEAD/docs/trial.md)). Starter for 10k pageviews per month is $9/month, Growth $14, Business $19 **(search excerpt of plausible.io pricing)**. After a trial without subscribing, the dashboard is locked and the data is eventually deleted. The self-hosted Community Edition (AGPL-3.0) needs a server, so it cannot run on Pages.
- **What it stores:** a daily visitor hash of salt + domain + IP + User-Agent, with the salt deleted every 24 hours. It keeps no raw IP or User-Agent and uses no cookies, cache or localStorage, and visitors cannot be linked across days or sites ([data policy](https://plausible.io/data-policy), **search excerpt**; [`docs/compliance.md`](https://github.com/plausible/docs/blob/HEAD/docs/compliance.md)). A DPA applies to all customers.
- **Export:** CSV export from the dashboard or of all stats, plus a Stats API. Raw event exports are Enterprise only ([`docs/export-stats.md`](https://github.com/plausible/docs/blob/HEAD/docs/export-stats.md), [`docs/raw-data-export.md`](https://github.com/plausible/docs/blob/HEAD/docs/raw-data-export.md)). Export is still possible after the subscription ends.
- **Integration:** one snippet in `<head>`, or the npm package `@plausible-analytics/tracker` bundled into the site ([`docs/plausible-script.md`](https://github.com/plausible/docs/blob/HEAD/docs/plausible-script.md)). The proxy option needs a server, so it is not possible on Pages.
- **Beacon:** `fetch` with `keepalive`, sending on `visibilitychange`. The tracker only reads (never writes) a `localStorage.plausible_ignore` flag that the owner sets to exclude their own visits.

### Umami Cloud

- **Cost:** the Hobby plan is $0 with 100K events per month, 1 website and 6 months of retention. Pro starts at $20/month **(search excerpt of umami.is/pricing and docs.umami.is FAQ)**. Self-hosting is MIT licensed but needs a server and database.
- **What it stores (from source):** the session ID is a UUIDv5 of a hash over the website, IP, User-Agent and a salt. By default the salt **rotates monthly**; self-hosters can set daily or weekly rotation, or a fixed salt that never rotates ([`src/lib/crypto.ts`](https://github.com/umami-software/umami/blob/HEAD/src/lib/crypto.ts) `getSalt`). Which setting Umami Cloud uses is not documented in what was read. The tracker sets no cookie and only reads a `localStorage` `umami.disabled` opt-out flag ([`src/tracker/index.ts`](https://github.com/umami-software/umami/blob/HEAD/src/tracker/index.ts)). Umami v3.5.0 was released 2026-11-12. The send route also accepts web-vitals fields (LCP, INP, CLS, FCP, TTFB).
- **Export:** an API exists. The Cloud export features were not verified.
- **Integration:** a script tag on any hostname.

### Cloudflare Web Analytics (JS beacon, no Cloudflare DNS)

- **Cost:** "for free" ([cloudflare.com/web-analytics](https://www.cloudflare.com/web-analytics/)). It has a soft limit of 10 sites per account ([FAQ](https://developers.cloudflare.com/web-analytics/faq/), updated 2026-07-14).
- **Without Cloudflare DNS:** supported. Add a hostname, then paste the JS snippet before `</body>`. The FAQ says it is "designed primarily for customers who do not use Cloudflare's proxy" ([get started](https://developers.cloudflare.com/web-analytics/get-started/)). The EU-visitor exclusion option exists for proxied sites only.
- **Data:** the beacon fires on every pageview, so there are no sessions or unique visitors in the cookieless sense. Unsampled data is kept for 7 days, then aggregated to about 10%. History is available for six months. Queries are sampled adaptively. Data is also available through the GraphQL Analytics API ([FAQ](https://developers.cloudflare.com/web-analytics/faq/)). Data location and EU transfer are not stated on the pages read; Cloudflare is a US company.
- **Integration:** works on any hostname, as far as documented.

### Newer or other options checked

- **Simple Analytics:** has a free plan with unlimited pageviews, 1 user and 5 websites, but only the last 30 days of data are kept. Paid plans start at €20/month **(search excerpt of simpleanalytics.com/pricing)**.
- **Rybbit** (AGPL-3.0, actively developed): has no free cloud tier, only a 7-day trial. Standard costs $19/month for 100k events. It uses a daily-salt visitor hash **(search excerpt of rybbit.com)**. Self-hosting needs a server.
- No newer option was found that beats GoatCounter on the combination of free, aggregate-only storage, EU hosting and a small script.

### Script weight (measured 2026-11-13)

| Script | Build measured | Raw | gzip -9 | brotli -q 11 |
|---|---|---|---|---|
| GoatCounter `count.js` | GitHub tag `v2.7.0` `public/count.js` (the file served at `gc.zgo.at/count.js`), via jsdelivr | 8,940 B | 3,258 B | 2,729 B |
| Plausible `plausible.js` | npm `@plausible-analytics/tracker@0.4.7` | 6,425 B | 2,691 B | 2,356 B |
| Umami `script.js` | not measured: the built file is not in the repo, and `cloud.umami.is` did not resolve | — | about 1.4 to 3.2 KB in third-party reports | — |
| Cloudflare `beacon.min.js` | not measured: `static.cloudflareinsights.com` did not resolve | about 10.3 KB raw in a 2020-era third-party review | about 4.3 KB on the wire in the same review | — |

All four are small next to a typical page. Their cost is a third-party connection (DNS and TLS) and a few KB, loaded with `async` or `defer` so they are not render-blocking. The effect on LCP, INP and CLS for this site was **not measured**. Note that GoatCounter's `count.js` is unminified, so minifying a self-hosted copy would shrink it further.

### Ad and tracker blockers

EasyPrivacy, the default privacy list in uBlock Origin and others, blocks all of these third-party hosts. Lines from the [easylist/easylist](https://github.com/easylist/easylist) repo, read 2026-11-13:

- `||gc.zgo.at^$third-party` and `||goatcounter.com^$third-party`
- `||plausible.io^$third-party`
- `||umami.is^$third-party`
- `||cloudflareinsights.com^$third-party`
- `||simpleanalytics*` (several hosts)

GitHub Pages cannot proxy any of these hosts as first-party, so every option undercounts visitors who run blockers. Self-hosting GoatCounter's `count.js` does not help, because its beacon still goes to `goatcounter.com`.

### Modern Web Guidance v1.0.0 (Chrome, Edge, Firefox, MDN)

Read as Markdown from [GoogleChrome/modern-web-guidance@v1.0.0](https://github.com/GoogleChrome/modern-web-guidance/tree/v1.0.0/skills/modern-web-guidance/guides).

- **`privacy/privacy`:** be privacy-protective by default rather than offloading choices to users through complex consent dialogs, and collect the minimum. "DON'T assume a third party is privacy-safe just because it is popular"; audit third-party network requests with DevTools or HAR. **Effect here:** turn off collection dimensions the owner will not use (GoatCounter allows this per dimension), and check the beacon payload in DevTools once installed.
- **`performance/identify-heavy-scripts`:** analytics scripts are a common, easily forgotten cause of long animation frames. Use the Long Animation Frames API (Chrome and Edge 123+) to attribute script time in the field. **Effect here:** one way to confirm after install that the analytics script adds no long frames.
- **`performance/full-session-analytics`** and **`performance/batch-analytics-events`:** send analytics with `fetchLater()` (with `activateAfter` for batching) and a `visibilitychange`-based polyfill. Avoid `unload` image pixels, which are unreliable and break bfcache. **Effect here:** this applies to custom beacons. None of the vendor trackers checked uses `unload`: GoatCounter uses `sendBeacon`, while Plausible and Umami use `fetch` with `keepalive` on `visibilitychange` or `pagehide`. No action is needed unless the site adds its own events.

## Comparison

| | GoatCounter | Plausible | Umami Cloud | Cloudflare WA | Simple Analytics |
|---|---|---|---|---|---|
| Free for this site | Yes (personal use) | No: 30-day trial, then about $9/mo* | Yes: Hobby, 100K events/mo, 1 site* | Yes (soft limit 10 sites) | Yes: unlimited pageviews* |
| Retention on free | Not documented | n/a | 6 months* | 6 months (sampled after 7 days) | 30 days* |
| Script (compressed) | 3.3 KB gzip / 2.7 KB br (measured) | 2.7 KB gzip, npm build (measured) | about 1.4 to 3.2 KB (third-party) | about 4.3 KB (2020 third-party) | not measured |
| Client-side storage | None | None (reads an opt-out flag) | None (reads an opt-out flag) | None (vendor claim) | None (vendor claim) |
| Visitor identification | In-memory hash, 8 h, not stored | Daily-salted hash | Hash with monthly salt (default) | None (pageviews only) | Not checked |
| Data location | EU (Finland, Germany) | Not verified | Not verified | Not stated (US company) | Not verified |
| Export | JSON, CSV, API, delete all | CSV, Stats API (raw export is Enterprise) | API (Cloud export not verified) | GraphQL API | Not verified |
| Open source | Yes (EUPL-1.2 variant) | Yes (AGPL-3.0) | Yes (MIT) | No | No |
| Works on `*.github.io` | Yes | Yes | Yes | Yes (no DNS needed) | Yes |
| Blocked by EasyPrivacy | Yes | Yes | Yes | Yes | Yes |
| Vendor says no banner needed | "Probably" | Yes | Yes* | No claim | Yes* |

\* From a search-engine excerpt of the vendor's own page. Recheck on the live page.

## Recommendations (opinion, separate from the facts above)

1. **Use GoatCounter (hosted).** It is the only option that is free for this use, stores only aggregate data with no stored identifier, is hosted in the EU, is open source and has full export. Its script is small and can be loaded `async` at the end of `<body>`. Turn off any dimensions the owner will not read.
2. **Fallback: Cloudflare Web Analytics,** if a Cloudflare account is acceptable. It is free and has no client state. The trade-offs are six months of sampled history, a US vendor, and no unique-visitor count. Umami Cloud Hobby is the other free option, but its default monthly salt keeps a visitor identifier for up to a month, which fits the CNIL "anonymous statistics" condition less cleanly than GoatCounter. Plausible is the best documented but has no free tier.
3. **Consent:** no banner is a defensible position for an aggregate-only, first-party-purpose tool under the CNIL exemption model. It is not guaranteed EU-wide: the EDPB confirms that analytics JavaScript is within Art. 5(3) and leaves exemptions to national assessment. To meet the CNIL conditions, add a short visible note saying what is counted and by which service, with a link to its privacy page. Do not reuse or share the data.
4. **Expect undercounting** from blockers. Use Search Console and Bing Webmaster Tools for search-side numbers rather than reconciling them with the analytics.
5. **Verify after install:** no request beyond the script and the beacon, no long animation frames attributed to the script, and an unchanged Lighthouse performance score.

## Open questions

- **Privacy note:** wording and placement of the analytics disclosure on the G home page, and whether to offer an opt-out link. GoatCounter's own opt-out mechanism was not checked and may write to localStorage. This needs a design decision.
- **GoatCounter retention:** the retention period on goatcounter.com is not documented. The 25-month CNIL limit may require the owner to delete old data manually, or to ask the operator.
- **Script loading in Astro:** use the vendor `<script async>` from `gc.zgo.at`, or self-host a minified `count.js` in `public/` (one fewer third-party origin for the script, but no automatic updates).
- **Unverified figures:** current Cloudflare and Umami script sizes, and Plausible and Umami pricing, should be rechecked on the live pages from a network where those hosts resolve.
