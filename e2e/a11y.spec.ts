// Accessibility of the built site: an axe-core scan of the home page in both themes (plain,
// a row previewed, a repository opened), the 404 page, and the keyboard skip link.
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './test';

/** What a scan returns, typed from the builder itself rather than the axe-core package. */
type Scan = Awaited<ReturnType<AxeBuilder['analyze']>>;

/** A scan's violations as lines a failing test can be read from. */
const violations = (results: Scan) =>
  results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);

test.describe('axe scan', () => {
  test('the 404 page has no violations', async ({ page }) => {
    await page.goto('/no-such-track');
    const results = await new AxeBuilder({ page }).analyze();
    expect(violations(results)).toEqual([]);
  });
});

test.describe('axe scan in both themes', () => {
  for (const scheme of ['light', 'dark'] as const) {
    for (const path of ['/', '/no-such-track']) {
      test(`${path} has no violations in ${scheme}`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await page.goto(path);
        const results = await new AxeBuilder({ page }).analyze();
        expect(violations(results)).toEqual([]);
      });
    }

    test(`a previewed row has no violations in ${scheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/');
      await page.locator('[data-asset="1"]').focus();
      await expect(page.locator('[data-asset="1"]')).toBeFocused();
      const results = await new AxeBuilder({ page }).analyze();
      expect(violations(results)).toEqual([]);
    });

    test(`an opened repository has no violations in ${scheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      // The tab an Open makes is not the subject: the page that opens it is.
      await page.addInitScript(() => {
        Object.defineProperty(window, 'open', { configurable: true, writable: true, value: () => ({ opener: null }) });
      });
      await page.goto('/');
      await page.locator('[data-asset="0"]').click();
      await expect(page.locator('[data-asset="0"]')).toHaveAttribute('data-opened', 'true');
      await expect(page.getByRole('status')).toHaveText('Opened tidepool in a new tab');
      const results = await new AxeBuilder({ page }).analyze();
      expect(violations(results)).toEqual([]);
    });
  }
});

test.describe('skip link', () => {
  test('is the first stop, revealed on focus, and moves focus to the board', async ({ page }) => {
    await page.goto('/');
    const skip = page.getByRole('link', { name: 'Skip to repositories' });
    // Hidden by position, not by display, so it stays in the accessibility tree and the
    // tab order.
    await expect(skip).not.toBeInViewport();

    await page.keyboard.press('Tab');
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();

    await page.keyboard.press('Enter');
    const repositories = page.getByRole('region', { name: 'Repositories' });
    await expect(repositories).toBeFocused();
    await expect(repositories).toHaveCSS('outline-style', 'solid');
    await expect(repositories.locator('[data-asset]')).toHaveCount(4);
  });

  test('rings the board only when the skip link moves focus there, not on a click', async ({ page }) => {
    await page.goto('/');
    const repositories = page.getByRole('region', { name: 'Repositories' });
    // A click on the board's own padding focuses the list itself (tabindex="-1").
    await repositories.click({ position: { x: 4, y: 3 } });
    await expect(repositories).toBeFocused();
    await expect(repositories).toHaveCSS('outline-style', 'none');
  });

  test('is left off pages with nothing to skip to', async ({ page }) => {
    await page.goto('/no-such-track');
    await expect(page.getByRole('link', { name: 'Skip to repositories' })).toHaveCount(0);
  });
});
