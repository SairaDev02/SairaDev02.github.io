// The home page as built from e2e/fixtures/github.json. Display order is most recently
// pushed first: 01 tidepool, 02 paper-lantern, 03 quiet-notes, 04 empty-box.
import type { Page } from '@playwright/test';
import { expect, test } from './test';

const dock = (page: Page) => page.getByRole('region', { name: 'Now playing' });
const dockTitle = (page: Page) => dock(page).locator('[data-np-title]');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('page content', () => {
  test('lists public, non-fork, non-hidden repositories, newest push first', async ({ page }) => {
    await expect(page).toHaveTitle('SairaDev02 · public work');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/SairaDev02\s*public work/);
    await expect(page.getByText('Public playlist · 4 repositories')).toBeVisible();
    await expect(page.getByText('9 commits · Rust / TypeScript · updated 2026.10.20')).toBeVisible();

    const rows = page.locator('[data-track]');
    await expect(rows.locator('.title b')).toHaveText(['tidepool', 'paper-lantern', 'quiet-notes', 'empty-box']);
    await expect(rows.first()).toHaveAttribute('href', 'https://github.com/SairaDev02/tidepool');
    await expect(page.getByText('forked-lib')).toHaveCount(0);
    await expect(rows.filter({ hasText: 'SairaDev02.github.io' })).toHaveCount(0);
  });

  test('fills gaps in repository data', async ({ page }) => {
    const quiet = page.locator('[data-track="2"]');
    await expect(quiet).toContainText('No description.');
    await expect(quiet.locator('.commits')).toHaveText(/^\s*1\s*commits\s*$/);
  });

  test('draws the CD player picture', async ({ page }) => {
    const canvas = page.getByRole('img', { name: /A CD player in a cloudy sky beside 4 discs/ });
    await expect(canvas).toBeVisible();
    // More than one colour on the canvas means the scene rendered.
    await expect
      .poll(() =>
        canvas.evaluate((c: HTMLCanvasElement) => {
          const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
          const seen = new Set<number>();
          for (let k = 0; k < d.length && seen.size < 3; k += 4 * 97) seen.add((d[k] << 16) | (d[k + 1] << 8) | d[k + 2]);
          return seen.size;
        }),
      )
      .toBeGreaterThan(1);
  });

  test('fits the viewport width without horizontal scrolling', async ({ page }) => {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
});

test.describe('now-playing dock', () => {
  test('starts on the first track, up next', async ({ page }) => {
    await expect(dock(page).locator('[data-np-kicker]')).toHaveText('Up next');
    await expect(dockTitle(page)).toHaveText('01 tidepool');
    await expect(dock(page).locator('[data-np-sub]')).toHaveText('Rust · cli · audio · synth');
  });

  test('hovering a track cues it in the dock and on the LCD, and the cue sticks', async ({ page, isMobile }) => {
    test.skip(isMobile, 'no hover on touch screens');
    const row = page.locator('[data-track="1"]');
    await row.hover();
    await expect(row).toHaveClass(/\bon\b/);
    await expect(dockTitle(page)).toHaveText('02 paper-lantern');
    await expect(page.locator('[data-lcd-title]')).toHaveText('paper-lantern');
    await expect(page.locator('[data-lcd-num]')).toHaveText('02');

    await page.mouse.move(0, 0);
    await expect(row).not.toHaveClass(/\bon\b/);
    await expect(dockTitle(page)).toHaveText('02 paper-lantern');
  });

  test('previous and next step through the queue and wrap round', async ({ page }) => {
    await page.getByRole('button', { name: 'Previous in queue' }).click();
    await expect(dockTitle(page)).toHaveText('04 empty-box');
    await page.getByRole('button', { name: 'Next in queue' }).click();
    await page.getByRole('button', { name: 'Next in queue' }).click();
    await expect(dockTitle(page)).toHaveText('02 paper-lantern');
  });

  test('shuffle toggles', async ({ page, isMobile }) => {
    test.skip(isMobile, 'the dock hides shuffle on phones');
    const shuffle = page.getByRole('button', { name: 'Shuffle the queue' });
    await expect(shuffle).toHaveAttribute('aria-pressed', 'false');
    await shuffle.click();
    await expect(shuffle).toHaveAttribute('aria-pressed', 'true');
    await shuffle.click();
    await expect(shuffle).toHaveAttribute('aria-pressed', 'false');
  });
});

test.describe('lyrics panel', () => {
  test('shows the cued README as lines, and an instrumental without one', async ({ page }) => {
    const toggle = page.getByRole('button', { name: 'Lyrics', exact: true });
    const panel = page.getByRole('region', { name: 'Lyrics: README of the cued repository' });
    await expect(panel).toBeHidden();

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(panel).toBeVisible();
    await expect(panel.locator('[data-lyrics-title]')).toHaveText('Lyrics · 01 tidepool');
    await expect(panel.getByText('Turns tide tables into slow, swelling drones.')).toBeVisible();
    await expect(panel.getByText('[ Usage ]')).toBeVisible();
    await expect(panel).not.toContainText('shields');
    await expect(panel.getByRole('link', { name: 'Full README ↗' })).toHaveAttribute(
      'href',
      'https://github.com/SairaDev02/tidepool#readme',
    );

    await page.getByRole('button', { name: 'Next in queue' }).click();
    await expect(panel.locator('[data-lyrics-title]')).toHaveText('Lyrics · 02 paper-lantern');
    await expect(panel.getByText('No README yet. This one is an instrumental.')).toBeVisible();
  });

  test('closes with Escape', async ({ page }) => {
    const toggle = page.getByRole('button', { name: 'Lyrics', exact: true });
    await toggle.click();
    await expect(page.locator('[data-panel="lyrics"]')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('[data-panel="lyrics"]')).toBeHidden();
  });
});

test.describe('queue panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.getByRole('button', { name: 'Queue', exact: true }).click();
  });
  const panel = (page: Page) => page.getByRole('region', { name: 'Queue', exact: true });
  const nextUp = (page: Page) => panel(page).locator('[data-q-next] [data-q-name]');

  test('reorders next up with the buttons, and next follows the new order', async ({ page }) => {
    await expect(panel(page).locator('[data-q-now] [data-q-name]')).toHaveText('tidepool');
    await expect(nextUp(page)).toHaveText(['paper-lantern', 'quiet-notes', 'empty-box']);
    // The first row cannot move up: its disabled button is hidden.
    await expect(panel(page).getByRole('button', { name: 'Move paper-lantern up' })).toHaveCount(0);

    await panel(page).getByRole('button', { name: 'Move paper-lantern down' }).click();
    await expect(nextUp(page)).toHaveText(['quiet-notes', 'paper-lantern', 'empty-box']);
    // Focus stays on the moved row's button, so keyboard users can keep moving it.
    await expect(panel(page).getByRole('button', { name: 'Move paper-lantern down' })).toBeFocused();

    await page.getByRole('button', { name: 'Next in queue' }).click();
    await expect(dockTitle(page)).toHaveText('03 quiet-notes');
  });

  test('reorders next up by dragging the handle', async ({ page }) => {
    const row = (await panel(page).locator('[data-q-next] > li').first().boundingBox())!;
    const handle = (await panel(page).locator('[data-q-next] [data-q-handle]').first().boundingBox())!;
    const x = handle.x + handle.width / 2;
    const y = handle.y + handle.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + row.height * 2, { steps: 8 });
    await page.mouse.up();
    await expect(nextUp(page)).toHaveText(['quiet-notes', 'empty-box', 'paper-lantern']);
  });

  test('picking a track cues it', async ({ page }) => {
    await panel(page).getByRole('button', { name: 'Cue empty-box' }).click();
    await expect(dockTitle(page)).toHaveText('04 empty-box');
    await expect(panel(page).locator('[data-q-now] [data-q-name]')).toHaveText('empty-box');
  });
});

