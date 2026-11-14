// A play: the repository opens in a new tab at the gesture and the disc runs on the wall
// clock, then returns to its slot. Built from e2e/fixtures/github.json, whose display
// order is 01 tidepool, 02 paper-lantern, 03 quiet-notes, 04 empty-box.
import type { Page } from '@playwright/test';
import { layoutDiscs } from '../src/scripts/player/geometry';
import { picture, waitForScene } from './picture';
import { expect, test } from './test';

const REPO = 'https://github.com/SairaDev02/';
/** The Dock's Play button: the playlist header has one with the same name. */
const playButton = (page: Page) => page.locator('[data-dock] [data-np="play"]');
const kicker = (page: Page) => page.locator('[data-dock] [data-np-kicker]');
const status = (page: Page) => page.getByRole('status');

/**
 * Freezes the page's clock a moment ahead of where it has got to. An installed clock keeps
 * flowing with real time, so a target a fixed two seconds ahead can already be in the past
 * by the time the call lands: only the page's own clock is a safe reference. The lead only
 * has to outlast the round trip, and a jump of it fires nothing the page has scheduled yet.
 */
const pauseClock = async (page: Page, leadMs = 500) =>
  page.clock.pauseAt(new Date((await page.evaluate(() => Date.now())) + leadMs));

test.describe('opening a repository', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('a click on a disc opens it in a new tab and plays it', async ({ page, context }) => {
    await waitForScene(page);
    const { g, at } = await picture(page);
    const openedTab = context.waitForEvent('page');
    await page.mouse.click(...at(...layoutDiscs(4, g.discArea).slots[0]));
    await (await openedTab).waitForURL(`${REPO}tidepool`);

    expect(new URL(page.url()).pathname).toBe('/');
    await expect(page.locator('[data-dock]')).toHaveClass(/is-playing/);
    await expect(page.locator('[data-lcd-title]')).toHaveText('Loading tidepool');
  });

  test("the Dock's Play opens the cued repository in a new tab", async ({ page, context }) => {
    await page.getByRole('button', { name: 'Next: paper-lantern' }).click();
    const openedTab = context.waitForEvent('page');
    await playButton(page).click();
    await (await openedTab).waitForURL(`${REPO}paper-lantern`);

    expect(new URL(page.url()).pathname).toBe('/');
    await expect(page.locator('[data-dock]')).toHaveClass(/is-playing/);
    await expect(page.locator('[data-lcd-title]')).toHaveText('Loading paper-lantern');
  });

  test('a middle click keeps the link in a new tab and still plays the disc', async ({ page, context, isMobile }) => {
    test.skip(isMobile, 'no middle button on phones');
    const openedTab = context.waitForEvent('page');
    await page.locator('[data-track="2"]').click({ button: 'middle' });
    await (await openedTab).waitForURL(`${REPO}quiet-notes`);
    await expect(page.locator('[data-dock]')).toHaveClass(/is-playing/);
    expect(new URL(page.url()).pathname).toBe('/');
  });

  test('a drop in the tray plays the disc and opens the tab', async ({ page, context, isMobile }) => {
    test.skip(isMobile, 'drag with a pointer');
    await waitForScene(page);
    const { g, at } = await picture(page);
    const openedTab = context.waitForEvent('page');
    await page.mouse.move(...at(...layoutDiscs(4, g.discArea).slots[0]));
    await page.mouse.down();
    await page.mouse.move(...at(g.tray.x, g.tray.y), { steps: 10 });
    await page.mouse.up();
    await (await openedTab).waitForURL(`${REPO}tidepool`);
    await expect(page.locator('[data-dock]')).toHaveClass(/is-playing/);
  });
});

