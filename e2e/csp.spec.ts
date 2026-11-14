// The site's security policy: a meta Content Security Policy with hashed inline styles,
// Trusted Types enforced, and no violation on load or while the page is used. Built from
// e2e/fixtures/github.json.
import type { APIRequestContext, ConsoleMessage, Page } from '@playwright/test';
import { expect, test } from './test';

/** The window the init script and the reads below share. */
interface PolicyWindow extends Window {
  cspViolations: string[];
}

/** The policy as a map of directive name to its sources, from the meta tag's content. */
const policy = async (page: Page) => {
  const tags = page.locator('meta[http-equiv="content-security-policy"]');
  await expect(tags, 'the page has no CSP meta tag').toHaveCount(1);
  const content = (await tags.getAttribute('content')) ?? '';
  return new Map(
    content
      .split(';')
      .map((directive) => directive.trim().split(/\s+/).filter(Boolean))
      .filter(([name]) => name)
      .map(([name, ...sources]) => [name, sources] as const),
  );
};

/**
 * Records every CSP violation from before the page's first script runs. A meta policy
 * starts governing the document where it appears in the head, so later violations still
 * reach this listener.
 */
const watchPolicy = (page: Page) =>
  page.addInitScript(() => {
    const log: string[] = [];
    (window as unknown as PolicyWindow).cspViolations = log;
    document.addEventListener('securitypolicyviolation', (event) => {
      const sample = event.sample ? `: ${event.sample}` : '';
      log.push(`${event.effectiveDirective} blocked ${event.blockedURI || '(inline)'}${sample}`);
    });
  });

/** The violations recorded so far. */
const violations = (page: Page) =>
  page.evaluate(() => (window as unknown as PolicyWindow).cspViolations ?? []);

/** Console errors that only a policy problem produces; the shared fixture fails on all errors anyway. */
const policyErrors = (page: Page) => {
  const found: string[] = [];
  const check = (message: ConsoleMessage) => {
    if (message.type() === 'error' && /content security policy|trusted types|refused to/i.test(message.text())) {
      found.push(message.text());
    }
  };
  page.on('console', check);
  return found;
};

/**
 * The directives the spec fixes on every page. A meta CSP ignores `frame-ancestors`,
 * `report-uri` and `sandbox`, so those must not appear.
 */
const REQUIRED: [string, string[]][] = [
  ['object-src', ["'none'"]],
  ['base-uri', ["'self'"]],
  ['form-action', ["'none'"]],
  ['require-trusted-types-for', ["'script'"]],
  ['trusted-types', ["'none'"]],
];

/** A sha256 hash source, as Astro writes one: the base64 digest in single quotes. */
const IS_SHA256 = /^'sha256-[\w+/]{43}='$/;

const expectPolicy = async (page: Page) => {
  const directives = await policy(page);
  for (const [name, sources] of REQUIRED) {
    expect(directives.get(name), `${name} directive`).toEqual(sources);
  }
  expect(directives.has('frame-ancestors')).toBe(false);
  expect(directives.has('report-uri')).toBe(false);
  expect(directives.has('sandbox')).toBe(false);

  const script = directives.get('script-src') ?? [];
  expect(script, 'script-src').toContain("'self'");
  expect(script.filter((source) => IS_SHA256.test(source)).length, 'script-src hashes').toBeGreaterThan(0);
  // Inline script is only allowed through hashes: nothing here may switch that off.
  expect(script).not.toContain("'unsafe-inline'");
  expect(script).not.toContain("'unsafe-eval'");

  const style = directives.get('style-src') ?? [];
  expect(style, 'style-src').toContain("'self'");
  expect(style.filter((source) => IS_SHA256.test(source)).length, 'style-src hashes').toBeGreaterThan(0);

  // Inline style is only allowed through hashes too: no directive may switch that off, and
  // the page needs no style attributes, so there is no `style-src-attr` exception.
  for (const [name, sources] of directives) {
    expect(sources, `${name} directive`).not.toContain("'unsafe-inline'");
    expect(sources, `${name} directive`).not.toContain("'unsafe-hashes'");
  }
  expect(directives.has('style-src-attr'), 'style-src-attr directive').toBe(false);
};

/**
 * The page as served carries no `style` attribute, so the policy has nothing to allow for
 * one. (Scripts may still set styles through the CSSOM, which a CSP does not govern.)
 */
const expectNoStyleAttributes = async (request: APIRequestContext, path: string) => {
  const html = await (await request.get(path)).text();
  expect(html.match(/<[^>]+\sstyle\s*=/gi) ?? [], `style attributes in ${path}`).toEqual([]);
};

/**
 * Every inline executable script on the page must appear as a hash in `script-src`. The
 * page's own scripts are external module files, allowed by `'self'`, so this passes
 * without a hash today and fails as soon as an unhashed inline script is added.
 */
const expectInlineScriptsHashed = async (page: Page) => {
  const hashes = await page.evaluate(async () => {
    const inline = [...document.querySelectorAll('script:not([src])')].filter((s) => {
      const type = (s.getAttribute('type') ?? '').toLowerCase();
      return !type || type === 'module' || type === 'text/javascript' || type === 'application/javascript';
    });
    const digest = async (text: string) => {
      const bytes = new TextEncoder().encode(text);
      const hash = await crypto.subtle.digest('SHA-256', bytes);
      return `'sha256-${btoa(String.fromCharCode(...new Uint8Array(hash)))}'`;
    };
    return Promise.all(inline.map((s) => digest(s.textContent ?? '')));
  });
  const script = (await policy(page)).get('script-src') ?? [];
  for (const hash of hashes) expect(script, `script-src covers inline script ${hash}`).toContain(hash);
};

