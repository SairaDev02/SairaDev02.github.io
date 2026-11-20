// The home page as built from e2e/fixtures/github.json, with the build clock fixed at
// 2026-11-05 (playwright.config.ts). Display order is most recently pushed first:
// A-01 tidepool (Active), A-02 paper-lantern, A-03 quiet-notes, A-04 empty-box (Dormant).
import type { Locator, Page } from '@playwright/test';
import { expect, test } from './test';

/** The board's rows, one link per Asset. */
const rows = (page: Page) => page.locator('[data-asset]');
const row = (page: Page, i: number) => page.locator(`[data-asset="${i}"]`);
const status = (page: Page) => page.getByRole('status');

/** The `window.open` stub: records calls, and answers a window or, when `blocked`, null. */
const stubOpen = (page: Page, blocked: boolean) =>
  page.addInitScript((blockedOpen) => {
    const calls: string[] = [];
    (window as unknown as { openCalls: string[] }).openCalls = calls;
    Object.defineProperty(window, 'open', {
      configurable: true,
      writable: true,
      value: (url: string) => {
        calls.push(url);
        return blockedOpen ? null : { opener: 'untouched' };
      },
    });
  }, blocked);
const openCalls = (page: Page) => page.evaluate(() => (window as unknown as { openCalls: string[] }).openCalls);

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('page content', () => {
  test('lists public, non-fork, non-hidden repositories, newest push first', async ({ page }) => {
    await expect(page).toHaveTitle('SairaDev02 · public repositories');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('SairaDev02');

    await expect(rows(page).locator('.name')).toHaveText(['tidepool', 'paper-lantern', 'quiet-notes', 'empty-box']);
    await expect(rows(page).locator('.tag-no')).toHaveText(['A-01', 'A-02', 'A-03', 'A-04']);
    await expect(rows(page).first()).toHaveAttribute('href', 'https://github.com/SairaDev02/tidepool');
    await expect(page.getByText('forked-lib')).toHaveCount(0);
    await expect(rows(page).filter({ hasText: 'SairaDev02.github.io' })).toHaveCount(0);
  });

  test('the operator block shows the photo, the label, the chip and one stats line', async ({ page }) => {
    const block = page.locator('.operator');
    await expect(block.getByRole('img', { name: 'SairaDev02’s GitHub avatar' })).toBeVisible();
    await expect(block.getByText('ID · OP-01')).toBeVisible();
    await expect(block.getByText('Systems online')).toBeVisible();
    await expect(block.locator('.stats')).toHaveText('4 assets · 1 active · 9 commits · Rust / TypeScript · last push 2026.10.20');
  });

  test('marks Active with a filled dot and Dormant with an open one, also in text', async ({ page }) => {
    await expect(row(page, 0)).toHaveAttribute('data-status', 'active');
    await expect(row(page, 0).locator('.mark')).toHaveText('●');
    await expect(row(page, 0)).toContainText('Active');
    await expect(row(page, 1)).toHaveAttribute('data-status', 'dormant');
    await expect(row(page, 1).locator('.mark')).toHaveText('○');
    await expect(row(page, 1)).toContainText('Dormant');
  });

  test('shows language, commits and last push on each row, filling gaps in the data', async ({ page }) => {
    await expect(row(page, 0).locator('.lang')).toHaveText('Rust');
    await expect(row(page, 0).locator('.commits')).toContainText('5');
    await expect(row(page, 0).locator('.date')).toHaveText('2026.10.20');
    // No language and one commit: the row says Text and the singular.
    await expect(row(page, 2).locator('.lang')).toHaveText('Text');
    await expect(row(page, 2).locator('.commits')).toHaveText(/^\s*1\s*commit\s*$/);
    await expect(row(page, 3).locator('.commits')).toContainText('0');
  });

  test('nothing is fixed to the bottom of the screen (the decorative field aside)', async ({ page }) => {
    const fixed = await page.evaluate(() =>
      [...document.querySelectorAll('body *')].filter((el) => {
        const s = getComputedStyle(el);
        return s.position === 'fixed' && !el.classList.contains('skip') && !el.hasAttribute('data-field');
      }).length,
    );
    expect(fixed).toBe(0);
  });

  test('fits the viewport width without horizontal scrolling', async ({ page }) => {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
});

test.describe('opening', () => {
  test('a row click opens the repository in a new tab, marks the row Opened and announces it', async ({ page, context }) => {
    const openedTab = context.waitForEvent('page');
    await row(page, 1).click();
    await (await openedTab).waitForURL('https://github.com/SairaDev02/paper-lantern');

    // The site stays where it is.
    expect(new URL(page.url()).pathname).toBe('/');
    await expect(row(page, 1)).toHaveAttribute('data-opened', 'true');
    await expect(row(page, 1).getByText('Opened ↗')).toBeVisible();
    await expect(row(page, 0).getByText('Opened ↗')).toBeHidden();
    await expect(status(page)).toHaveText('Opened paper-lantern in a new tab');
  });

  test('Enter on a focused row opens it the same way', async ({ page, context }) => {
    await row(page, 0).focus();
    const openedTab = context.waitForEvent('page');
    await page.keyboard.press('Enter');
    await (await openedTab).waitForURL('https://github.com/SairaDev02/tidepool');
    expect(new URL(page.url()).pathname).toBe('/');
    await expect(row(page, 0)).toHaveAttribute('data-opened', 'true');
    await expect(status(page)).toHaveText('Opened tidepool in a new tab');
  });

  test('detaches the new window from the page', async ({ page }) => {
    await stubOpen(page, false);
    await page.goto('/');
    await row(page, 0).click();
    expect(await openCalls(page)).toEqual(['https://github.com/SairaDev02/tidepool']);
    await expect(row(page, 0)).toHaveAttribute('data-opened', 'true');
  });

  test('a modified click is not intercepted', async ({ page, isMobile }) => {
    test.skip(isMobile, 'no modifier keys on phones');
    await stubOpen(page, false);
    await page.goto('/');
    // The native route is the link's own: Ctrl/Cmd-click opens a background tab from the
    // browser, so the page's own open must not run, and nothing is marked or announced.
    await row(page, 0).click({ modifiers: ['ControlOrMeta'] });
    expect(await openCalls(page)).toEqual([]);
    await expect(row(page, 0)).not.toHaveAttribute('data-opened', 'true');
    await expect(status(page)).toHaveText('');
  });

  test('a middle click is not intercepted', async ({ page, isMobile }) => {
    test.skip(isMobile, 'no middle button on phones');
    await stubOpen(page, false);
    await page.goto('/');
    await row(page, 0).click({ button: 'middle' });
    expect(await openCalls(page)).toEqual([]);
    await expect(row(page, 0)).not.toHaveAttribute('data-opened', 'true');
  });

  test('a blocked tab marks nothing and says how to open it', async ({ page }) => {
    await stubOpen(page, true);
    await page.goto('/');
    await row(page, 2).click();
    expect(await openCalls(page)).toEqual(['https://github.com/SairaDev02/quiet-notes']);
    await expect(status(page)).toHaveText("New tab blocked. Click quiet-notes again, or use the link's menu");
    await expect(row(page, 2)).not.toHaveAttribute('data-opened', 'true');
    await expect(row(page, 2).getByText('Opened ↗')).toBeHidden();
    expect(new URL(page.url()).pathname).toBe('/');
  });
});

test.describe('preview', () => {
  /** The magenta-or-not state of a row, read from what a visitor sees. */
  const numberColour = (el: Locator) => el.locator('.tag-no').evaluate((n) => getComputedStyle(n).color);

  test('hovering a row only styles it, and announces nothing', async ({ page, isMobile }) => {
    test.skip(isMobile, 'no hover on touch screens');
    const before = await numberColour(row(page, 1));
    await row(page, 1).hover();
    // Magenta number (the text ink); the colour changes from the resting ink.
    await expect.poll(() => numberColour(row(page, 1))).not.toBe(before);
    await expect(status(page)).toHaveText('');
    await expect(row(page, 1)).not.toHaveAttribute('data-opened', 'true');
    await page.mouse.move(0, 0);
    await expect.poll(() => numberColour(row(page, 1))).toBe(before);
  });

  test('focusing a row draws a focus ring of at least 2 px and announces nothing', async ({ page }) => {
    await row(page, 1).focus();
    await expect(row(page, 1)).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(row(page, 1)).toBeFocused();
    const ring = await row(page, 1).evaluate((el) => {
      const s = getComputedStyle(el);
      return { style: s.outlineStyle, width: parseFloat(s.outlineWidth), colour: s.outlineColor };
    });
    expect(ring.style).toBe('solid');
    expect(ring.width).toBeGreaterThanOrEqual(2);
    // The focus ink: magenta.
    expect(ring.colour).toBe('rgb(230, 0, 126)');
    await expect(status(page)).toHaveText('');
  });

  test('the ring stays drawn in forced colours', async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await row(page, 1).focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    const ring = await row(page, 1).evaluate((el) => {
      const s = getComputedStyle(el);
      return { style: s.outlineStyle, width: parseFloat(s.outlineWidth) };
    });
    expect(ring.style).toBe('solid');
    expect(ring.width).toBeGreaterThanOrEqual(2);
  });
});

test.describe('layout', () => {
  test('no informative text is under 12 px on the home page', async ({ page }) => {
    const small = await page.evaluate(() => {
      const found: string[] = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const el = n.parentElement!;
        if (!n.textContent!.trim() || el.closest('.visually-hidden, [aria-hidden="true"]')) continue;
        const size = parseFloat(getComputedStyle(el).fontSize);
        if (el.checkVisibility() && size < 12) found.push(`${el.className}: ${size}px`);
      }
      return found;
    });
    expect(small).toEqual([]);
  });
});
