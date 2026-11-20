// The sensor view: Assets found by their HUD tags (A-01...), previewed and opened by
// pointing or tapping just left of the tag, where the marker is. Fixture order: A-01
// tidepool (Active, Rust, 5 commits), A-02 paper-lantern, A-03 quiet-notes, A-04 empty-box.
import type { Page } from '@playwright/test';
import { expect, lazyChunkRequests, test } from './test';

const row = (page: Page, i: number) => page.locator(`[data-asset="${i}"]`);
const status = (page: Page) => page.getByRole('status');
const tagEl = (page: Page, tag: string) => page.locator(`[data-sensor-tag="${tag}"]`);
const card = (page: Page) => page.locator('[data-sensor-card]');
const canvas = (page: Page) => page.locator('[data-sensor-frame] canvas');

/** Where the Asset's marker is: just left of its tag. */
async function markerOf(page: Page, tag: string) {
  const el = tagEl(page, tag);
  await expect(el).toBeVisible();
  const b = (await el.boundingBox())!;
  return { x: b.x - 8, y: b.y + b.height / 2 };
}

const stubOpen = (page: Page) =>
  page.addInitScript(() => {
    const calls: string[] = [];
    (window as unknown as { openCalls: string[] }).openCalls = calls;
    Object.defineProperty(window, 'open', {
      configurable: true,
      writable: true,
      value: (url: string) => (calls.push(url), { opener: 'untouched' }),
    });
  });
const openCalls = (page: Page) => page.evaluate(() => (window as unknown as { openCalls: string[] }).openCalls);

test.describe('preview', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('hovering a row shows its Asset card; leaving clears it; nothing is announced', async ({ page, isMobile }) => {
    test.skip(isMobile, 'no hover on touch screens');
    await expect(tagEl(page, 'A-01')).toBeVisible();
    await expect(card(page)).toBeHidden();
    await row(page, 0).hover();
    await expect(card(page)).toBeVisible();
    await expect(card(page)).toContainText('A-01 · In view');
    await expect(card(page)).toContainText('TIDEPOOL');
    await expect(card(page)).toContainText('Rust · 5 commits');
    await expect(card(page)).toContainText('Uplink 2026.10.20 · Active');
    await expect(status(page)).toHaveText('');
    await page.mouse.move(0, 0);
    await expect(card(page)).toBeHidden();
  });

  test('focusing a row shows its card with the right status; blur clears it', async ({ page }) => {
    await expect(tagEl(page, 'A-04')).toBeVisible();
    await row(page, 3).focus();
    await expect(card(page)).toBeVisible();
    await expect(card(page)).toContainText('A-04 · In view');
    await expect(card(page)).toContainText('EMPTY-BOX');
    await expect(card(page)).toContainText('Dormant');
    await expect(status(page)).toHaveText('');
    await row(page, 3).blur();
    await expect(card(page)).toBeHidden();
  });

  test('pointing at an Asset previews it, and its row is not changed', async ({ page, isMobile }) => {
    test.skip(isMobile, 'no hover on touch screens');
    const at = await markerOf(page, 'A-02');
    await page.mouse.move(at.x, at.y);
    await expect(card(page)).toContainText('A-02 · In view');
    await expect(card(page)).toContainText('PAPER-LANTERN');
    await expect(status(page)).toHaveText('');
    await page.mouse.move(0, 0);
    await expect(card(page)).toBeHidden();
  });
});

test.describe('opening from the view', () => {
  test('a click on an Asset opens its repository and marks it Opened', async ({ page, context, isMobile }) => {
    test.skip(isMobile, 'touch has its own two-tap route');
    await page.goto('/');
    const at = await markerOf(page, 'A-01');
    await page.mouse.move(at.x, at.y);
    await expect(card(page)).toContainText('A-01 · In view');
    const openedTab = context.waitForEvent('page');
    await page.mouse.click(at.x, at.y);
    await (await openedTab).waitForURL('https://github.com/SairaDev02/tidepool');
    expect(new URL(page.url()).pathname).toBe('/');
    await expect(row(page, 0)).toHaveAttribute('data-opened', 'true');
    await expect(tagEl(page, 'A-01')).toContainText('↗');
    await expect(card(page)).toContainText('A-01 · Opened');
    await expect(status(page)).toHaveText('Opened tidepool in a new tab');
  });
});

