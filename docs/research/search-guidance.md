# Search guidance for a developer profile site

Research for issue #7 (map: #6). Retrieved 2026-11-13.

**Question:** What does current official guidance (Google Search Central, Bing, schema.org) recommend for a static, single-owner developer profile site whose goals are branded search for `SairaDev02` and search for its repository names? This covers title links, snippets, canonical URLs, sitemaps (with `lastmod`), IndexNow, and structured data (ProfilePage, Person, WebSite, SoftwareSourceCode, ItemList). It also notes recent changes and deprecations.

**Site as it stands (origin/main `fa87da1`):** one HTML page at `https://sairadev02.github.io/` plus `/llms.txt`. `<title>` is `SairaDev02 · public work`, and the meta description is `Public repositories of SairaDev02, played as a playlist.` The visible `<h1>` is "SairaDev02 public work". Repository names and descriptions are server-rendered text in an `<ol>`, and each one links to its GitHub repository. There is no canonical link, sitemap, Open Graph, or JSON-LD. `robots.txt` allows all crawlers and has no `Sitemap:` line.

Sources are first-party: Google Search Central docs (each with its "Last updated" date), the Google Search Central blog, the Bing Webmaster blog and guidelines, indexnow.org, schema.org (V30.1, 2026-09-16), and the Public Suffix List.

## Facts

### Title links

