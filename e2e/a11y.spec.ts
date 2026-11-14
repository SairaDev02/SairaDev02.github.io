// Accessibility of the built site: an axe-core scan in the five states the spec names, and
// the keyboard skip link. The Lyrics panel's gradient is reported by axe as incomplete
// rather than checked, so its contrast is measured by hand and recorded on ticket #31.
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './test';

/** What a scan returns, typed from the builder itself rather than the axe-core package. */
type Scan = Awaited<ReturnType<AxeBuilder['analyze']>>;

/** A scan's violations as lines a failing test can be read from. */
const violations = (results: Scan) =>
  results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);

/** Whether a rule ran at all: a rule that never ran cannot have found anything. */
const ranRule = (results: Scan, rule: string) =>
  [...results.passes, ...results.incomplete].some((r) => r.id === rule);

const openPanel = async (page: Page, name: 'Lyrics' | 'Queue') => {
  const toggle = page.getByRole('button', { name, exact: true });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
};

test.describe('axe scan', () => {
  test('the home page has no violations with the panels closed', async ({ page }) => {
    await page.goto('/');
    const results = await new AxeBuilder({ page }).analyze();
    expect(violations(results)).toEqual([]);
  });

  test('the Lyrics panel has no violations', async ({ page }) => {
    await page.goto('/');
    await openPanel(page, 'Lyrics');
    const results = await new AxeBuilder({ page }).analyze();
    expect(violations(results)).toEqual([]);
  });

  test('the Queue panel has no violations, and no cue name drifts from its visible text', async ({ page }) => {
    await page.goto('/');
    await openPanel(page, 'Queue');
    const results = await new AxeBuilder({ page }).analyze();
    expect(violations(results)).toEqual([]);
    // A zero-violation result only proves the rule found nothing if it ran at all.
    expect(ranRule(results, 'label-content-name-mismatch')).toBe(true);
  });

  test('the home page has no violations while a play runs', async ({ page }) => {
    // The tab a play opens is not the subject: the page that plays is.
    await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
    await page.addInitScript(() => {
      Object.defineProperty(window, 'open', { configurable: true, writable: true, value: () => ({ opener: null }) });
    });
    await page.goto('/');
    await page.locator('[data-dock] [data-np="play"]').click();
    // Past the load: Eject is on the faceplate and the disc is playing.
    await page.clock.fastForward(1_600);
    await expect(page.locator('[data-lcd-eject]')).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(violations(results)).toEqual([]);
  });

  test('the 404 page has no violations', async ({ page }) => {
    await page.goto('/no-such-track');
    const results = await new AxeBuilder({ page }).analyze();
    expect(violations(results)).toEqual([]);
  });
});

test.describe('skip link', () => {
  test('is the first stop, revealed on focus, and moves focus to the track list', async ({ page }) => {
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
    await expect(repositories.locator('[data-track]')).toHaveCount(4);
  });

  test('is left off pages with nothing to skip to', async ({ page }) => {
    await page.goto('/no-such-track');
    await expect(page.getByRole('link', { name: 'Skip to repositories' })).toHaveCount(0);
  });
});
