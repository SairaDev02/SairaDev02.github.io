// The home page as built from e2e/fixtures/github.json. Display order is most recently
// pushed first: 01 tidepool, 02 paper-lantern, 03 quiet-notes, 04 empty-box.
import type { Locator, Page } from '@playwright/test';
import { layoutDiscs } from '../src/scripts/player/geometry';
import { picture, waitForScene } from './picture';
import { expect, test } from './test';

const dock = (page: Page) => page.getByRole('region', { name: 'Now playing' });
const dockTitle = (page: Page) => dock(page).locator('[data-np-title]');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('page content', () => {
  test('lists public, non-fork, non-hidden repositories, newest push first', async ({ page }) => {
    await expect(page).toHaveTitle('SairaDev02 · public repositories');
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

  test('hovering a track previews it without moving the dock', async ({ page, isMobile }) => {
    test.skip(isMobile, 'no hover on touch screens');
    const row = page.locator('[data-track="1"]');
    await row.hover();
    // The row shows the preview wash, not the playing fill.
    await expect(row).toHaveClass(/\bhov\b/);
    await expect(row).not.toHaveClass(/\bon\b/);
    // The faceplate follows the pointer; the Dock's track does not, and neither does the Cue.
    await expect(page.locator('[data-lcd-title]')).toHaveText('paper-lantern');
    await expect(page.locator('[data-lcd-num]')).toHaveText('02');
    await expect(dockTitle(page)).toHaveText('01 tidepool');
    await expect(page.locator('[data-track="0"]')).toHaveClass(/\bcued\b/);
    await expect(page.getByRole('status')).toHaveText('');

    await page.mouse.move(0, 0);
    await expect(row).not.toHaveClass(/\bhov\b/);
    await expect(page.locator('[data-lcd-title]')).toHaveText('Drag a disc');
    await expect(dockTitle(page)).toHaveText('01 tidepool');
  });

  test('hovering a disc previews it without moving the dock', async ({ page, isMobile }) => {
    test.skip(isMobile, 'no hover on touch screens');
    await waitForScene(page);
    const { g, at } = await picture(page);
    await page.mouse.move(...at(...layoutDiscs(4, g.discArea).slots[2]));
    await expect(page.locator('[data-lcd-title]')).toHaveText('quiet-notes');
    await expect(dockTitle(page)).toHaveText('01 tidepool');

    await page.mouse.move(0, 0);
    await expect(page.locator('[data-lcd-title]')).toHaveText('Drag a disc');
    await expect(dockTitle(page)).toHaveText('01 tidepool');
  });

  test('previous and next step through the queue and wrap round', async ({ page }) => {
    await page.getByRole('button', { name: 'Previous: empty-box' }).click();
    await expect(dockTitle(page)).toHaveText('04 empty-box');
    await page.getByRole('button', { name: 'Next: tidepool' }).click();
    await expect(dockTitle(page)).toHaveText('01 tidepool');
    await page.getByRole('button', { name: 'Next: paper-lantern' }).click();
    await expect(dockTitle(page)).toHaveText('02 paper-lantern');
  });

  test('a Dock step while idle announces the new cue', async ({ page }) => {
    await page.getByRole('button', { name: 'Next: paper-lantern' }).click();
    await expect(dockTitle(page)).toHaveText('02 paper-lantern');
    await expect(page.getByRole('status')).toHaveText('Cued paper-lantern');

    await page.getByRole('button', { name: 'Previous: tidepool' }).click();
    await expect(page.getByRole('status')).toHaveText('Cued tidepool');
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

test.describe('preview and cue marks', () => {
  const mark = (row: Locator) =>
    row.evaluate((el) => ({
      shadow: getComputedStyle(el).boxShadow,
      background: getComputedStyle(el).backgroundColor,
    }));

  test('the cued row carries a steady light blue glow box', async ({ page }) => {
    // DESIGN.md's token, and the one row that carries it while nothing plays.
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--cue').trim())).toBe(
      '#78a0f5',
    );
    const cued = page.locator('[data-track="0"]');
    await expect(cued).toHaveClass(/\bcued\b/);

    const { shadow, background } = await mark(cued);
    expect(shadow).toContain('rgb(120, 160, 245)');
    // A faint fill while idle, not the solid yellow: that one is for the playing row.
    expect(background).not.toBe('rgb(255, 214, 10)');

    // The marker follows the Cue, and only the cued row has a box.
    await page.getByRole('button', { name: 'Next: paper-lantern' }).click();
    await expect(page.locator('[data-track="1"]')).toHaveClass(/\bcued\b/);
    await expect(cued).not.toHaveClass(/\bcued\b/);
    expect((await mark(page.locator('[data-track="2"]'))).shadow).toBe('none');
  });

  test('a previewed row shows the soft yellow wash', async ({ page, isMobile }) => {
    test.skip(isMobile, 'no hover on touch screens');
    const row = page.locator('[data-track="1"]');
    await row.hover();
    const wash = await row.evaluate((el) => {
      const before = getComputedStyle(el, '::before');
      return { color: before.backgroundColor, filter: before.filter };
    });
    expect(wash.color).toBe('rgb(255, 214, 10)'); // var(--sun), blurred rather than solid
    expect(wash.filter).toContain('blur');
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

    await page.getByRole('button', { name: 'Next: paper-lantern' }).click();
    await expect(panel.locator('[data-lyrics-title]')).toHaveText('Lyrics · 02 paper-lantern');
    await expect(panel.getByText('No README yet. This one is an instrumental.')).toBeVisible();
  });

  test('keeps its place while a row is previewed', async ({ page, isMobile }) => {
    test.skip(isMobile, 'no hover on touch screens');
    await page.getByRole('button', { name: 'Lyrics', exact: true }).click();
    const panel = page.getByRole('region', { name: 'Lyrics: README of the cued repository' });
    const title = panel.locator('[data-lyrics-title]');
    await expect(title).toHaveText('Lyrics · 01 tidepool');

    // The highlight moves past the first line on its own, every 2.6 s.
    const first = panel.locator('[data-lines] li').first();
    await expect(first).toHaveClass(/\bpast\b/);
    await page.locator('[data-track="1"]').hover();
    // A preview leaves the panel where it was: same track, and the highlight is not restarted.
    await expect(title).toHaveText('Lyrics · 01 tidepool');
    await expect(first).toHaveClass(/\bpast\b/);
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

    await page.getByRole('button', { name: 'Next: quiet-notes' }).click();
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

  test('picking a track cues it, and the cue buttons report their pressed state', async ({ page }) => {
    // A cue button is named by its visible text: repository name, then language and commits.
    const names = [
      'tidepool Rust · 5 commits',
      'paper-lantern TypeScript · 3 commits',
      'quiet-notes Text · 1 commit',
      'empty-box Text · 0 commits',
    ];
    for (const [i, name] of names.entries()) {
      await expect(panel(page).locator('[data-q-pick]').nth(i)).toHaveAccessibleName(name);
    }
    await expect(panel(page).locator('[data-q-pick][aria-pressed="true"]')).toHaveCount(1);
    await expect(panel(page).locator('[data-q-pick][aria-pressed="false"]')).toHaveCount(3);

    await panel(page).getByRole('button', { name: 'empty-box Text · 0 commits' }).click();
    await expect(dockTitle(page)).toHaveText('04 empty-box');
    await expect(panel(page).locator('[data-q-now] [data-q-name]')).toHaveText('empty-box');
    // The pressed mark follows the cue into Now playing.
    await expect(panel(page).locator('[data-q-pick][aria-pressed="true"]')).toHaveAccessibleName('empty-box Text · 0 commits');
    await expect(panel(page).locator('[data-q-pick][aria-pressed="false"]')).toHaveCount(3);
  });
});

test.describe('playing a track', () => {
  test('a track list click opens the repository in a new tab and plays its disc', async ({ page, context }) => {
    const popup = context.waitForEvent('page');
    await page.locator('[data-track="1"]').click();
    await (await popup).waitForURL('https://github.com/SairaDev02/paper-lantern');

    // The site stays on screen and plays the disc.
    expect(new URL(page.url()).pathname).toBe('/');
    await expect(dock(page).locator('[data-np-kicker]')).toHaveText('Now playing');
    await expect(page.locator('[data-dock]')).toHaveClass(/is-playing/);
    await expect(page.locator('[data-lcd-title]')).toHaveText('Loading paper-lantern');
    // The playing row keeps the solid yellow fill that a preview only washes towards.
    const playing = page.locator('[data-track="1"]');
    await expect(playing).toHaveClass(/\bon\b/);
    expect(await playing.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 214, 10)');
  });

  test('Prev and Next during a play open a new tab and swap the disc', async ({ page, context }) => {
    const first = context.waitForEvent('page');
    await page.locator('[data-track="0"]').click();
    await (await first).waitForURL('https://github.com/SairaDev02/tidepool');
    // A press during the 1.4 s load is ignored, so wait for the play itself.
    await expect(page.locator('[data-lcd-title]')).toHaveText('tidepool');

    // A preview during a play leaves the faceplate, and the Dock, on the play.
    await page.locator('[data-track="2"]').hover();
    await expect(page.locator('[data-lcd-title]')).toHaveText('tidepool');
    await expect(dockTitle(page)).toHaveText('01 tidepool');

    const next = context.waitForEvent('page');
    await page.getByRole('button', { name: 'Play next: paper-lantern, opens in a new tab' }).click();
    await (await next).waitForURL('https://github.com/SairaDev02/paper-lantern');
    await expect(dockTitle(page)).toHaveText('02 paper-lantern');
    await expect(page.locator('[data-lcd-title]')).toHaveText('Loading paper-lantern');

    await expect(page.locator('[data-lcd-title]')).toHaveText('paper-lantern');
    const prev = context.waitForEvent('page');
    await page.getByRole('button', { name: 'Play previous: tidepool, opens in a new tab' }).click();
    await (await prev).waitForURL('https://github.com/SairaDev02/tidepool');
    await expect(dockTitle(page)).toHaveText('01 tidepool');
    expect(new URL(page.url()).pathname).toBe('/');
  });

  test('the playlist play button opens the cued repository in a new tab', async ({ page, context }) => {
    await page.getByRole('button', { name: 'Next: paper-lantern' }).click();
    const popup = context.waitForEvent('page');
    await page.getByRole('button', { name: 'Play the cued repository: opens it' }).click();
    await (await popup).waitForURL('https://github.com/SairaDev02/paper-lantern');
    await expect(dock(page).locator('[data-np-kicker]')).toHaveText('Now playing');
  });

  test('with reduced motion, a play still opens the repository', async ({ page, context }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const popup = context.waitForEvent('page');
    await page.locator('[data-track="2"]').click();
    await (await popup).waitForURL('https://github.com/SairaDev02/quiet-notes');
    // The play still counts: the load gives way to the play on the clock.
    await expect(page.locator('[data-lcd-title]')).toHaveText('quiet-notes');
  });

  test('a modified click opens the repository in a new tab and still plays the disc', async ({ page, context, isMobile }) => {
    test.skip(isMobile, 'no modifier keys on phones');
    const popup = context.waitForEvent('page');
    await page.locator('[data-track="0"]').click({ modifiers: ['ControlOrMeta'] });
    await (await popup).waitForURL('https://github.com/SairaDev02/tidepool');
    await expect(dock(page).locator('[data-np-kicker]')).toHaveText('Now playing');
    expect(new URL(page.url()).hostname).toBe('127.0.0.1');
  });
});
