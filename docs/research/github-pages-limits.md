# GitHub Pages platform limits for SEO and web quality

Research for issue #11 (map: #6). Question: what can a site served by GitHub Pages at a `*.github.io` domain control, and what can it not? It covers response headers and caching, CSP through a meta tag, custom 404 pages, redirects, trailing slashes and canonical URLs, `sitemap.xml` and `robots.txt` at the root, and whether Astro 7 has a maintained sitemap integration that works with this repo's static build.

Researched 2026-11-13. Sources were read on that date. A "page date" is the date the source itself states; "no date" means the page shows none. Live checks ran with `curl` on 2026-11-13 around 11:10 UTC.

## Evidence grades

- **A**: the owner of the system or standard documents it (GitHub Docs, the W3C spec, Astro docs, Google Search Central).
- **O**: observed directly on the live platform (`curl` against `sairadev02.github.io` or another `*.github.io` site), or reproduced with a local build of this repo. Valid for what was observed; GitHub may change it without notice.
- **C**: inference. Treat as unverified.

Facts and recommendations are kept apart. Recommendations are only in the last section.

## Context in this repo

- Astro `^7.4.11` (installed 7.4.11), static output, `site: 'https://sairadev02.github.io'`, no `base`, `build.inlineStylesheets: 'always'` (`astro.config.mjs`).
- Built pages: `/` (`src/pages/index.astro`) and `/llms.txt` (`src/pages/llms.txt.ts`). `public/robots.txt` exists (allow all, no `Sitemap:` line). No `404` page, no sitemap, no canonical link, no CSP meta.
- Deployed by `.github/workflows/deploy.yml`: `npm run build`, then `actions/upload-pages-artifact@v5` with `dist/`, then `actions/deploy-pages@v5`. So the publishing source is a custom GitHub Actions workflow, and no Jekyll build runs.

## 1. HTTP response headers and caching

