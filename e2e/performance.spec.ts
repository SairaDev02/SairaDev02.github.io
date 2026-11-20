// Performance guard for both late arrivals at once: the sensor scene and the background
// field, each chunk delayed, with nothing shifting and neither requested before the load
// event. (Each has its own single-arrival test in sensor.spec.ts and field.spec.ts.)
import { expect, test } from './test';

test('nothing shifts while the scene and the field both arrive late, and neither is requested before the load event', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { cls: number };
    w.cls = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) w.cls += e.value;
    }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.route(/\/_astro\/(scene|field)[^/]*\.js/, async (route) => {
    await new Promise((r) => setTimeout(r, 1500));
    await route.continue();
  });

  await page.goto('/');
  const frame = page.locator('[data-sensor-frame]');
  const reserved = (await frame.boundingBox())!;
  expect(reserved.height).toBeGreaterThan(100);
  await expect(page.locator('[data-sensor-tag="A-01"]')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('canvas[data-field]')).toHaveCount(1, { timeout: 15_000 });
  expect((await frame.boundingBox())!.height).toBeCloseTo(reserved.height, 0);
  expect(await page.evaluate(() => (window as unknown as { cls: number }).cls)).toBeLessThan(0.1);
  // The page's own timeline, not the order Playwright reports events in: a request made
  // from the load handler starts after the navigation's loadEventStart, never before.
  const early = await page.evaluate(() => {
    const [nav] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    return performance
      .getEntriesByType('resource')
      .filter((e) => /\/_astro\/.*(scene|field|three).*\.js/i.test(e.name) && e.startTime < nav.loadEventStart)
      .map((e) => e.name);
  });
  expect(early).toEqual([]);
});
