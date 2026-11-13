// The shared test fixture: fails any test whose page logs a console error or throws, and
// answers navigation to GitHub with a stub page so tests never leave the machine.
import { test as base, expect } from '@playwright/test';

export const test = base.extend<{ pageErrors: string[] }>({
  pageErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      // A navigation the test makes on purpose can answer with an error status: the 404
      // page. Chromium logs that document as a failed resource, which is the response the
      // test asked for, so it is not a console error. Assets the document then requests
      // are still reported, because their URLs are not navigations.
      const failedNavigations = new Set<string>();
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('response', (response) => {
        const request = response.request();
        if (request.isNavigationRequest() && request.frame() === page.mainFrame() && response.status() >= 400) {
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