Source: [Google, Influencing title links](https://developers.google.com/search/docs/appearance/title-link), last updated 2025-12-10.

- Every page should have a descriptive, concise `<title>`. Avoid vague text, keyword stuffing, and boilerplate.
- Google generates title links from these sources: `<title>`, the main visible title, headings such as `<h1>`, `og:title`, other prominent styled text, page text, anchor text on the page, the text of links pointing to the page, and `WebSite` structured data.
- **Recent change:** `og:title` was added as a documented source on 2024-08-26 ([changelog](https://developers.google.com/search/updates)).
- The home page `<title>` is a reasonable place for information about the site. On other pages, a short site name with a delimiter works well. Google may drop a site name from the title link when it repeats the site name already shown in the result.
- Changes can take days to weeks to be picked up.

### Snippets and meta descriptions

Source: [Google, Control your snippets](https://developers.google.com/search/docs/appearance/snippet), last updated 2026-04-20.

- Snippets come mainly from page content and vary by query. Google uses the meta description when it describes the page better. The changelog clarified on 2024-01-05 that page content is the primary source.
- There is no length limit, but Google truncates to fit the device. Use a site-level description on the home page, and avoid keyword lists and generic text.
- `nosnippet`, `max-snippet`, and `data-nosnippet` control what Google shows. The same robots controls also apply to AI features: AI Mode was added to the robots meta tag docs on 2025-03-05, and a "Control what you share" page covering them was updated on 2026-10-21 ([changelog](https://developers.google.com/search/updates)).
- **Recent change:** the snippet doc gained a section on "read more" deep links on 2026-04-20.
- Bing: its Webmaster Guidelines say that missing, duplicate, or very short titles and meta descriptions may reduce indexing reliability, ranking, and eligibility for grounding (Copilot) citations. [Bing Webmaster Guidelines](https://www.bing.com/webmasters/help/webmaster-guidelines-30fba23a) were updated around mid-2026. **Caveat:** the page renders client-side and could not be fetched directly, so this wording comes from a search-engine excerpt of it.

### Site names (branded search)

Source: [Google, Provide a site name](https://developers.google.com/search/docs/appearance/site-names), last updated 2025-12-10.

- `WebSite` structured data on the home page is the most important signal for the site name. It requires `name` and `url`, and recommends `alternateName` as an ordered list of fallbacks, which can end with the lowercase domain.
- Site names work per domain and per subdomain. Subdirectories are not supported. The markup must be on the root home page, and that page must be crawlable.
- Other sources Google considers are `og:site_name`, `<title>`, headings, home-page text, and references from elsewhere on the web.
- The Rich Results Test does not support site names. Validate with the Schema Markup Validator and URL Inspection instead.
- `github.io` is on the [Public Suffix List](https://publicsuffix.org/list/public_suffix_list.dat) (GitHub section), so `sairadev02.github.io` behaves as its own registrable domain. Google's doc does not mention github.io, but it says subdomain-level site names are supported. **Inference:** the site can have its own site name.
- Changelog: subdomain support was added 2023-05-22, all languages 2023-09-07, and a propagation warning was removed 2024-06-04.

### Canonical URLs

Source: [Google, Consolidate duplicate URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls), last updated 2026-07-10.

- Signal strength: redirects and `rel="canonical"` (HTML or HTTP header) are strong signals; a sitemap is a weak one. Use absolute URLs, and do include a self-referencing canonical on the canonical page.
- For a single-page site a canonical is not required. Google says such a site will "likely do just fine" without one.
- Mistakes to avoid include conflicting canonicals across methods, fragment URLs as canonicals, letting JavaScript change the canonical, and linking internally to non-canonical variants.
- Google prefers HTTPS. GitHub Pages serves HTTPS (platform behavior is covered by ticket #11).
- **Recent changes:** JavaScript canonicalization best practices were added 2025-12-17, and the troubleshooting doc on re-evaluation time was clarified 2026-07-10.

### Sitemaps and `lastmod`

Sources:
- Google, [Sitemaps overview](https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview) (2025-12-10) and [Build and submit a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap) (2026-07-08)
- Google blog, [Sitemaps ping endpoint is going away](https://developers.google.com/search/blog/2023/06/sitemaps-lastmod-ping) (2023-06-26)
- Bing blog, [The importance of setting the lastmod tag](https://blogs.bing.com/webmaster/2023/2/The-Importance-of-Setting-the-lastmod-Tag-in-Your-Sitemap/) (2023-02) and [Keeping content discoverable with sitemaps in AI powered search](https://blogs.bing.com/webmaster/2025/7/Keeping-Content-Discoverable-with-Sitemaps-in-AI-Powered-Search/) (2025-07-31)

Facts:
- Google: a site "about 500 pages or fewer" that is fully linked from the home page might not need a sitemap. Google still says most sites benefit from one.
- Google ignores `priority` and `changefreq`. Bing ignores them too (2025-07-31).
- Google uses `lastmod` only if it is "consistently and verifiably" accurate, meaning the last significant change to main content, structured data, or links. A copyright-year bump does not count. It is fine to omit `lastmod` for pages where it is hard to determine.
- Bing treats `lastmod` as an important recrawl signal. Bing recommends ISO 8601 with a time, set to when the content changed, not to sitemap generation time. Bing may disregard dates that always equal the current date (2023-02).
- Use absolute canonical URLs. Submit through Search Console or Bing Webmaster Tools, or with a `Sitemap:` line in robots.txt (Google and Bing both accept this). Bing fetches a submitted sitemap immediately and then at least daily.
- **Deprecated:** Google's unauthenticated sitemap ping endpoint was deprecated 2023-06-26 and now returns 404.
- Bing recommends using a sitemap and IndexNow together.

### IndexNow

Sources: [indexnow.org documentation](https://www.indexnow.org/documentation), [participating engines](https://www.indexnow.org/searchengines.json), and the Bing posts above.

- Ownership is proven by hosting a UTF-8 key file at `/{key}.txt` that contains the key. Keys are 8 to 128 characters of letters, digits, and dashes.
- Changed URLs are submitted by GET (one URL) or by POST JSON (up to 10,000 URLs). URLs should be added, updated, or deleted URLs only. A `429` response flags over-submission.
- One submission is shared with all participants: Bing, Yandex, Seznam, Naver, Yep, Internet Archive, and Amazonbot. **Google is not a participant.**
- Fit for this site: the key file can be a static file in `public/`. Submission needs a POST after deploy, which would be a step in the Pages workflow. The key is public by design. That is an inference from the protocol, not a stated rule.

### Structured data: what applies and what renders

Sources:
- Google, [Search gallery](https://developers.google.com/search/docs/appearance/structured-data/search-gallery) (2026-10-16)
- Google, [General structured data guidelines](https://developers.google.com/search/docs/appearance/structured-data/sd-policies) (2026-07-10)
- Google, [ProfilePage](https://developers.google.com/search/docs/appearance/structured-data/profile-page) (2026-09-08)
- Google, [Software app](https://developers.google.com/search/docs/appearance/structured-data/software-app) (2026-09-08)
- Google, [Carousel / ItemList](https://developers.google.com/search/docs/appearance/structured-data/carousel) (2026-09-08)
- schema.org [ProfilePage](https://schema.org/ProfilePage) and [SoftwareSourceCode](https://schema.org/SoftwareSourceCode) (V30.1)

General rules: markup must describe visible content and represent the page, and related items should be linked with `@id`. No markup guarantees a rich result.

| Type | Google feature? | Visible rich result for this site? | Notes |
|---|---|---|---|
| `WebSite` | Yes, site names (not in the rich-result gallery) | Site name shown above the result | Home page only, with `name`, `url`, and `alternateName`. This is the type that directly serves branded search. |
| `ProfilePage` + `mainEntity: Person` | Yes, "Profile page" in the gallery | No standalone visual. Google uses it to understand creators, including in Discussions and Forums (renamed from Perspectives, 2024-08-23). | Eligible: a page whose primary focus is a single person affiliated with the site (an "About me" page qualifies). `name` is required, or `alternateName` can satisfy it. Recommended: `alternateName` (a handle), `identifier`, `description`, `image`, `sameAs`, `interactionStatistic`, `agentInteractionStatistic`, and `dateCreated`/`dateModified` on the page. A handle-only `Person` (`name: "SairaDev02"`) fits the identity constraint. |
| `Person` | Only as ProfilePage's `mainEntity` (or as an author elsewhere) | No | Google's `Organization` feature (logo, knowledge panel details) is for organizations, not people. |
| `SoftwareSourceCode` | **No.** It is not in the gallery. | No | Valid schema.org (`codeRepository`, `programmingLanguage`, `runtimePlatform`, `targetProduct`). It has no Google rich result. Its only value is machine-readable description for other consumers. |
| `SoftwareApplication` | Yes, "Software app" | Only for a real app | Requires `name`, `offers.price`, and `aggregateRating` or `review`. Repositories without genuine ratings do not qualify, and fake ratings violate policy. |
| `ItemList` | Only as a carousel paired with Recipe, Course list, Restaurant, or Movie | No | An `ItemList` of repositories produces no Google rich result. |

### AI features (relevant overlap with #9 and #17)

Source: [Google, AI optimization guide](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide), new 2026-05-15, with an llms.txt note added 2026-06-15.

- Google Search does not use `llms.txt`. Having one "will neither harm nor help" Search visibility, and it is fine to keep for other systems.
- No special schema is needed for AI features. Structured data still matters for rich-result eligibility. "Overfocusing on structured data" is listed as something to ignore.

### Deprecations and recent changes (newest first)

| Date | Change | Relevance |
|---|---|---|
| 2026-06-15 | Google: Search doesn't use llms.txt | The site ships `/llms.txt`. It is harmless, but not a Google signal. |
| 2026-05-07 | Google FAQ rich results stopped appearing (docs removed 2026-06-15) | Don't add FAQPage for Google. |
| 2026-01 | Practice problem and Dataset results phased out; Search Console support removed | None |
| 2025-06-12 / 2025-09-09 | Book actions, Course info, Claim review, Estimated salary, Learning video, Special announcement, and Vehicle listing phased out | None. Google says unused markup causes no problems. |
| 2025-01 | Breadcrumbs no longer shown on mobile results | Low (single page) |
| 2024-11-21 | Sitelinks search box removed ([blog](https://developers.google.com/search/blog/2024/10/sitelinks-search-box)). `WebSite` markup is still used for site names. | Don't add `potentialAction: SearchAction`. |
| 2024-08-26 | `og:title` documented as a title-link source | `og:title` is also needed for previews (#8). |
| 2023-12 | Google sitemap ping endpoint stopped working | Use robots.txt `Sitemap:` or Search Console. |
| 2023-09-14 | HowTo docs removed; FAQ limited (now gone entirely) | None |

## Recommendations (inferences for the decision sessions; not decided)

1. **Branded search:** add home-page `WebSite` JSON-LD with `name: "SairaDev02"`, `url: "https://sairadev02.github.io/"`, and `alternateName` ending in `"sairadev02.github.io"`. Keep `SairaDev02` leading the `<title>` and `<h1>`, as today. Add `og:site_name` and `og:title` that agree with them. This has the strongest documented effect for the lowest cost.
2. **Identity:** add `ProfilePage` with `mainEntity` `Person` {`name`/`alternateName`: `SairaDev02`, `url`, `sameAs: ["https://github.com/SairaDev02"]`, optionally `image` set to the GitHub avatar}, linked to `WebSite` by `@id`. It shows no visible result but clarifies the entity. The home page arguably qualifies as a profile page, but that is a judgment call for #15 and #14. Never set a real name.
3. **Repository search:** no Google rich result applies to repositories. Project-name search depends on visible text: names and descriptions are already server-rendered, which is what matters. **Inference:** the GitHub repository pages themselves will usually outrank this site for repo names. The realistic goal is for the site to appear alongside them, not instead of them. Optionally, add an `ItemList` of `SoftwareSourceCode` (with `codeRepository` and `programmingLanguage`) for non-Google consumers. Do not use `SoftwareApplication` with invented ratings. Ticket #13's baseline should test this.
4. **Canonical:** add an absolute self-referencing `<link rel="canonical" href="https://sairadev02.github.io/">` in the static HTML. It is optional per Google, but cheap, and it guards against query-string variants.
5. **Sitemap:** add a one-URL sitemap (for example `@astrojs/sitemap`, or a hand-written endpoint like `llms.txt.ts`) and a `Sitemap:` line in `robots.txt`. Set `lastmod` only to a real content change, for example the newest repository push date that the page already shows as "updated". Never use the build time: the nightly rebuild would make it always "today", and Bing says it may then ignore it. Omit `changefreq` and `priority`. The final shape depends on #14 (more pages or not).
6. **IndexNow:** optional, and only reaches Bing and the other participants, not Google. It is worth it only if Bing and Copilot freshness matters. It costs a key file in `public/` and a post-deploy POST step in the deploy workflow. That counts as new workflow behavior, so it needs owner approval if it would gate anything. On a one-page site with nightly rebuilds, a sitemap with an honest `lastmod` probably covers most of the benefit.
7. **Don't add:** `SearchAction` (sitelinks search box), FAQPage, HowTo, `SoftwareApplication` without real reviews, or an `ItemList` expecting a carousel.

## Open questions surfaced

- **Is the home page a "profile page"** under Google's eligibility rule ("primary focus is a single person"), or should ProfilePage live on a separate About page? This bears on #14 and #15.
- **What should `lastmod` mean:** the newest repository push, or a change to the site's own content? Repository pushes change the rendered page (the "updated" date and the list), so they arguably count as significant changes. Decide in #15 or #14.
- **IndexNow in the deploy workflow:** in scope or not? It adds a workflow step and a key file. This is new and not covered by any existing ticket.
- **`image` for Person:** use the GitHub avatar URL, or a self-hosted copy? This ties to #16 (preview image) and the identity constraint.
- **Verification with Bing:** the Bing guidelines page renders client-side and was read only through a search excerpt. Its wording on titles, descriptions, and structured data should be re-checked in a browser if a decision hinges on it.
