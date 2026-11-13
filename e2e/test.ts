// The shared test fixture: fails any test whose page logs a console error or throws, and
// answers navigation to GitHub with a stub page so tests never leave the machine.
import { test as base, expect } from '@playwright/test';

export const test = base.extend<{ pageErrors: string[] }>({
  pageErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text());
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