| Finding | Grade | Source |
|---|---|---|
| The site cannot set or change any response header. GitHub Docs for Pages on github.com document no header configuration (no `_headers` file, no setting). The only documented header override is an admin setting on **GitHub Enterprise Server**, not github.com. | A (absence) + O | GitHub Docs, Pages limits, About Pages, Custom workflows (no header mention); GHES "Configuring GitHub Pages for your enterprise" (search result) |
| Headers observed on `https://sairadev02.github.io/` (200): `Content-Type: text/html; charset=utf-8`, `Cache-Control: max-age=600`, `expires` = now + 10 min, `ETag`, `Last-Modified`, `Access-Control-Allow-Origin: *`, `Strict-Transport-Security: max-age=31556952` (about one year, no `includeSubDomains`, no `preload`), `Vary: Accept-Encoding`, served through Fastly (`Via: 1.1 varnish`, `X-Cache`). | O | `curl -sI https://sairadev02.github.io/` |
| No `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` or `Cross-Origin-*` headers on our 200 responses. | O | same |
| `/robots.txt` and `/llms.txt` get the same `max-age=600` and `text/plain; charset=utf-8`. | O | `curl -sI` on both |
| The same `max-age=600` applies to every file, including hashed assets under `/_astro/` (also observed on another Pages site's CSS). Long-lived immutable caching of fingerprinted assets is not possible. | O | `curl -sI` on `google.github.io/styleguide/...css` |
| Compression: `gzip` only. A request with `Accept-Encoding: br, gzip` still gets `Content-Encoding: gzip` (home page 100,912 bytes raw, 13,610 gzipped). No Brotli. | O | `curl -sI -H 'Accept-Encoding: br, gzip'` |
| `.xml` files are served as `Content-Type: application/xml`. | O | `curl -sI` on `pages.github.com/sitemap.xml` and a `jekyll.github.io` sitemap |

## 2. Content Security Policy through a meta tag

| Finding | Grade | Source |
|---|---|---|
| Because headers are fixed (section 1), a CSP can only be delivered with `<meta http-equiv="Content-Security-Policy">`. | A + O | sections above; CSP3 §3.3 |
| In a meta policy, `report-uri`, `frame-ancestors` and `sandbox` are not supported. | A | W3C CSP Level 3, §3.3 "The `<meta>` element" (Working Draft, page date 2026-10-27) |
| `Content-Security-Policy-Report-Only` is not supported in a meta element, so there is no report-only trial mode. | A | CSP3 §3.3 |
| A meta policy does not apply to content before it: resources from `<link>` or `<script>` elements earlier in the document are not blocked. Place it as early as possible. Changes to the `content` attribute after parsing are ignored. | A | CSP3 §3.3 |
| `report-to` is not in the §3.3 list, but it names an endpoint that must be declared with the `Reporting-Endpoints` response header, which we cannot set. So CSP violation reporting is effectively unavailable. | C | inference from CSP3 §3.3 and section 1 |
| Consequence of no `frame-ancestors` and no `X-Frame-Options`: the site cannot stop other sites from framing it (clickjacking protection is out of reach). | C | inference |
| MDN's CSP header page shows a meta example but does not list the meta restrictions; the W3C spec is the authority for them. | A | MDN `Content-Security-Policy` reference (page date 2026-03-22) |
| Astro has a built-in `security.csp` option (added in Astro 6.0.0). It emits a `<meta http-equiv="content-security-policy">` in each page's `<head>` with SHA-256 hashes for the page's scripts and styles in `script-src` and `style-src`. Extra directives go in `directives`. Not supported in `astro dev` (test with `build` and `preview`); not supported with `<ClientRouter />` or Shiki; no hashes are emitted for a directive that contains `'unsafe-inline'`. | A | Astro configuration reference, `security.csp` |
| Reproduced: a throwaway build of this repo (fixture data) with `security: { csp: true }` succeeded on Astro 7.4.11 and wrote the meta tag right after `<meta charset>`, before the inlined `<style>`. The build logged a Shiki warning although the site does not use Shiki. Whether the page still works under that policy (for example inline `style` attributes, or the JSON `<script type="application/json">`) was **not** checked in a browser. | O | local `astro build` |
| GitHub's own default 404 page uses the same technique: a meta CSP (`default-src 'none'; ...`), and also sends it as a header. | O | `curl` on a missing path |

## 3. Custom 404 page

| Finding | Grade | Source |
|---|---|---|
| A `404.html` (or `404.md`) at the root of the publishing source is shown for nonexistent paths. | A | GitHub Docs, "Creating a custom 404 page for your GitHub Pages site" |
| Astro builds `src/pages/404.astro` (or `404.md`) to `404.html`; "most deploy services will find and use it". | A | Astro docs, Pages |
| Status code: the docs do not state it. Observed: a Pages site with its own `404.html` returns it with **HTTP 404**, not 200 (a soft-404 risk does not arise). | O | `curl` on `google.github.io/styleguide/nope-xyz` (404, custom title) |
| Today, `sairadev02.github.io` has no `404.html`, so missing paths get GitHub's generic "Page not found · GitHub Pages" page (404, 9,379 bytes) with no site branding or link home. | O | `curl` on `/does-not-exist-xyz` |

## 4. Redirects

| Finding | Grade | Source |
|---|---|---|
| No server-side redirects can be configured (no rules file, no setting). | A (absence) + O | GitHub Docs (no mention); section 1 |
| Platform redirects that do exist: `http://` to `https://` (301; github.io sites created after 2016-06-15 are HTTPS automatically) and a directory path without a trailing slash to the slash form (301). | A + O | GitHub Docs, "Securing your GitHub Pages site with HTTPS"; `curl -sI http://sairadev02.github.io/` returned `301` to `https://sairadev02.github.io/`; section 5 |
| Astro's `redirects` config, in a static build, writes HTML pages with a meta refresh. The configured status code (default 301) is not used by the server for these. | A | Astro docs, Routing, Redirects |
| Google treats an **instant** meta refresh (0 s) as a permanent redirect and a delayed one as temporary. JavaScript redirects are a last resort. | A | Google Search Central, "Redirects and Google Search" (no date) |
| Jekyll plugins (such as `jekyll-redirect-from`) only run in a Jekyll build; this repo's Actions workflow does not run Jekyll. | A + C | GitHub Docs, About Pages and Jekyll; `deploy.yml` |

## 5. Trailing slashes and canonical URLs

| Finding | Grade | Source |
|---|---|---|
| `/dir` (a directory with `index.html`) returns 301 to `/dir/`. | O | `curl -sI https://google.github.io/styleguide` |
| `/page` and `/page.html` **both** return 200 with the same content, without a redirect (Pages resolves extensionless URLs to `.html`). `/page.html/` returns 404. | O | `curl -sI` on `.../styleguide/pyguide` and `.../pyguide.html` |
| `/dir/index.html` also returns 200 (no redirect to `/dir/`). On our site, `https://sairadev02.github.io/index.html` returns 200 with the same body as `/`. | O | `curl -sI` |
| So duplicate URLs for one page exist and cannot be removed by redirect. The only signal available is in the HTML: `<link rel="canonical">` (and consistent internal links and sitemap URLs). | C | inference from the observations above |
| Astro: `trailingSlash` (default `'ignore'`) only affects the dev server and on-demand pages; for prerendered pages "trailing slashes ... are handled by the hosting platform". `build.format` default `'directory'` writes `/about/index.html`; Astro recommends `trailingSlash: 'always'` with `'directory'` or `'never'` with `'file'`. | A | Astro configuration reference |
| Today the site is one page at `/`, so trailing-slash duplicates only matter if pages are added. `/index.html` is the one existing duplicate. | O | build output |

## 6. `robots.txt` and `sitemap.xml` at the root

| Finding | Grade | Source |
|---|---|---|
| `robots.txt` must be at the root of the host. As a user page at the domain root, this repo controls `https://sairadev02.github.io/robots.txt` (a project page under `/<repo>/` could not). It is live today. | A + O | Google Search Central, "Create and submit a robots.txt file" (no date); `curl` |
| A `Sitemap:` line in robots.txt must be a fully qualified URL. | A | same |
| Any file in `public/` or any endpoint in `src/pages/` is published at the root, so a sitemap and a Search Console HTML verification file can also live at the root. | A + O | Astro docs, Pages; `llms.txt` is served from an endpoint today |
| No sitemap exists today (`/sitemap.xml` and `/sitemap-index.xml` return 404). | O | `curl` |

## 7. Astro 7 and `@astrojs/sitemap`

| Finding | Grade | Source |
|---|---|---|
| `@astrojs/sitemap` is Astro's official integration, maintained in the `withastro/astro` monorepo (`packages/integrations/sitemap`). Latest on npm: **3.7.4**, published 2026-08-31 (after Astro 7.0.0 on 2026-06-22). | A | `npm view @astrojs/sitemap`; npm `time` data |
| It declares **no `peerDependencies`** and no `engines` (npm 3.7.4 and `package.json` on `main`), so there is no stated Astro range to check against Astro 7. The repo's `main` uses `astro: workspace:*` as a dev dependency, so it is developed against the current Astro. `main` already depends on `sitemap ^10` while the published 3.7.4 uses `sitemap ^9`; an unreleased update is pending. | A | `npm view ... peerDependencies engines`; raw `package.json` on GitHub `main` |
| The Astro docs give no Astro-version compatibility statement for the integration. | A | Astro docs, `@astrojs/sitemap` guide |
| Behaviour: requires `site`; writes `sitemap-index.xml` plus numbered `sitemap-0.xml`; covers static routes only; options include `filter`, `customPages`, `serialize`, `lastmod`, `i18n`, `filenameBase`, `namespaces`, `chunks`. Google ignores `changefreq` and `priority`. Docs recommend `<link rel="sitemap" href="/sitemap-index.xml">` and a `Sitemap:` line in robots.txt (optionally generated from `src/pages/robots.txt.ts` to reuse `site`). | A | Astro docs, `@astrojs/sitemap` guide |
| Reproduced: installing 3.7.4 into this repo (no peer warning) and building from the e2e fixture on Astro 7.4.11 succeeded. Output: `sitemap-index.xml` pointing to `https://sairadev02.github.io/sitemap-0.xml`, which lists one URL, `https://sairadev02.github.io/`. `/llms.txt` is not listed (non-HTML endpoint). The `sitemap-0.xml` declares the news, xhtml, image and video namespaces by default (trim with `namespaces`). | O | local `astro build` with a throwaway config, not committed |

## Other platform facts that touch web quality

- Published site at most 1 GB; soft bandwidth limit 100 GB per month; deployments time out after 10 minutes; rate limiting returns HTTP 429. The 10-builds-per-hour soft limit does not apply to custom Actions workflows. (A, GitHub Docs, "GitHub Pages limits")
- Pages is not meant for commercial sites or sensitive transactions. (A, same)
- Astro's GitHub deploy guide recommends the official `withastro/action`; this repo builds with `npm run build` and `actions/upload-pages-artifact` instead. Both publish a static `dist/`; this is a difference from the docs' suggestion, not a defect. (A, Astro docs, "Deploy your Astro site to GitHub Pages")

## Recommendations (for the decision session)

These follow from the facts above; they are not decisions.

1. **Treat headers as fixed.** Drop any requirement that needs a response header (HSTS preload, `X-Content-Type-Options`, `frame-ancestors`/`X-Frame-Options`, `Referrer-Policy`, long immutable caching, Brotli). Expect the web.dev audit to flag some of these as platform limits, not site defects.
2. **CSP, if wanted, through Astro `security.csp`** (meta, hashed). Accept that it cannot do `frame-ancestors`, `sandbox`, reporting or report-only. Verify in a browser (and in e2e) that the page still works under the policy before shipping; that was not checked here. Whether to add a CSP at all is a separate decision.
3. **Add `src/pages/404.astro`** in the G palette with a link home; Pages serves it with a real 404 status.
4. **Canonical:** emit `<link rel="canonical" href="https://sairadev02.github.io/">` (from `Astro.site` and the path) to consolidate `/` and `/index.html`. If pages are added later, pick one URL form (Astro default `directory` + trailing slash matches Pages' own 301) and use it in links, canonical and sitemap.
5. **Redirects:** avoid needing them; if a URL ever moves, use Astro `redirects` (instant meta refresh), which Google treats as permanent.
6. **Sitemap:** use `@astrojs/sitemap` 3.7.4 (works with Astro 7.4.11 here). Add a `Sitemap: https://sairadev02.github.io/sitemap-index.xml` line to robots.txt, and consider `namespaces` to drop unused ones. For a one-page site a hand-written `public/sitemap.xml` is a valid zero-dependency alternative; the choice is the decision session's.

## Sources

- GitHub Docs, "GitHub Pages limits": https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
- GitHub Docs, "Creating a custom 404 page for your GitHub Pages site": https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-custom-404-page-for-your-github-pages-site
- GitHub Docs, "Securing your GitHub Pages site with HTTPS": https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https
- GitHub Docs, "Using custom workflows with GitHub Pages": https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
- GitHub Docs, "About GitHub Pages": https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages
- GitHub Docs, "About GitHub Pages and Jekyll": https://docs.github.com/en/pages/setting-up-a-github-pages-site-with-jekyll/about-github-pages-and-jekyll
- W3C, Content Security Policy Level 3, §3.3: https://www.w3.org/TR/CSP3/
- MDN, `Content-Security-Policy` header: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy
- Astro docs, `@astrojs/sitemap`: https://docs.astro.build/en/guides/integrations-guide/sitemap/
- Astro docs, configuration reference (`trailingSlash`, `build.format`, `security.csp`): https://docs.astro.build/en/reference/configuration-reference/
- Astro docs, Pages: https://docs.astro.build/en/basics/astro-pages/
- Astro docs, Routing (redirects): https://docs.astro.build/en/guides/routing/
- Astro docs, Deploy to GitHub Pages: https://docs.astro.build/en/guides/deploy/github/
- npm registry, `@astrojs/sitemap` (`npm view`): https://www.npmjs.com/package/@astrojs/sitemap
- `withastro/astro`, `packages/integrations/sitemap/package.json` on `main`: https://github.com/withastro/astro/blob/main/packages/integrations/sitemap/package.json
- Google Search Central, "Redirects and Google Search": https://developers.google.com/search/docs/crawling-indexing/301-redirects
- Google Search Central, "Create and submit a robots.txt file": https://developers.google.com/search/docs/crawling-indexing/robots/create-robots-txt
