// The asset board's motion and the page's decoding, from e2e/fixtures/github.json
// (A-01 tidepool: 5 commits ... A-04 empty-box: 0). All movement exists only under
// prefers-reduced-motion: no-preference; under reduce only colours change.
import type { Page } from '@playwright/test';
import { expect, test } from './test';

const row = (page: Page, i: number) => page.locator(`[data-asset="${i}"]`);
/** Animations running on the board or its descendants, pseudo-elements included. */
const boardAnimations = (page: Page, scrollDriven = false) =>
  page.evaluate((withScroll) =>
    document
      .querySelector('.board')!
      .getAnimations({ subtree: true })
      // Scroll-driven reveals (rows below the fold) wait for scrolling: they are not running.
      .filter((a) => withScroll || a.timeline instanceof DocumentTimeline)
      .map((a) => (a as CSSAnimation).animationName ?? 'transition'),
    scrollDriven,
  );

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('the board has no running animations, even after a preview and an Open', async ({ page, isMobile }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'open', { configurable: true, writable: true, value: () => ({ opener: null }) });
    });
    await page.goto('/');
    expect(await boardAnimations(page)).toEqual([]);
    await row(page, 1).focus();
    if (!isMobile) await row(page, 2).hover();
    await row(page, 1).click();
    await expect(row(page, 1)).toHaveAttribute('data-opened', 'true');
    expect(await boardAnimations(page)).toEqual([]);
  });

  test('a previewed title does not move', async ({ page }) => {
    await page.goto('/');
    await row(page, 1).focus();
    const translate = await row(page, 1).locator('.name').evaluate((n) => getComputedStyle(n).translate);
    expect(translate).toBe('none');
  });

  test('commit counts show their final values at once', async ({ page }) => {
    await page.goto('/');
    // Read in the same task as the load, with no waiting for a count to finish.
    const counts = await page.evaluate(() => [...document.querySelectorAll('.commits')].map((c) => c.textContent?.trim()));
    expect(counts).toEqual(['5 commits', '3 commits', '1 commit', '0 commits']);
  });

  test('the label line, stats line and column heads are never rewritten', async ({ page }) => {
    await page.addInitScript(() => {
      const hits: string[] = [];
      (window as unknown as { hits: string[] }).hits = hits;
      document.addEventListener('DOMContentLoaded', () => {
        // The operator block and the board; the sensor view's HUD updates by design.
        const observer = new MutationObserver((ms) => ms.forEach((m) => hits.push(String((m.target as Element).className || m.target.nodeName))));
        for (const el of document.querySelectorAll('.operator, .board')) observer.observe(el, { subtree: true, childList: true, characterData: true });
      });
    });
    await page.goto('/');
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => (window as unknown as { hits: string[] }).hits)).toEqual([]);
  });
});

test.describe('motion allowed', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('repository names and the name heading are never altered by script', async ({ page }) => {
    await page.addInitScript(() => {
      const hits: string[] = [];
      (window as unknown as { hits: string[] }).hits = hits;
      document.addEventListener('DOMContentLoaded', () => {
        new MutationObserver((ms) => {
          for (const m of ms) {
            const el = m.target instanceof Element ? m.target : m.target.parentElement;
            if (el?.closest('.name, h1')) hits.push(el.className || el.nodeName);
          }
        }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });
      });
    });
    await page.goto('/');
    // Past the end of the load sequence: the decode and the counts are done.
    await expect(page.locator('.commits').first()).toHaveText('5 commits', { timeout: 5000 });
    await page.waitForTimeout(1200);
    expect(await page.evaluate(() => (window as unknown as { hits: string[] }).hits)).toEqual([]);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('SairaDev02');
    await expect(page.locator('.name')).toHaveText(['tidepool', 'paper-lantern', 'quiet-notes', 'empty-box']);
  });

  test('rows reveal on load, and commit counts settle on their final values', async ({ page }) => {
    await page.goto('/');
    // With the sensor view above, rows may all be below the fold: a scroll-driven reveal counts.
    expect(await boardAnimations(page, true)).toContain('row-in');
    await expect(page.locator('.commits')).toHaveText(['5 commits', '3 commits', '1 commit', '0 commits'], { timeout: 5000 });
    await expect.poll(() => boardAnimations(page)).toEqual([]);
  });

  test('the decoded lines end as the real text', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.operator .stats')).toHaveText(
      '4 assets · 1 active · 9 commits · Rust / TypeScript · last push 2026.10.20',
      { timeout: 5000 },
    );
    await expect(page.locator('.operator .text .label')).toHaveText('Public repositories');
  });

  test('a previewed title steps right', async ({ page, isMobile }) => {
    test.skip(isMobile, 'no hover on touch screens');
    await page.goto('/');
    await row(page, 1).hover();
    await expect
      .poll(() => row(page, 1).locator('.name').evaluate((n) => getComputedStyle(n).translate))
      .toBe('6px');
  });

  test('an Open flashes the row', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'open', { configurable: true, writable: true, value: () => ({ opener: null }) });
    });
    await page.goto('/');
    await expect.poll(() => boardAnimations(page)).toEqual([]);
    await row(page, 1).click();
    await expect(row(page, 1)).toHaveAttribute('data-opened', 'true');
    const names = await row(page, 1).evaluate((r) => r.getAnimations().map((a) => (a as CSSAnimation).animationName));
    expect(names).toContain('flash');
  });
});