test.describe('a play on the clock', () => {
  test.beforeEach(async ({ page }) => {
    // The tab itself is covered above; here the clock is the subject, so the tab is faked.
    await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
    await page.addInitScript(() => {
      Object.defineProperty(window, 'open', { configurable: true, writable: true, value: () => ({ opener: null }) });
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
    await expect(kicker(page)).toHaveText('Ready to play');
    await expect(page.locator('[data-np-title]')).toHaveText('02 paper-lantern');
    await expect(page.locator('[data-lcd-title]')).toHaveText('Pick a disc');
  });

  test('the label above the title is ready, then loading, then playing', async ({ page }) => {
    await expect(kicker(page)).toHaveText('Ready to play');
    await playButton(page).click();
    await expect(kicker(page)).toHaveText('Loading · opened in a new tab');
    // The Queue panel's top section uses the same label.
    await page.getByRole('button', { name: 'Queue', exact: true }).click();
    const panel = page.getByRole('region', { name: 'Queue', exact: true });
    await expect(panel.locator('[data-q-kicker]')).toHaveText('Loading · opened in a new tab');

    // The load gives way to the play on the clock, not on an animation's end.
    await page.clock.fastForward(1_400);
    await expect(kicker(page)).toHaveText('Now playing');
    await expect(panel.locator('[data-q-kicker]')).toHaveText('Now playing');
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
    await expect(page.locator('[data-lcd-title]')).toHaveText('Pick a disc');
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

  test('with reduced motion, the play still counts on the faceplate', async ({ page }) => {
    // An installed clock still flows with real time; paused it moves only when told to.
    await pauseClock(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await playButton(page).click();
    await page.clock.fastForward(1_600);
    await expect(page.locator('[data-lcd-num]')).toHaveText('0:00');
    await expect(page.locator('[data-lcd-of]')).toHaveText('/0:30');

    await page.clock.fastForward(5_000);
    await expect(page.locator('[data-lcd-num]')).toHaveText('0:05');
    await expect(page.locator('[data-lcd-title]')).toHaveText('tidepool');
  });

  test('the waveform fills over the play, from the clock', async ({ page, isMobile }) => {
    test.skip(isMobile, 'the waveform shows from 900 px up');
    await pauseClock(page);
    const play = playButton(page);
    await play.click();
    const fill = page.locator('[data-wave]:not([hidden]) [data-wave-fill]');
    /** How much of the waveform is still clipped off its right edge, in percent. */
    const clipped = () => fill.evaluate((el) => parseFloat(el.style.clipPath.split(' ')[1]));
    // Nothing is coloured until the disc lands.
    await expect(fill).toHaveCSS('clip-path', 'inset(0px 100% 0px 0px)');

    await page.clock.fastForward(1_400 + 15_000);
    // Half of the 30 s: half the waveform is coloured, so half is clipped away.
    expect(await clipped()).toBeCloseTo(50, 0);

    // A return resets it.
    await page.clock.fastForward(30_100);
    await expect(page.locator('[data-dock]')).not.toHaveClass(/is-playing/);
    expect(await clipped()).toBe(100);
  });
});

test.describe('reopening the playing repository', () => {
  test.beforeEach(async ({ page }) => {
    // A frozen clock, so the time on the faceplate is exactly where a test leaves it.
    await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
    await page.goto('/');
    await pauseClock(page);
  });

  test('Play becomes Reopen, and pressing it opens the tab again without restarting the play', async ({ page, context }) => {
    const play = playButton(page);
    await expect(play).toHaveAccessibleName('Play tidepool, opens in a new tab');
    const first = context.waitForEvent('page');
    await play.click();
    await (await first).waitForURL(`${REPO}tidepool`);

    // The glyph and the name say the tab is already open.
    await expect(play).toHaveAccessibleName('Reopen tidepool in a new tab');
    await expect(play.locator('.i-reopen')).toBeVisible();
    await expect(play.locator('.i-play')).toBeHidden();
    // The playlist header's Play is the same control: it says the same words, and its glyph
    // agrees with them.
    const header = page.getByRole('region', { name: 'Repositories' }).getByRole('button', { name: 'Reopen tidepool in a new tab' });
    await expect(header).toBeVisible();
    await expect(header.locator('.i-reopen')).toBeVisible();
    await expect(header.locator('.i-play')).toBeHidden();

    await page.clock.fastForward(1_400 + 5_000);
    await expect(page.locator('[data-lcd-num]')).toHaveText('0:05');

    const again = context.waitForEvent('page');
    await play.click();
    await (await again).waitForURL(`${REPO}tidepool`);
    await expect(status(page)).toHaveText('Reopened tidepool in a new tab');
    // The 30 s kept counting: the faceplate is where it was, not back at the start.
    await expect(page.locator('[data-lcd-num]')).toHaveText('0:05');
    await page.clock.fastForward(10_000);
    await expect(page.locator('[data-lcd-num]')).toHaveText('0:15');
  });
});

test.describe('reopening from the disc in the tray', () => {
  test('a click on the playing disc reopens its tab and the play goes on', async ({ page, context }) => {
    await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
    await page.goto('/');
    await waitForScene(page);
    // The picture in the middle of the screen, so the play's own scrollIntoView moves
    // nothing and the geometry below stays valid while the clock is frozen.
    await page.locator('[data-player] canvas').evaluate((c) => c.scrollIntoView({ block: 'center' }));
    const { g, at } = await picture(page);
    await pauseClock(page);

    const first = context.waitForEvent('page');
    await playButton(page).click();
    await (await first).waitForURL(`${REPO}tidepool`);
    // Frames on the frozen clock: the disc travels into the tray, where the pointer finds it.
    await page.clock.runFor(1_500);
    await page.clock.fastForward(5_000);
    await expect(page.locator('[data-lcd-num]')).toHaveText('0:05');

    const reopened = context.waitForEvent('page');
    await page.mouse.click(...at(g.tray.x, g.tray.y));
    await (await reopened).waitForURL(`${REPO}tidepool`);
    await expect(status(page)).toHaveText('Reopened tidepool in a new tab');
    // The 30 s kept counting: the faceplate is where it was, and the play ends on its own time.
    await expect(page.locator('[data-lcd-num]')).toHaveText('0:05');
    await page.clock.fastForward(10_000);
    await expect(page.locator('[data-lcd-num]')).toHaveText('0:15');
    await page.clock.fastForward(15_100);
    // It ended on the first press's 30 s, not 30 s after the reopen.
    await expect(status(page)).toHaveText('tidepool returned');
    await expect(page.locator('[data-dock]')).not.toHaveClass(/is-playing/);
    // Idle again: the glyph goes back to ▶ with the name, from that same update.
    await expect(playButton(page).locator('.i-play')).toBeVisible();
    await expect(playButton(page)).toHaveAccessibleName('Play paper-lantern, opens in a new tab');
  });
});

test.describe('ending a play early', () => {
  test.beforeEach(async ({ page }) => {
    // The tab is not the subject: only the faceplate's Eject is.
    await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
    await page.addInitScript(() => {
      Object.defineProperty(window, 'open', { configurable: true, writable: true, value: () => ({ opener: null }) });
    });
    await page.goto('/');
  });

  test('Eject ends the play, sends the disc home and lands focus on the Dock’s Play', async ({ page }) => {
    await playButton(page).click();
    // Only a play has the button: the load has no Eject yet.
    await expect(page.locator('[data-lcd-eject]')).toBeHidden();
    await page.clock.fastForward(1_600);

    const eject = page.locator('[data-lcd-eject]');
    await expect(eject).toBeVisible();
    await expect(eject).toHaveAccessibleName('Eject tidepool');
    // The info line reads language · dotted date · description.
    await expect(page.locator('[data-lcd-info]')).toContainText('Rust · updated 2026.10.20 · Command-line synthesiser for tide charts.');
    await eject.focus();
    await page.keyboard.press('Enter');

    await expect(status(page)).toHaveText('tidepool ejected');
    await expect(page.locator('[data-dock]')).not.toHaveClass(/is-playing/);
    await expect(page.locator('[data-lcd-title]')).toHaveText('Pick a disc');
    await expect(eject).toBeHidden();
    // The button left with the play, so focus took the Dock's own Play, not the header's.
    await expect(page.locator('[data-dock] [data-np="play"]')).toBeFocused();
    // An Eject keeps the Cue.
    await expect(page.locator('[data-np-title]')).toHaveText('01 tidepool');
  });
});

/**
 * Hovers a point until the faceplate names what the pointer found there. A disc still
 * gliding home is not under the pointer yet, and only a new pointermove asks again.
 */
const hoverUntil = async (
  page: Page,
  at: (x: number, y: number) => readonly [number, number],
  [x, y]: readonly [number, number],
  title: string,
) =>
  expect
    .poll(async () => {
      await page.mouse.move(...at(x, y));
      await page.mouse.move(...at(x + 1, y + 1));
      return page.locator('[data-lcd-title]').textContent();
    })
    .toBe(title);

test.describe('dragging on the picture', () => {
  test.beforeEach(async ({ page, isMobile }) => {
    test.skip(isMobile, 'drag with a pointer');
    await page.addInitScript(() => {
      Object.defineProperty(window, 'open', { configurable: true, writable: true, value: () => ({ opener: null }) });
    });
    await page.goto('/');
    await waitForScene(page);
  });

  test('dragging the playing disc out ejects it, and it stays where it lands', async ({ page }) => {
    const { g, at } = await picture(page);
    const slot = layoutDiscs(4, g.discArea).slots[0];
    // The gap between the four resting discs: clear of every slot by a disc's width.
    const sky = [g.discArea.x0 + (g.discArea.x1 - g.discArea.x0) / 2, g.discArea.y0 + (g.discArea.y1 - g.discArea.y0) / 2] as const;
    await page.mouse.click(...at(...slot));
    // Presses during the load are ignored: the disc has to land before it can be dragged.
    await expect(page.locator('[data-lcd-title]')).toHaveText('tidepool');

    await page.mouse.move(...at(g.tray.x, g.tray.y));
    await page.mouse.down();
    await page.mouse.move(...at(...sky), { steps: 12 });
    await page.mouse.up();

    await expect(status(page)).toHaveText('tidepool ejected');
    await expect(page.locator('[data-dock]')).not.toHaveClass(/is-playing/);
    // It stayed where it landed: the pointer finds it in the sky, and not in its slot.
    await hoverUntil(page, at, sky, 'tidepool');
    await hoverUntil(page, at, slot, 'Pick a disc');
  });

  test('a drop on the player body returns the disc to its slot', async ({ page }) => {
    const { g, at } = await picture(page);
    const slot = layoutDiscs(4, g.discArea).slots[0];
    const body = [g.body.x0 + 10, g.body.y1 - 8] as const;
    await page.mouse.click(...at(...slot));
    await expect(page.locator('[data-lcd-title]')).toHaveText('tidepool');

    await page.mouse.move(...at(g.tray.x, g.tray.y));
    await page.mouse.down();
    await page.mouse.move(...at(...body), { steps: 12 });
    await page.mouse.up();

    await expect(status(page)).toHaveText('tidepool ejected');
    // Home again: the pointer finds it in its slot, not where it was dropped.
    await hoverUntil(page, at, slot, 'tidepool');
    await hoverUntil(page, at, body, 'Pick a disc');
  });

  test('dragging the playing disc out and back in keeps the play and reopens nothing', async ({ page }) => {
    const { g, at } = await picture(page);
    await page.mouse.click(...at(...layoutDiscs(4, g.discArea).slots[0]));
    await expect(page.locator('[data-lcd-title]')).toHaveText('tidepool');
    await expect(status(page)).toHaveText('Playing tidepool, opened in a new tab');

    // Out of the tray and back: a drag, not a click on the playing disc.
    await page.mouse.move(...at(g.tray.x, g.tray.y));
    await page.mouse.down();
    await page.mouse.move(...at(g.tray.x + 60, g.tray.y - 60), { steps: 8 });
    await page.mouse.move(...at(g.tray.x, g.tray.y), { steps: 8 });
    await page.mouse.up();

    // Nothing was announced: no tab was reopened, and the disc plays on.
    await expect(status(page)).toHaveText('Playing tidepool, opened in a new tab');
    await expect(page.locator('[data-dock]')).toHaveClass(/is-playing/);
  });

  test('Escape cancels a drag and nothing plays', async ({ page }) => {
    const { g, at } = await picture(page);
    const slot = layoutDiscs(4, g.discArea).slots[1];
    await page.mouse.move(...at(...slot));
    await page.mouse.down();
    await page.mouse.move(...at(g.tray.x, g.tray.y), { steps: 10 });
    // Held over the tray the faceplate offers the release; Escape takes it back.
    await expect(page.locator('[data-lcd-title]')).toHaveText('Release to play');
    await page.keyboard.press('Escape');
    await page.mouse.up();

    await expect(status(page)).toHaveText('');
    await expect(page.locator('[data-dock]')).not.toHaveClass(/is-playing/);
    // The disc went back to the slot it came from.
    await hoverUntil(page, at, slot, 'paper-lantern');
  });
});

test.describe('a blocked tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'open', { configurable: true, writable: true, value: () => null });
    });
    await page.goto('/');
  });

  test('plays nothing and says how to open the repository', async ({ page }) => {
    await playButton(page).click();
    await expect(status(page)).toHaveText('New tab blocked. Click tidepool to open it');
    await expect(page.locator('[data-dock]')).not.toHaveClass(/is-playing/);
    // The faceplate keeps the block until the next Preview, drag or play.
    await expect(page.locator('[data-lcd-title]')).toHaveText('Tab blocked');
    await expect(page.locator('[data-lcd-info]')).toContainText('Click the disc to open tidepool');
  });

  test('lets the next preview take the faceplate back', async ({ page, isMobile }) => {
    test.skip(isMobile, 'no hover on touch screens');
    await playButton(page).click();
    await expect(page.locator('[data-lcd-title]')).toHaveText('Tab blocked');

    await page.locator('[data-track="2"]').hover();
    await expect(page.locator('[data-lcd-title]')).toHaveText('quiet-notes');
  });
});