test.describe('touch', () => {
  test.use({ viewport: { width: 375, height: 812 } });
  test.beforeEach(async ({ page, isMobile }) => {
    test.skip(!isMobile, 'touch only');
    await stubOpen(page);
    await page.goto('/');
  });

  test('the first tap previews, the second opens, a tap on bare ground clears', async ({ page }) => {
    let at = await markerOf(page, 'A-01');
    await page.touchscreen.tap(at.x, at.y);
    await expect(card(page)).toContainText('A-01 · In view');
    expect(await openCalls(page)).toEqual([]);
    await expect(status(page)).toHaveText('');

    at = await markerOf(page, 'A-01');
    await page.touchscreen.tap(at.x, at.y);
    await expect.poll(() => openCalls(page)).toEqual(['https://github.com/SairaDev02/tidepool']);
    await expect(row(page, 0)).toHaveAttribute('data-opened', 'true');
    await expect(card(page)).toContainText('A-01 · Opened');

    // Bare ground: the frame's top-right corner area holds no marker.
    const frame = (await page.locator('[data-sensor-frame]').boundingBox())!;
    await page.touchscreen.tap(frame.x + frame.width - 6, frame.y + 6);
    await expect(card(page)).toBeHidden();
  });

  test('at 375 px the card docks at the bottom of the view and covers no tag', async ({ page }) => {
    expect(page.viewportSize()!.width).toBe(375);
    for (const tag of ['A-01', 'A-02', 'A-03', 'A-04']) {
      const at = await markerOf(page, tag);
      await page.touchscreen.tap(at.x, at.y);
      await expect(card(page)).toContainText(`${tag} · `);
      const frame = (await page.locator('[data-sensor-frame]').boundingBox())!;
      const c = (await card(page).boundingBox())!;
      expect(c.y + c.height).toBeGreaterThan(frame.y + frame.height - 16);
      expect(c.y).toBeGreaterThan(frame.y + frame.height / 2);
      for (const other of ['A-01', 'A-02', 'A-03', 'A-04']) {
        const t = (await tagEl(page, other).boundingBox())!;
        const apart = t.y + t.height <= c.y || t.y >= c.y + c.height || t.x + t.width <= c.x || t.x >= c.x + c.width;
        expect(apart, `${other} is covered by the card while previewing ${tag}`).toBe(true);
      }
    }
  });
});

test.describe('theme', () => {
  test('the view recolours when the theme switches', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    await expect(tagEl(page, 'A-01')).toBeVisible();
    const before = await canvas(page).screenshot();
    await page.getByRole('group', { name: 'Colour theme' }).getByRole('radio', { name: 'Dark' }).check({ force: true });
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
    await expect
      .poll(async () => (await canvas(page).screenshot()).equals(before), { message: 'canvas still shows the light picture' })
      .toBe(false);
  });
});

test.describe('loading', () => {
  test('no scene script is requested before the load event', async ({ page }) => {
    await page.goto('/');
    await expect(tagEl(page, 'A-01')).toBeVisible();
    const { before, after } = await lazyChunkRequests(page);
    expect(before).toEqual([]);
    expect(after.filter((u) => /\/scene\./.test(u)).length).toBeGreaterThan(0);
  });

  test('nothing shifts when the scene arrives late', async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { cls: number };
      w.cls = 0;
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) w.cls += e.value;
      }).observe({ type: 'layout-shift', buffered: true });
    });
    await page.route(/\/_astro\/scene[^/]*\.js/, async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.continue();
    });
    await page.goto('/');
    const frame = (await page.locator('[data-sensor-frame]').boundingBox())!;
    expect(frame.height).toBeGreaterThan(100); // the box is reserved before the scene loads
    await expect(tagEl(page, 'A-01')).toBeVisible({ timeout: 15_000 });
    expect((await page.locator('[data-sensor-frame]').boundingBox())!.height).toBeCloseTo(frame.height, 0);
    expect(await page.evaluate(() => (window as unknown as { cls: number }).cls)).toBeLessThan(0.1);
  });
});
