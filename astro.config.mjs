// @ts-check
import { defineConfig } from 'astro/config';

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
      // Astro hashes the inline styles and scripts it emits; CdPlayer.astro adds the hash
      // of its own inline style element. The pages carry no style attributes, so nothing
      // needs `'unsafe-inline'`.
    },
  },
  integrations: [ogCardRoute],
});
