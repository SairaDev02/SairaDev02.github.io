# AI assistant discovery in 2026

Research for issue #9 (map: #6). Question: how do ChatGPT search, Claude, Perplexity, Google AI Overviews and Copilot discover, crawl and cite websites in 2026? It covers llms.txt and llms-full.txt, the AI crawler user agents and their robots.txt controls, and what measurably affects citation of a small personal site.

Researched 2026-11-13. Sources were read on that date. A "page date" is the date the source itself states; "no date" means the page shows none.

## Evidence grades

- **A**: the owner of the system or standard documents it (vendor crawler docs, the spec, an RFC).
- **B**: first-party measurement with a stated method, but by a third party (for example an SEO vendor's log study). Valid for what it measured; not a vendor statement.
- **C**: secondary reporting, blog claims, or my inference. Treat as unverified.

Facts and recommendations are kept apart. Recommendations are only in the last section.

## 1. Who crawls, for what, and how robots.txt controls it

Each vendor separates a **search/retrieval index** crawler, a **user-triggered fetcher**, and a **training** crawler. Blocking one does not block the others.

| Vendor | Token | Role | Obeys robots.txt? | Effect of blocking | Grade |
|---|---|---|---|---|---|
| OpenAI | `OAI-SearchBot` | Search index for ChatGPT search | Yes | Site not shown in ChatGPT search answers (may still appear as a navigational link). Changes take about 24 h. | A |
| OpenAI | `ChatGPT-User` | Fetch when a user or Custom GPT asks | "robots.txt rules may not apply" | Not used to decide Search inclusion | A |
| OpenAI | `GPTBot` | Training of foundation models | Yes (robots.txt is the documented control) | Opts out of training only | A |
| OpenAI | `OAI-AdsBot` | Checks submitted ad landing pages | Not stated | Not relevant here | A |
| Anthropic | `Claude-SearchBot` | Search index for Claude | Yes | "may reduce your site's visibility and accuracy in user search results" | A |
| Anthropic | `Claude-User` | Fetch when a Claude user asks | Yes | "may reduce your site's visibility for user-directed web search" | A |
| Anthropic | `ClaudeBot` | Training | Yes, plus `Crawl-delay` | Training only; "does not affect search visibility" (paraphrase of doc) | A |
| Perplexity | `PerplexityBot` | Search index; "not used to crawl content for AI foundation models" | Yes; Perplexity recommends allowing it | Allowing it is the documented way to appear in results. Changes take up to 24 h. | A |
| Perplexity | `Perplexity-User` | Fetch on a user's question; page may be linked in the answer | Generally ignores robots.txt | Not controllable by robots.txt | A |
| Google | `Googlebot` | Search index, which also feeds AI Overviews and AI Mode | Always | Blocking removes the site from Search and its AI features | A |
| Google | `Google-Extended` | Control token only (no own UA). Training of future Gemini models and grounding in Gemini Apps and Vertex AI | Yes | "does not impact a site's inclusion in Google Search nor is it used as a ranking signal" | A |
| Google | `Google-CloudVertexBot`, `GoogleOther*` | Vertex AI agents on owner request; generic R&D fetches | Yes | No effect on Search | A |
| Microsoft | `bingbot` | Bing index, which grounds Copilot and Bing AI answers | Yes | No separate Copilot crawler or robots.txt token is documented | A (bingbot), C (no Copilot token) |

Sources:
- OpenAI, "Overview of OpenAI Crawlers", https://developers.openai.com/api/docs/bots (moved from platform.openai.com/docs/bots; no date). Also states the settings are independent, and that if both bots are allowed OpenAI may reuse one crawl for both purposes.
- Anthropic, "Does Anthropic crawl data from the web, and how can site owners block the crawler?", https://support.claude.com/en/articles/8896518 (no page date; mentions a "no AI training" preference signal recognised from 2026-10-30). IP list at claude.com/crawling/bots.json; IP blocking is said to be unreliable.
- Perplexity, "Perplexity Crawlers", https://docs.perplexity.ai/guides/bots (no date).
- Google, "Google's common crawlers", https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers (no date). Also says Google intends to support the AIPREF training token `__usage_ai-training` in early 2027.
- Microsoft, Bing blog "Your content, your choice: clearer preferences for training and grounding", https://blogs.bing.com/search/2026/10/your-content-your-choice-clearer-preferences-for-training-and-grounding/ (2026-10-30).

### Microsoft Copilot controls are changing (A)

From the Bing post of 2026-10-30:
- New **AI Training** preference (robots.txt `User-Agent: __usage_ai-training`, or page-level `<meta name="Bingbot" content="ai-training:disallow">`) and **AI Grounding** preference (page-level only: `ai-grounding:disallow` or `ai-grounding:disallowextended`). Both **default to Allow**.
- They replace `NOARCHIVE`/`NOCACHE` as AI controls. They take effect while crawling from 2027-02-01; after 2027-03-01 NoArchive/NoCache are no longer read as AI preferences.
- A site that publishes nothing stays eligible for Copilot grounding and citation.

The Bing Webmaster help pages (guidelines, "New AI Preferences") render client-side and could not be read; the blog post is the source used.

### RFC 9309 rules that matter here (A)

RFC 9309, "Robots Exclusion Protocol", Standards Track, September 2022, https://www.rfc-editor.org/rfc/rfc9309.html:
- One `/robots.txt` at the host root, UTF-8, `text/plain`.
- A crawler obeys **only the most specific matching group**; `*` applies only if no group names it. So adding `User-agent: GPTBot` with its own rules means GPTBot ignores the `*` group entirely.
- Longest matching rule wins; `allow` wins ties; unmatched paths are allowed.
- Crawlers should not use a cached copy for more than 24 hours. Parsing limit at least 500 KiB.
- 4xx: no restrictions. 5xx: assume full disallow.
- robots.txt is not access control.
- `Crawl-delay` and `Sitemap` are not in the RFC (Sitemap is a widely supported extension; Anthropic documents Crawl-delay).

### AI preference signals (AIPREF) (A, draft status)

The IETF AIPREF working group drafts (`draft-ietf-aipref-vocab-08`, 2026-09-13; `draft-ietf-aipref-attach-05`) define usage categories such as AI training and a `Content-Usage` HTTP header / robots.txt directive. They are Internet-Drafts, not standards. Microsoft has adopted the `__usage_ai-training` robots.txt token (from an individual draft) early, and Google says it will in early 2027. https://datatracker.ietf.org/wg/aipref/

## 2. llms.txt and llms-full.txt

### The spec (A)

llmstxt.org, "The /llms.txt file, v2", by Jeremy Howard; first published 2024-09-03, v2 dated August 2026. https://llmstxt.org/ and https://llmstxt.org/changes.html
- Only the H1 (site or project name) is required. Then an optional blockquote summary, optional non-heading Markdown, then H2 "file lists" of `[name](url): notes` entries.
- `## Optional` is now only a convention for secondary links. v2 dropped its mechanical meaning and the `llms_txt2ctx` / llms-ctx expansion tooling. Agents are expected to read the file and follow links.
- New in v2: per-page Markdown versions (`page.html.md` or `page.md`), `<link rel="alternate" type="text/markdown">` to a page's Markdown version, and `<link rel="describedby">` from a page to its covering llms.txt (HTML `<link>` or HTTP `Link:` header). Subpath files cover the pages under their path.
- The spec says the format is mainly for **inference** (agents at question time), not training.
- **llms-full.txt is not in the spec**, neither v1 nor v2 text mentions it. (C) It is a convention popularised by Mintlify with Anthropic for whole-docs dumps.

### Who reads it

- **Google Search does not use it** (A). The AI optimization guide says Google Search does not use llms.txt, Markdown or other AI-specific files; creating them neither helps nor harms, and it's fine to keep them for other systems. A note to this effect was added on 2026-06-15 (Search Central documentation updates). https://developers.google.com/search/docs/fundamentals/ai-optimization-guide
- **No AI vendor's crawler documentation** (OpenAI, Anthropic, Perplexity, Google, Microsoft) says its crawler or assistant reads llms.txt (A, absence in the pages above). The spec notes that OpenAI, Anthropic and Gemini *publish* llms.txt files for their developer docs; publishing is not consuming.
- **Chrome Lighthouse** has an "llms.txt" audit under agentic browsing. A missing file (404) is "N/A" because the file is "optional at the moment"; a server error is flagged. https://developer.chrome.com/docs/lighthouse/agentic-browsing/llms-txt (no date; A)
- **Measured fetches** (B): Ahrefs, "We Analyzed 137K Sites: 97% of llms.txt Files Never Get Read" (2026-06-15), https://ahrefs.com/blog/llmstxt-study/. Server-log data for May 2026: 28% of the (SEO-skewed) sample publishes the file; 97% of files got zero requests; AI bots made 19.5% of requests to the file, AI retrieval bots only 1.1%. It does **not** measure citations. Smaller log studies (C) report the same pattern.

## 3. What affects whether a site gets cited

### What vendors document (A)

- **Google AI Overviews / AI Mode**: "no additional requirements". A page must be indexed and eligible for a snippet. Standard SEO applies: crawlable text, internal links, page experience, structured data that matches visible text. No special schema; no need to chunk content or rewrite for AI. The guide emphasises a "unique point of view" over commodity content and warns against making pages for query fan-out variants. Controls: `nosnippet`, `data-nosnippet`, `max-snippet`, `noindex`. Measured in Search Console (Performance, "Web" type; the guide also names a Generative AI performance report). https://developers.google.com/search/docs/appearance/ai-features and the AI optimization guide above (no dates).
- **ChatGPT search**: allow `OAI-SearchBot` (and its IP ranges). OpenAI's publisher FAQ and launch post returned 403 to automated fetches, so OpenAI's statement on third-party search providers (Bing) was **not verified** (C).
- **Claude**: allow `Claude-SearchBot` and `Claude-User`. Anthropic does not document which index its web search uses (A, absence; C for any specific provider).
- **Perplexity**: allow `PerplexityBot` and its IPs.
- **Copilot**: content comes from the Bing index (bingbot). Bing's AI Performance report (public preview, 2026-02-10) shows citation counts, cited pages and sample grounding queries; Microsoft states these metrics "don't indicate ranking". Its recommendations: IndexNow for freshness, accurate and fresh content, clear headings, consistency across formats. https://blogs.bing.com/webmaster/February-2026/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview

### What third parties claim affects citation (C)

No controlled, method-stated study found that ties any on-site factor (llms.txt, schema, chunking) to citation for small sites. Common GEO claims are unverified and partly contradicted by Google's guide (chunking, AI-specific files). The Ahrefs study only shows that llms.txt is rarely fetched.

### Inference for a small personal site (C, my reasoning from the A facts)

Every assistant above cites from either its own search index or a large search engine index. So citation depends on: (1) the relevant search crawler being allowed, (2) the page being **indexed** by Google and Bing, and (3) distinctive text that answers the query. For this site the realistic queries are branded ("SairaDev02") and project names; the competing results are the GitHub profile and repositories themselves.

## 4. Current state of sairadev02.github.io (checked 2026-11-13)

- `robots.txt`: `User-agent: *` / `Allow: /`. Every crawler above is allowed, including training crawlers. No `Sitemap:` line.
- `/llms.txt` is served and valid against the v2 required structure (H1, blockquote, H2 file list, `## Optional`).
- No `/sitemap.xml` or `/sitemap-index.xml` (both 404).
- The home page HTML contains the repository names as server-rendered text (crawlable without JS). It has a meta description; no `rel="describedby"` link to llms.txt.
- GitHub Pages cannot send custom headers, so `X-Robots-Tag`, `Link:` and `Content-Usage` header routes are unavailable; only robots.txt and HTML `<meta>`/`<link>` are.

## 5. WebMCP (from Modern Web Guidance v1.0.0)

Source: `skills/modern-web-guidance/guides/webmcp/webmcp.md` at tag v1.0.0 of GoogleChrome/modern-web-guidance (read as Markdown).
- WebMCP is a client-side browser API (`document.modelContext.registerTool()` or annotated `<form>`s) that exposes a page's **actions** as tools to an agent already in the tab. It is in early preview behind a Chromium flag, on a draft Community Group spec.
- It has no role in crawling, indexing or citation. It only matters for agents acting inside a page, and this static portfolio has no actions to expose. Not relevant to the AI discovery goal.

## 6. Recommendations (for the decision session; not facts)

1. **Keep `User-agent: *` / `Allow: /`.** It already admits every search and retrieval crawler. Any per-bot group must restate its rules, because a named group replaces `*` for that bot (RFC 9309).
2. **Training opt-out is an owner decision**, independent of discovery. If wanted, add `GPTBot`, `ClaudeBot` and `Google-Extended` groups with `Disallow: /` (and optionally `__usage_ai-training`). This does not affect search or citation per the vendor docs.
3. **Getting indexed by Google and Bing is the main lever** for AI Overviews, AI Mode and Copilot, and probably for ChatGPT search. Coordinate with the sitemap and console tickets: add a sitemap and a `Sitemap:` line in robots.txt, verify both consoles, and use Bing's AI Performance report and Search Console to measure citations.
4. **Keep llms.txt as is.** It is cheap and harmless, and Lighthouse checks it. Do not expect a citation gain. Do not add llms-full.txt (outside the spec; a one-page site gains nothing). A `<link rel="describedby" href="/llms.txt">` in the head is an optional one-line v2 nicety.
5. **IndexNow** is an option for the nightly rebuild (Microsoft recommends it for freshness). It needs a key file on the site and an outbound call from CI, so it needs a decision.
6. **No WebMCP, no AI-specific schema, no content chunking.**