test.describe('a drop whose user activation ran out', () => {
  test('blocks the tab and says so on the faceplate', async ({ page, isMobile }) => {
    test.skip(isMobile, 'drag with a pointer');
    // A browser refuses a new tab once user activation has run out (Chromium: 5 s from
    // the press). A pointer drag's own drop is a gesture, and Playwright's Chromium allows
    // every new tab, so the rule is emulated here — this is the browser's rule, not the
    // page's: openTab → null → block runs as it does in a browser that refused the tab.
    await page.addInitScript(() => {
      const open = window.open.bind(window);
      let pressed = -Infinity;
      addEventListener('pointerdown', () => (pressed = Date.now()), true);
      Object.defineProperty(window, 'open', {
        configurable: true,
        writable: true,
        value: (url?: string | URL, target?: string, features?: string) =>
          Date.now() - pressed > 5000 ? null : open(url, target, features),
      });
    });
    await page.goto('/');
    await waitForScene(page);
    const { g, at } = await picture(page);
    // No stub of the page's own path: the real press, the real wait, the real drop.
    await page.mouse.move(...at(...layoutDiscs(4, g.discArea).slots[0]));
    await page.mouse.down();
    await page.waitForTimeout(6_000);
    await page.mouse.move(...at(g.tray.x, g.tray.y), { steps: 10 });
    await page.mouse.up();

    await expect(page.locator('[data-lcd-title]')).toHaveText('Tab blocked');
    await expect(page.locator('[data-dock]')).not.toHaveClass(/is-playing/);
  });
});
