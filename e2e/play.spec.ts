// A play: the repository opens in a new tab at the gesture and the disc runs on the wall
// clock, then returns to its slot. Built from e2e/fixtures/github.json, whose display
// order is 01 tidepool, 02 paper-lantern, 03 quiet-notes, 04 empty-box.
import type { Page } from '@playwright/test';
import { layoutDiscs } from '../src/scripts/player/geometry';
import { picture, waitForScene } from './picture';
import { expect, test } from './test';

const REPO = 'https://github.com/SairaDev02/';
const playButton = (page: Page) => page.getByRole('button', { name: 'Play: open the cued repository' });
const status = (page: Page) => page.getByRole('status');

test.describe('opening a repository', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('a click on a disc opens it in a new tab and plays it', async ({ page, context }) => {
    await waitForScene(page);
    const { g, at } = await picture(page);
    const popup = context.waitForEvent('page');
    await page.mouse.click(...at(...layoutDiscs(4, g.discArea).slots[0]));
    await (await popup).waitForURL(`${REPO}tidepool`);

    expect(new URL(page.url()).pathname).toBe('/');
    await expect(page.locator('[data-dock]')).toHaveClass(/is-playing/);
    await expect(page.locator('[data-lcd-title]')).toHaveText('Loading tidepool');
  });

  test("the Dock's Play opens the cued repository in a new tab", async ({ page, context }) => {
    await page.getByRole('button', { name: 'Next: paper-lantern' }).click();
    const popup = context.waitForEvent('page');
    await playButton(page).click();
    await (await popup).waitForURL(`${REPO}paper-lantern`);

    expect(new URL(page.url()).pathname).toBe('/');
    await expect(page.locator('[data-dock]')).toHaveClass(/is-playing/);
    await expect(page.locator('[data-lcd-title]')).toHaveText('Loading paper-lantern');
  });

  test('a middle click keeps the link in a new tab and still plays the disc', async ({ page, context, isMobile }) => {
    test.skip(isMobile, 'no middle button on phones');
    const popup = context.waitForEvent('page');
    await page.locator('[data-track="2"]').click({ button: 'middle' });
    await (await popup).waitForURL(`${REPO}quiet-notes`);
    await expect(page.locator('[data-dock]')).toHaveClass(/is-playing/);
    expect(new URL(page.url()).pathname).toBe('/');
  });

  test('a drop in the tray plays the disc and opens the tab', async ({ page, context, isMobile }) => {
    test.skip(isMobile, 'drag with a pointer');
    await waitForScene(page);
    const { g, at } = await picture(page);
    const popup = context.waitForEvent('page');
    await page.mouse.move(...at(...layoutDiscs(4, g.discArea).slots[0]));
    await page.mouse.down();
    await page.mouse.move(...at(g.tray.x, g.tray.y), { steps: 10 });
    await page.mouse.up();
    await (await popup).waitForURL(`${REPO}tidepool`);
    await expect(page.locator('[data-dock]')).toHaveClass(/is-playing/);
  });
});

