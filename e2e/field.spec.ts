// The background field: a fixed, decorative three.js canvas behind the page, loaded after
// the load event like the sensor view, and recoloured with the theme.
import { expect, lazyChunkRequests, test } from './test';

const field = (page: import('@playwright/test').Page) => page.locator('canvas[data-field]');

test('the field is decorative and never takes the pointer', async ({ page }) => {
  await page.goto('/');
  await expect(field(page)).toHaveCount(1);
  await expect(field(page)).toHaveAttribute('aria-hidden', 'true');
  expect(await field(page).evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none');
  expect(await field(page).evaluate((el) => getComputedStyle(el).position)).toBe('fixed');
});

test('the field recolours when the theme switches', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await expect(field(page)).toHaveCount(1);
  const before = await field(page).screenshot();
  await page.getByRole('group', { name: 'Colour theme' }).getByRole('radio', { name: 'Dark' }).check({ force: true });
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
  await expect
    .poll(async () => (await field(page).screenshot()).equals(before), { message: 'field still shows the light picture' })
    .toBe(false);
});

test.describe('loading', () => {
  test('no field script is requested before the load event', async ({ page }) => {
    await page.goto('/');
    await expect(field(page)).toHaveCount(1);
    const { before, after } = await lazyChunkRequests(page);
    expect(before).toEqual([]);
    expect(after.filter((u) => /\/field\./.test(u)).length).toBeGreaterThan(0);
  });

  test('nothing shifts when the field arrives late', async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { cls: number };
      w.cls = 0;
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) w.cls += e.value;
      }).observe({ type: 'layout-shift', buffered: true });
    });
    await page.route(/\/_astro\/field[^/]*\.js/, async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.continue();
    });
    await page.goto('/');
    const h1 = page.getByRole('heading', { level: 1 });
    const before = (await h1.boundingBox())!;
    await expect(field(page)).toHaveCount(1, { timeout: 15_000 });
    expect((await h1.boundingBox())!.y).toBeCloseTo(before.y, 0);
    expect(await page.evaluate(() => (window as unknown as { cls: number }).cls)).toBeLessThan(0.1);
  });
});
