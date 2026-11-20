// The shared test fixture: fails any test whose page logs a console error or throws, and
// answers navigation to GitHub with a stub page so tests never leave the machine.
import { test as base, expect, type Page } from '@playwright/test';

export const test = base.extend<{ pageErrors: string[] }>({
  pageErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      // A navigation the test makes on purpose can answer 404: that is the response the
      // unknown-path test asks for, so Chromium logging it as a failed resource is expected
      // and not a console error. Any other error status (a 500) stays an error. Assets the
      // document then requests are still reported, because their URLs are not navigations.
      const failedNavigations = new Set<string>();
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('response', (response) => {
        const request = response.request();
        if (request.isNavigationRequest() && request.frame() === page.mainFrame() && response.status() === 404) {
          failedNavigations.add(request.url());
        }
      });
      page.on('console', (m) => {
        if (m.type() !== 'error') return;
        if (m.text().startsWith('Failed to load resource') && failedNavigations.has(m.location().url)) return;
        errors.push(m.text());
      });
      await page.context().route('https://github.com/**', (route) =>
        route.fulfill({ contentType: 'text/html', body: '<title>GitHub stub</title>' }),
      );
      await use(errors);
      expect(errors, 'console errors or uncaught exceptions').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

// The lazy scene chunks: the sensor view, the background field, and the chunk they share,
// which holds three.js (Rollup names it after one of its modules, gpu/bayer.ts).
const LAZY_CHUNK = /\/_astro\/(scene|field|bayer)\.[^/]*\.js/;

/** The lazy chunks the page requested before and after its load event. It reads the page's
 * own timeline, not the order Playwright reports events in: Playwright's `load` event can
 * reach the test after the first request that the page's load handler makes. */
export async function lazyChunkRequests(page: Page): Promise<{ before: string[]; after: string[] }> {
  return page.evaluate((source) => {
    const pattern = new RegExp(source);
    const [nav] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    const chunks = performance.getEntriesByType('resource').filter((e) => pattern.test(e.name));
    return {
      before: chunks.filter((e) => e.startTime < nav.loadEventStart).map((e) => e.name),
      after: chunks.filter((e) => e.startTime >= nav.loadEventStart).map((e) => e.name),
    };
  }, LAZY_CHUNK.source);
}
