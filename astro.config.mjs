// @ts-check
import { defineConfig } from 'astro/config';

// Served as the GitHub Pages user page, so at the domain root: no `base`.
export default defineConfig({
  site: 'https://sairadev02.github.io',
  // The stylesheet is small; inlining it removes a render-blocking request.
  build: { inlineStylesheets: 'always' },
});