test.describe('playing a track', () => {
  test('a track list click runs the load sequence, then opens the repository', async ({ page }) => {
    await page.locator('[data-track="1"]').click();
    await expect(dock(page).locator('[data-np-kicker]')).toHaveText('Now playing');
    await expect(page.locator('[data-dock]')).toHaveClass(/is-playing/);
    await expect(page.locator('[data-lcd-title]')).toHaveText('Loading paper-lantern');
    await page.waitForURL('https://github.com/SairaDev02/paper-lantern');
  });

  test('the playlist play button opens the cued repository', async ({ page }) => {
    await page.getByRole('button', { name: 'Next in queue' }).click();
    await page.getByRole('button', { name: 'Play the cued repository: opens it' }).click();
    await page.waitForURL('https://github.com/SairaDev02/paper-lantern');
  });

  test('with reduced motion, opens the repository without the load sequence', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.locator('[data-track="2"]').click();
    await page.waitForURL('https://github.com/SairaDev02/quiet-notes', { timeout: 1500 });
  });

  test('a modified click opens the repository in a new tab and leaves the page alone', async ({ page, context, isMobile }) => {
    test.skip(isMobile, 'no modifier keys on phones');
    const popup = context.waitForEvent('page');
    await page.locator('[data-track="0"]').click({ modifiers: ['ControlOrMeta'] });
    await (await popup).waitForURL('https://github.com/SairaDev02/tidepool');
    await expect(dock(page).locator('[data-np-kicker]')).toHaveText('Up next');
    expect(new URL(page.url()).hostname).toBe('127.0.0.1');
  });
});