test.describe('a play on the clock', () => {
  test.beforeEach(async ({ page }) => {
    // The tab itself is covered above; here the clock is the subject, so the tab is faked.
    await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
    await page.addInitScript(() => {
      window.open = (() => ({ opener: null })) as unknown as typeof window.open;
    });
    await page.goto('/');
  });

  test('lands after the load, plays for 30 s, then the disc comes home', async ({ page }) => {
    await playButton(page).click();
    await expect(page.locator('[data-lcd-title]')).toHaveText('Loading tidepool');

    await page.clock.fastForward(1_400);
    await expect(page.locator('[data-dock]')).toHaveClass(/is-playing/);

    await page.clock.fastForward(30_100);
    // A return ends the play and moves the cue on along the Queue.
    await expect(page.locator('[data-dock]')).not.toHaveClass(/is-playing/);
    await expect(page.locator('[data-np-kicker]')).toHaveText('Up next');
    await expect(page.locator('[data-np-title]')).toHaveText('02 paper-lantern');
    await expect(page.locator('[data-lcd-title]')).toHaveText('Drag a disc');
  });

  test('a return follows the Queue order the panel set', async ({ page }) => {
    // Move paper-lantern down: the next track after tidepool is now quiet-notes.
    await page.getByRole('button', { name: 'Queue', exact: true }).click();
    await page.getByRole('button', { name: 'Move paper-lantern down' }).click();
    await expect(page.getByRole('button', { name: 'Next: quiet-notes' })).toBeVisible();

    await playButton(page).click();
    await page.clock.fastForward(1_400 + 30_100);
    // The disc came home and the Cue moved along the Queue, not along the track numbers.
    await expect(page.locator('[data-dock]')).not.toHaveClass(/is-playing/);
    await expect(page.locator('[data-np-title]')).toHaveText('03 quiet-notes');
    await expect(page.getByRole('button', { name: 'Next: paper-lantern' })).toBeVisible();
  });

  test('a return follows the Queue order Shuffle set', async ({ page, isMobile }) => {
    test.skip(isMobile, 'the dock hides shuffle on phones');
    // A fixed draw, so the shuffled order is the same on every run.
    await page.addInitScript(() => {
      Math.random = () => 0.1;
    });
    await page.goto('/');
    await page.getByRole('button', { name: 'Shuffle the queue' }).click();
    // Next names the Queue's first track after the Cue; a return must land on it.
    const label = await page.getByRole('button', { name: /^Next: / }).getAttribute('aria-label');
    const name = label!.replace('Next: ', '');
    expect(name).not.toBe('paper-lantern'); // the shuffled order, not the track numbers

    await playButton(page).click();
    await page.clock.fastForward(1_400 + 30_100);
    await expect(page.locator('[data-dock]')).not.toHaveClass(/is-playing/);
    await expect(page.locator('[data-np-title]')).toContainText(name);
  });

  test('a return from a hidden tab finds the disc home', async ({ page }) => {
    await playButton(page).click();
    // A hidden tab misses its timer: only the clock moves, then the tab reports visible.
    await page.clock.setSystemTime(new Date('2026-01-01T00:05:00Z'));
    await page.evaluate(() => window.dispatchEvent(new Event('visibilitychange')));

    await expect(page.locator('[data-dock]')).not.toHaveClass(/is-playing/);
    await expect(page.locator('[data-lcd-title]')).toHaveText('Drag a disc');
  });

  test('announces a play, a reopen and the return', async ({ page }) => {
    await playButton(page).click();
    await expect(status(page)).toHaveText('Playing tidepool, opened in a new tab');

    // The same repository again, from any route: its tab reopens, the 30 s do not restart.
    await page.clock.fastForward(1_500);
    await playButton(page).click();
    await expect(status(page)).toHaveText('Reopened tidepool in a new tab');

    await page.clock.fastForward(30_100);
    await expect(status(page)).toHaveText('tidepool returned');
  });

  test('keeps the play when the same repository reopens', async ({ page }) => {
    await playButton(page).click();
    await page.clock.fastForward(1_500 + 15_000);
    await playButton(page).click();
    // The reopen did not restart the 30 s: 15 s later the play is over.
    await page.clock.fastForward(15_100);
    await expect(page.locator('[data-dock]')).not.toHaveClass(/is-playing/);
  });
});

test.describe('a blocked tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.open = (() => null) as typeof window.open;
    });
    await page.goto('/');
  });

  test('plays nothing and says how to open the repository', async ({ page }) => {
    await playButton(page).click();
    await expect(status(page)).toHaveText('New tab blocked. Click tidepool to open it');
    await expect(page.locator('[data-dock]')).not.toHaveClass(/is-playing/);
    await expect(page.locator('[data-lcd-title]')).toHaveText('Drag a disc');
  });
});
