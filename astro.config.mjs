// @ts-check
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';

// The pre-paint theme script that BaseLayout inlines verbatim. Astro does not hash
// `is:inline` scripts, so its hash is added to the policy below. Browsers hash the text
// with LF newlines, whatever the checkout's line endings.
const themeInit = readFileSync(new URL('./src/scripts/theme-init.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
/** @type {`sha256-${string}`} */
const themeInitHash = `sha256-${createHash('sha256').update(themeInit).digest('base64')}`;

/**
 * Serves the link preview card's source at /og-card in dev only. The page lives outside
 * src/pages, so no build ever emits it: the production site carries the committed PNG
 * (src/assets/og-card.png), not the route that draws it.
 * @type {import('astro').AstroIntegration}
 */
const ogCardRoute = {
  name: 'og-card-route',
  hooks: {
    'astro:config:setup': ({ command, injectRoute }) => {
      if (command !== 'dev') return;
      injectRoute({ pattern: '/og-card', entrypoint: './src/dev/og-card.astro' });
    },
  },
};

// Served as the GitHub Pages user page, so at the domain root: no `base`.
export default defineConfig({
  site: 'https://sairadev02.github.io',
  // The playlist cover is the GitHub portrait, fetched and re-encoded at build time.
  image: { domains: ['avatars.githubusercontent.com'] },
  // The stylesheet is small; inlining it removes a render-blocking request.
  build: { inlineStylesheets: 'always' },
  security: {
    // A meta Content Security Policy, because GitHub Pages sends no response headers. A
    // meta policy ignores `frame-ancestors`, `report-uri` and `sandbox`, so they are left
    // out: framing stays unpreventable on Pages, and Trusted Types is the mitigation.
    csp: {
      directives: [
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'none'",
        "require-trusted-types-for 'script'",
        "trusted-types 'none'",
      ],
      scriptDirective: { hashes: [themeInitHash] },
      // Astro hashes the inline styles and scripts it emits; CdPlayer.astro adds the hash
      // of its own inline style element. The pages carry no style attributes, so nothing
      // needs `'unsafe-inline'`.
    },
  },
  integrations: [ogCardRoute],
});
