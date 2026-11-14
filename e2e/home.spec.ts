// The home page as built from e2e/fixtures/github.json. Display order is most recently
// pushed first: 01 tidepool, 02 paper-lantern, 03 quiet-notes, 04 empty-box.
import type { Locator, Page } from '@playwright/test';
import { layoutDiscs } from '../src/scripts/player/geometry';
import { picture, waitForScene } from './picture';
import { expect, test } from './test';

const dock = (page: Page) => page.getByRole('region', { name: 'Now playing' });
const dockTitle = (page: Page) => dock(page).locator('[data-np-title]');
/** The Dock's own Play button: the playlist header has one with the same name. */
const dockPlay = (page: Page) => dock(page).locator('[data-np="play"]');
const queuePanel = (page: Page) => page.getByRole('region', { name: 'Queue', exact: true });

/** How far an element's bottom edge clears the Dock's top edge; negative means it is under it. */
const clearance = async (page: Page, el: Locator) => {
  const [box, dockBox] = [await el.boundingBox(), await page.locator('[data-dock]').boundingBox()];
  expect(box, 'the element has a box').not.toBeNull();
  expect(dockBox, 'the dock has a box').not.toBeNull();
  return dockBox!.y - (box!.y + box!.height);
};

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

  test('names the cover art', async ({ page }) => {
    await expect(page.getByRole('img', { name: 'SairaDev02’s GitHub avatar' })).toBeVisible();
  });

  test('fills gaps in repository data', async ({ page }) => {
    const quiet = page.locator('[data-track="2"]');
    await expect(quiet).toContainText('No description.');
    await expect(quiet.locator('.commits')).toHaveText(/^\s*1\s*commits\s*$/);
  });

  test('draws the CD player picture', async ({ page }) => {
    // The alt text says what a disc does: opens the repository in a new tab, plays 30 s.
    const canvas = page.getByRole('img', {
      name: /A CD player in a cloudy sky beside 4 discs, one per public repository\. Clicking a disc or dragging it into the player opens that repository in a new tab and plays it for 30 seconds; the track list below does the same\./,
    });
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
  test('starts ready to play on the first track', async ({ page }) => {
    await expect(dock(page).locator('[data-np-kicker]')).toHaveText('Ready to play');
    await expect(dockTitle(page)).toHaveText('01 tidepool');
    await expect(dock(page).locator('[data-np-sub]')).toHaveText('Rust · cli · audio · synth');
    await expect(dockPlay(page)).toHaveAccessibleName('Play tidepool, opens in a new tab');
    // The old wording is gone with the old behaviour.
    await expect(page.getByText('Up next')).toHaveCount(0);
    await expect(page.getByText('Next up')).toHaveCount(0);
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
    await expect(page.locator('[data-lcd-title]')).toHaveText('Pick a disc');
    await expect(dockTitle(page)).toHaveText('01 tidepool');
  });

  test('hovering a disc previews it without moving the dock', async ({ page, isMobile }) => {
    test.skip(isMobile, 'no hover on touch screens');
    await waitForScene(page);
    const { g, at } = await picture(page);
    await page.mouse.move(...at(...layoutDiscs(4, g.discArea).slots[2]));
    await expect(page.locator('[data-lcd-title]')).toHaveText('quiet-notes');
    await expect(page.locator('[data-lcd-info]')).toContainText('Text · updated 2026.07.01');
    await expect(dockTitle(page)).toHaveText('01 tidepool');
    // A preview is never announced.
    await expect(page.getByRole('status')).toHaveText('');

    await page.mouse.move(0, 0);
    await expect(page.locator('[data-lcd-title]')).toHaveText('Pick a disc');
    await expect(dockTitle(page)).toHaveText('01 tidepool');
    await expect(page.getByRole('status')).toHaveText('');
  });

  test('hovering the faceplate announces nothing and changes nothing', async ({ page }) => {
    await page.locator('[data-lcd]').hover();
    await expect(page.locator('[data-lcd-title]')).toHaveText('Pick a disc');
    await expect(page.getByRole('status')).toHaveText('');
    // The faceplate is a quiet view: the page's status is its one live region.
    await expect(page.locator('[aria-live]')).toHaveCount(0);
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

  test('shuffle toggles from the bar', async ({ page, isMobile }) => {
    test.skip(isMobile, 'on phones Shuffle lives in the Queue panel header');
    const shuffle = page.locator('[data-dock] .ctrl [data-np="shuffle"]');
    await expect(shuffle).toBeVisible();
    // The panel's own copy is the phone's, and stays out of the way from 600 px up.
    await expect(queuePanel(page).locator('[data-np="shuffle"]')).toBeHidden();
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

  test('shows the README with no highlight while nothing plays', async ({ page, isMobile }) => {
    await page.getByRole('button', { name: 'Lyrics', exact: true }).click();
    const panel = page.getByRole('region', { name: 'Lyrics: README of the cued repository' });
    const lines = panel.locator('[data-lines] li:not(.tag)');
    await expect(lines).toHaveText(['Turns tide tables into slow, swelling drones.', 'Pipe a tide chart in and listen to the harbour breathe.']);
    // Nothing is lit until a play runs.
    await expect(panel.locator('[data-lines] li.now')).toHaveCount(0);
    await expect(panel.locator('[data-lines] li.past')).toHaveCount(0);

    if (isMobile) return; // no hover on touch screens
    // A preview leaves the panel where it was: same track, still nothing lit.
    await page.locator('[data-track="1"]').hover();
    await expect(panel.locator('[data-lyrics-title]')).toHaveText('Lyrics · 01 tidepool');
    await expect(panel.locator('[data-lines] li.now')).toHaveCount(0);
    await expect(panel.locator('[data-lines] li.past')).toHaveCount(0);
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

test.describe('lyrics during a play', () => {
  // The clock is the subject, so the tab a play opens is not: the page that plays is.
  test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
    await page.addInitScript(() => {
      Object.defineProperty(window, 'open', { configurable: true, writable: true, value: () => ({ opener: null }) });
    });
    await page.goto('/');
    await page.getByRole('button', { name: 'Lyrics', exact: true }).click();
  });

  test('moves the highlight on the play clock, and stops when the play ends', async ({ page }) => {
    const panel = page.getByRole('region', { name: 'Lyrics: README of the cued repository' });
    const lines = panel.locator('[data-lines] li:not(.tag)');
    await expect(panel.locator('[data-lines] li.now')).toHaveCount(0);

    await dockPlay(page).click();
    // The load lights nothing: the play starts when the disc lands.
    await expect(panel.locator('[data-lines] li.now')).toHaveCount(0);
    await page.clock.fastForward(1_400);
    await expect(lines.nth(0)).toHaveClass(/\bnow\b/);

    // One line every 2.6 s, from the play's start.
    await page.clock.fastForward(2_600);
    await expect(lines.nth(1)).toHaveClass(/\bnow\b/);
    await expect(lines.nth(0)).toHaveClass(/\bpast\b/);

    // Eject ends the play, and the highlight with it.
    await page.locator('[data-lcd-eject]').click();
    await expect(panel.locator('[data-lines] li.now')).toHaveCount(0);
    await expect(panel.locator('[data-lines] li.past')).toHaveCount(0);
    await page.clock.fastForward(5_000);
    await expect(panel.locator('[data-lines] li.now')).toHaveCount(0);
  });

  test('with reduced motion, the Lyrics show the README with no highlight', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const panel = page.getByRole('region', { name: 'Lyrics: README of the cued repository' });
    await dockPlay(page).click();
    await page.clock.fastForward(1_400 + 5_000);
    // The play is running: the faceplate counts...
    await expect(page.locator('[data-lcd-num]')).toHaveText('0:05');
    // ...and the README is there, unlit.
    await expect(panel.locator('[data-lines] li:not(.tag)')).toHaveCount(2);
    await expect(panel.locator('[data-lines] li.now')).toHaveCount(0);
    await expect(panel.locator('[data-lines] li.past')).toHaveCount(0);
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

  test('on a phone, Shuffle sits in the Queue panel header', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'the bar carries Shuffle from 600 px up');
    const shuffle = panel(page).locator('[data-np="shuffle"]');
    await expect(shuffle).toBeVisible();
    // The bar keeps Prev, Play, Next, Lyrics and Queue, and drops its own Shuffle.
    await expect(page.locator('[data-dock] .ctrl [data-np="shuffle"]')).toBeHidden();
    await expect(page.locator('[data-dock] .ctrl [data-np]')).toHaveCount(4);
    await expect(page.locator('[data-dock] [data-np-panel]')).toHaveCount(2);

    await expect(shuffle).toHaveAttribute('aria-pressed', 'false');
    await shuffle.click();
    await expect(shuffle).toHaveAttribute('aria-pressed', 'true');
    // It is the same shuffle: Next follows the new order.
    await expect(page.getByRole('button', { name: /^Next: / })).toBeVisible();
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
    const openedTab = context.waitForEvent('page');
    await page.locator('[data-track="1"]').click();
    await (await openedTab).waitForURL('https://github.com/SairaDev02/paper-lantern');

    // The site stays on screen and plays the disc.
    expect(new URL(page.url()).pathname).toBe('/');
    await expect(dock(page).locator('[data-np-kicker]')).toHaveText('Now playing');
    await expect(page.locator('[data-dock]')).toHaveClass(/is-playing/);
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
    const openedTab = context.waitForEvent('page');
    // The header's Play shares its wording with the Dock's: the region tells them apart.
    await page.getByRole('region', { name: 'Repositories' }).getByRole('button', { name: 'Play paper-lantern, opens in a new tab' }).click();
    await (await openedTab).waitForURL('https://github.com/SairaDev02/paper-lantern');
    await expect(dock(page).locator('[data-np-kicker]')).toHaveText('Now playing');
  });

  test('with reduced motion, a play still opens the repository', async ({ page, context }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const openedTab = context.waitForEvent('page');
    await page.locator('[data-track="2"]').click();
    await (await openedTab).waitForURL('https://github.com/SairaDev02/quiet-notes');
    // The play still counts: the load gives way to the play on the clock.
    await expect(page.locator('[data-lcd-title]')).toHaveText('quiet-notes');
  });

  test('a modified click opens the repository in a new tab and still plays the disc', async ({ page, context, isMobile }) => {
    test.skip(isMobile, 'no modifier keys on phones');
    const openedTab = context.waitForEvent('page');
    await page.locator('[data-track="0"]').click({ modifiers: ['ControlOrMeta'] });
    await (await openedTab).waitForURL('https://github.com/SairaDev02/tidepool');
    await expect(dock(page).locator('[data-np-kicker]')).toHaveText('Now playing');
    expect(new URL(page.url()).hostname).toBe('127.0.0.1');
  });
});

test.describe('the waveform', () => {
  test('is a progress fill, with nothing to click, focus or announce', async ({ page, isMobile }) => {
    test.skip(isMobile, 'the waveform shows from 900 px up');
    const waves = page.locator('[data-dock] .waves');
    await expect(waves).toBeVisible();
    // Hidden from the accessibility tree: the outer SVG already is, and no layer adds a node.
    await expect(waves).toHaveAttribute('aria-hidden', 'true');
    expect(
      await waves.locator('svg').evaluateAll((all) => all.length > 0 && all.every((svg) => svg.getAttribute('aria-hidden') === 'true')),
    ).toBe(true);
    // No pointer or keyboard route: nothing inside is focusable, named or clickable.
    expect(await waves.locator('a, button, input, select, textarea, [tabindex], [role], [onclick]').count()).toBe(0);
    expect(await waves.evaluate((el) => getComputedStyle(el).cursor)).not.toBe('pointer');
    await expect(page.getByRole('slider')).toHaveCount(0);
    await expect(page.getByRole('progressbar')).toHaveCount(0);

    // Pressing it plays nothing: the Dock stays on the first track and no tab opens.
    const openedTab = page.waitForEvent('popup', { timeout: 500 }).catch(() => null);
    const box = (await waves.boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    expect(await openedTab, 'no tab opens from the waveform').toBeNull();
    await expect(dock(page).locator('[data-np-kicker]')).toHaveText('Ready to play');
    await expect(dockTitle(page)).toHaveText('01 tidepool');
  });
});

test.describe('the Dock clears the page', () => {
  test('the last footer link, when focused, lands above the Dock', async ({ page }) => {
    const link = page.getByRole('contentinfo').getByRole('link').last();
    await link.focus();
    await expect(link).toBeFocused();
    await expect(link).toBeInViewport();
    // In the viewport is not enough: the Dock floats over it.
    expect(await clearance(page, link)).toBeGreaterThan(-0.5);
  });

  test('a track row focused with a panel open lands above it', async ({ page }) => {
    await page.getByRole('button', { name: 'Queue', exact: true }).click();
    await expect(queuePanel(page)).toBeVisible();
    const row = page.locator('[data-track="3"]');
    await row.focus();
    await expect(row).toBeFocused();
    await expect(row).toBeInViewport();
    expect(await clearance(page, row)).toBeGreaterThan(-0.5);
  });

  test('a play brings the picture back above the Dock', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'open', { configurable: true, writable: true, value: () => ({ opener: null }) });
    });
    // A short window, so the page can scroll the picture out of sight before the play, and
    // tall enough that the picture fits in the space the Dock leaves above it.
    const [w] = await page.evaluate(() => [innerWidth] as const);
    await page.setViewportSize({ width: w, height: 700 });
    await page.reload();
    await page.mouse.wheel(0, 20_000);
    const canvas = page.locator('[data-player] canvas');
    await expect(canvas).not.toBeInViewport();

    await dockPlay(page).click();
    // The picture scrolls into view, and the Dock's height keeps its bottom edge clear.
    await expect.poll(() => clearance(page, canvas)).toBeGreaterThan(-0.5);
  });
});