test.describe('policy on every page', () => {
  test('the home page carries the hashed policy with Trusted Types enforced', async ({ page, request }) => {
    await page.goto('/');
    await expectPolicy(page);
    await expectInlineScriptsHashed(page);
    await expectNoStyleAttributes(request, '/');
  });

  test('the 404 page carries the same policy', async ({ page, request }) => {
    expect((await page.goto('/no-such-track'))?.status()).toBe(404);
    await expectPolicy(page);
    await expectInlineScriptsHashed(page);
    await expectNoStyleAttributes(request, '/no-such-track');
  });
});

test.describe('nothing is blocked', () => {
  test('loads the inlined stylesheet, the barcode and grid styles, the fonts, the JSON-LD and the tracks JSON', async ({ page }) => {
    const fonts: string[] = [];
    page.on('response', (response) => {
      if (response.url().endsWith('.woff2') && response.status() === 200) fonts.push(new URL(response.url()).pathname);
    });
    await watchPolicy(page);
    await page.goto('/');

    // The inlined stylesheet applies: the body font comes from global.css and the barcode
    // bars take their colour from its `--accent` token.
    expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toContain('IBM Plex Mono');
    expect(await page.locator('.barcode i').first().evaluate((bar) => getComputedStyle(bar).backgroundColor)).toBe(
      'rgb(29, 63, 208)',
    );

    // The barcode's bar widths and the player's grid size apply. A blocked rule leaves
    // every bar zero-width and the grid unset.
    const bars = await page
      .locator('.barcode i')
      .evaluateAll((all) => all.map((bar) => parseFloat(getComputedStyle(bar).width)));
    expect(bars.length).toBeGreaterThan(0);
    expect(bars.every((width) => width > 0)).toBe(true);
    expect(await page.locator('canvas').evaluate((c) => getComputedStyle(c).getPropertyValue('--wide-w').trim())).not.toBe('');

    // Both preloaded fonts arrive.
    const preloaded = await page
      .locator('link[rel="preload"][as="font"]')
      .evaluateAll((links) => links.map((link) => new URL(link.getAttribute('href') ?? '', location.href).pathname));
    expect(preloaded).toHaveLength(2);
    await expect.poll(() => fonts).toEqual(expect.arrayContaining(preloaded));

    // The JSON-LD parses and the client script parsed the tracks JSON: the dock's next-in-
    // queue button only exists once the script has read it.
    const graph = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent()) ?? '');
    expect(graph['@context']).toBe('https://schema.org');
    await page.getByRole('button', { name: 'Next: paper-lantern' }).click();
    await expect(page.getByRole('region', { name: 'Now playing' }).locator('[data-np-title]')).toHaveText('02 paper-lantern');

    expect(await violations(page)).toEqual([]);
  });

  test('holds while the Lyrics panel, the Queue panel and a queue drag are used', async ({ page }) => {
    await watchPolicy(page);
    await page.goto('/');
    const errors = policyErrors(page);

    const lyrics = page.getByRole('button', { name: 'Lyrics', exact: true });
    await lyrics.click();
    await expect(page.getByRole('region', { name: 'Lyrics: README of the cued repository' })).toBeVisible();
    await lyrics.click();
    await expect(lyrics).toHaveAttribute('aria-expanded', 'false');

    await page.getByRole('button', { name: 'Queue', exact: true }).click();
    const panel = page.getByRole('region', { name: 'Queue', exact: true });
    await expect(panel.locator('[data-q-next] [data-q-name]')).toHaveText(['paper-lantern', 'quiet-notes', 'empty-box']);

    const row = (await panel.locator('[data-q-next] > li').first().boundingBox())!;
    const handle = (await panel.locator('[data-q-next] [data-q-handle]').first().boundingBox())!;
    const x = handle.x + handle.width / 2;
    const y = handle.y + handle.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + row.height * 2, { steps: 8 });
    await page.mouse.up();
    await expect(panel.locator('[data-q-next] [data-q-name]')).toHaveText(['quiet-notes', 'empty-box', 'paper-lantern']);

    expect(await violations(page), 'CSP violations from the panels and the drag').toEqual([]);
    expect(errors, 'policy console errors').toEqual([]);
  });

  test('holds while a disc plays', async ({ page }) => {
    await watchPolicy(page);
    // The tab a play opens is another document; the page that plays is the one under test.
    await page.addInitScript(() => {
      Object.defineProperty(window, 'open', { configurable: true, writable: true, value: () => ({ opener: null }) });
    });
    await page.goto('/');
    const errors = policyErrors(page);

    await page.locator('[data-dock] [data-np="play"]').click();
    await expect(page.locator('[data-lcd-title]')).toHaveText('Loading tidepool');
    await expect(page.locator('[data-dock]')).toHaveClass(/is-playing/);
    // The play writes to the document (the waveform fill, the status, the load's animation):
    // read what it has recorded so far, and again once the load has given way to the play.
    expect(await violations(page), 'CSP violations from the load').toEqual([]);

    await expect(page.locator('[data-lcd-title]')).toHaveText('tidepool');
    expect(await violations(page), 'CSP violations from the play').toEqual([]);
    expect(errors, 'policy console errors').toEqual([]);
  });
});
