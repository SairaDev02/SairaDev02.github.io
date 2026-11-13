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
  // The stylesheet is small; inlining it removes a render-blocking request.
  build: { inlineStylesheets: 'always' },
  integrations: [ogCardRoute],
});
