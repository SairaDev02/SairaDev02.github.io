// The site as a crawler, a link previewer or a visitor sees it: head metadata, the JSON-LD
// graph, the indexing files and the site chrome. Built from e2e/fixtures/github.json.
import type { Page } from '@playwright/test';
import { expect, test } from './test';

const HOME = 'https://sairadev02.github.io/';
const TITLE = 'SairaDev02 · public repositories';
const DESCRIPTION =
  'Public repositories of SairaDev02, played as a playlist: names, descriptions, languages and commit history.';
const OG_ALT =
  'SairaDev02 in large type on a frosted panel over a pixel-dithered blue cloud sky with a small yellow sun';

/** The content of a `property` or `name` meta tag. */
const meta = async (page: Page, key: string) =>
  page.locator(`meta[property="${key}"], meta[name="${key}"]`).getAttribute('content');

/**
 * A PNG's pixel size, read from its header: the 8 signature bytes, then the IHDR chunk's
 * length and type, then the width and height as big-endian 32-bit integers.
 */
const pngSize = (body: Buffer) => {
  expect(body.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  expect(body.subarray(12, 16).toString('latin1')).toBe('IHDR');
  return { width: body.readUInt32BE(16), height: body.readUInt32BE(20) };
};

/**
 * An ICO's image sizes, read from its ICONDIR: the header's 16-bit image count, then one
 * 16-byte entry per image whose first two bytes are the width and height (0 meaning 256).
 */
const icoSizes = (body: Buffer) => {
  expect(body.subarray(0, 4)).toEqual(Buffer.from([0x00, 0x00, 0x01, 0x00]));
  const count = body.readUInt16LE(4);
  return Array.from({ length: count }, (_, i) => ({ width: body[6 + i * 16] || 256, height: body[7 + i * 16] || 256 }));
};

interface Graph {
  '@context': unknown;
  '@graph': Record<string, unknown>[];
}

/** The single home-page graph; fails when the page embeds none or several. */
const jsonLd = async (page: Page): Promise<Graph> => {
  const scripts = page.locator('script[type="application/ld+json"]');
  await expect(scripts).toHaveCount(1);
  const data: unknown = JSON.parse((await scripts.textContent()) ?? '');
  return data as Graph;
};

test.describe('head metadata', () => {
  test('names the site and gives the canonical home page URL', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(TITLE);
    expect(await meta(page, 'description')).toBe(DESCRIPTION);
    expect(await meta(page, 'og:title')).toBe(TITLE);
    expect(await meta(page, 'og:description')).toBe(DESCRIPTION);
    expect(await meta(page, 'og:type')).toBe('website');
    expect(await meta(page, 'og:site_name')).toBe('SairaDev02');
    expect(await meta(page, 'og:locale')).toBe('en_US');
    expect(await meta(page, 'og:url')).toBe(HOME);
    expect(await meta(page, 'twitter:card')).toBe('summary_large_image');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', HOME);
    // The Twitter card falls back to the Open Graph tags, so twitter:card is the only
    // twitter:* tag.
    const twitter = await page
      .locator('meta[name^="twitter:"]')
      .evaluateAll((tags) => tags.map((tag) => tag.getAttribute('name')));
    expect(twitter).toEqual(['twitter:card']);
  });
});

test.describe('link preview image', () => {
  test('serves a 1200x630 PNG through absolute, content-hashed og:image tags', async ({ page, request }) => {
    await page.goto('/');
    const src = (await meta(page, 'og:image')) ?? '';
    expect(src).toMatch(/^https:\/\/sairadev02\.github\.io\/_astro\/og-card\.[\w-]+\.png$/);
    expect(await meta(page, 'og:image:type')).toBe('image/png');
    expect(await meta(page, 'og:image:width')).toBe('1200');
    expect(await meta(page, 'og:image:height')).toBe('630');
    expect(await meta(page, 'og:image:alt')).toBe(OG_ALT);
    // X falls back to og:image, so there are no twitter:image tags.
    expect(await page.locator('meta[name^="twitter:image"]').count()).toBe(0);

    const res = await request.get(new URL(src).pathname);
    expect(res.ok()).toBe(true);
    expect(res.headers()['content-type']).toBe('image/png');
    const body = await res.body();
    expect(body.byteLength).toBeLessThan(300 * 1024);
    expect(pngSize(body)).toEqual({ width: 1200, height: 630 });
  });

  test('keeps the dev-only card route out of the build', async ({ request }) => {
    expect((await request.get('/og-card')).status()).toBe(404);
  });
});

test.describe('structured data', () => {
  test('embeds one graph of WebSite, ProfilePage and Person linked by @id', async ({ page }) => {
    await page.goto('/');
    const data = await jsonLd(page);
    expect(data['@context']).toBe('https://schema.org');

    const nodes = data['@graph'];
    expect(nodes.map((n) => n['@type'])).toEqual(['WebSite', 'ProfilePage', 'Person']);
    const node = (type: string) => {
      const found = nodes.find((n) => n['@type'] === type);
      if (!found) throw new Error(`the graph has no ${type} node`);
      return found;
    };

    const website = node('WebSite');
    const profile = node('ProfilePage');
    const person = node('Person');
    expect(website).toMatchObject({ name: 'SairaDev02', alternateName: 'sairadev02.github.io', url: HOME });
    expect(profile).toMatchObject({ url: HOME, headline: TITLE, description: DESCRIPTION });
    expect(Date.parse(String(profile.dateModified))).not.toBeNaN();
    expect(profile.mainEntity).toEqual({ '@id': person['@id'] });
    expect(profile.isPartOf).toEqual({ '@id': website['@id'] });
    expect(person).toMatchObject({
      name: 'SairaDev02',
      url: HOME,
      sameAs: ['https://github.com/SairaDev02', 'https://crates.io/users/SairaDev02'],
      image: 'https://avatars.githubusercontent.com/u/96645098',
    });
  });
});

test.describe('indexing', () => {
  test('/sitemap.xml lists the home page with the ProfilePage date as its lastmod', async ({ page, request }) => {
    const res = await request.get('/sitemap.xml');
    expect(res.ok()).toBe(true);
    const xml = await res.text();
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain(`<loc>${HOME}</loc>`);
    expect(xml.match(/<url>/g) ?? []).toHaveLength(1);
    expect(xml).not.toContain('changefreq');
    expect(xml).not.toContain('priority');
    // The 404 page must not be listed.
    expect(xml).not.toMatch(/<loc>[^<]*404/);

    await page.goto('/');
    const profile = (await jsonLd(page))['@graph'].find((n) => n['@type'] === 'ProfilePage');
    expect(xml).toContain(`<lastmod>${String(profile?.dateModified)}</lastmod>`);
  });

  test('robots.txt admits every bot and points at the sitemap', async ({ request }) => {
    const res = await request.get('/robots.txt');
    expect(res.ok()).toBe(true);
    const body = await res.text();
    expect(body).toContain('User-agent: *\nAllow: /\n');
    expect(body).toContain(`Sitemap: ${HOME}sitemap.xml`);
  });

  test('serves the console verification files byte for byte', async ({ request }) => {
    const google = await request.get('/google2c788a79268e6f12.html');
    expect(google.ok()).toBe(true);
    const googleBody = await google.text();
    expect(googleBody).toBe('google-site-verification: google2c788a79268e6f12.html');
    expect(Buffer.byteLength(googleBody)).toBe(53);

    const bing = await request.get('/BingSiteAuth.xml');
    expect(bing.ok()).toBe(true);
    const bingBody = await bing.text();
    expect(bingBody).toBe('<?xml version="1.0"?>\n<users>\n\t<user>1ED2B9966CE928D9D3F4E16D6ABC80C9</user>\n</users>');
    expect(Buffer.byteLength(bingBody)).toBe(85);
  });
});

test.describe('icons', () => {
  test('links the SVG favicon, the ICO fallback and a 180 px apple-touch-icon', async ({ page, request }) => {
    await page.goto('/');
    await expect(page.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveAttribute('href', '/favicon.svg');
    await expect(page.locator('link[rel="icon"][sizes="32x32"]')).toHaveAttribute('href', '/favicon.ico');
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', '/apple-touch-icon.png');

    const svgRes = await request.get('/favicon.svg');
    expect(svgRes.ok()).toBe(true);
    expect(svgRes.headers()['content-type']).toContain('image/svg+xml');
    // The icon's five fills are the spec's picture tokens.
    const fills = [...(await svgRes.text()).matchAll(/fill="(#[0-9a-f]{6})"/gi)].map((m) => m[1].toLowerCase()).sort();
    expect(fills).toEqual(['#13238a', '#2f55e4', '#a9c3f6', '#f6f9ff', '#ffd60a']);

    const icoRes = await request.get('/favicon.ico');
    expect(icoRes.ok()).toBe(true);
    expect(icoSizes(await icoRes.body())).toContainEqual({ width: 32, height: 32 });

    const appleRes = await request.get('/apple-touch-icon.png');
    expect(appleRes.ok()).toBe(true);
    expect(appleRes.headers()['content-type']).toBe('image/png');
    expect(pngSize(await appleRes.body())).toEqual({ width: 180, height: 180 });
  });
});

test.describe('404 page', () => {
  test('an unknown path returns 404 in site chrome with a way back to the playlist', async ({ page }) => {
    const res = await page.goto('/no-such-track');
    expect(res?.status()).toBe(404);
    await expect(page).toHaveTitle('Not found · SairaDev02');
    await expect(page.getByRole('heading', { level: 1, name: 'Track not found' })).toBeVisible();
    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page.getByRole('contentinfo')).toBeVisible();

    const back = page.getByRole('link', { name: 'Back to the playlist' });
    await expect(back).toHaveAttribute('href', '/');
    await back.click();
    await expect(page).toHaveTitle(TITLE);
    expect(new URL(page.url()).pathname).toBe('/');
  });

  test('has no canonical, no structured data and no link preview image', async ({ page }) => {
    await page.goto('/no-such-track');
    expect(await page.locator('link[rel="canonical"]').count()).toBe(0);
    expect(await page.locator('script[type="application/ld+json"]').count()).toBe(0);
    expect(await page.locator('meta[property="og:url"], meta[name="og:url"]').count()).toBe(0);
    expect(await page.locator('meta[property="og:image"], meta[name="og:image"]').count()).toBe(0);
  });
});

test.describe('site chrome', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('the header nav offers Projects and Contact only', async ({ page }) => {
    const links = page.getByRole('navigation', { name: 'Main' }).getByRole('link');
    await expect(links).toHaveText(['Projects', 'Contact']);
    await expect(links.first()).toHaveAttribute('href', '/');
    await expect(links.first()).toHaveAttribute('aria-current', 'page');
    await expect(links.last()).toHaveAttribute('href', '#contact');
  });

  test('the footer keeps only the Contact column, with rel="me" profile links', async ({ page }) => {
    const footer = page.getByRole('contentinfo');
    await expect(footer.getByText('Contact')).toBeVisible();
    const github = footer.getByRole('link', { name: 'github.com/SairaDev02' });
    const crates = footer.getByRole('link', { name: 'crates.io/users/SairaDev02' });
    await expect(github).toHaveAttribute('href', 'https://github.com/SairaDev02');
    await expect(github).toHaveAttribute('rel', 'me');
    await expect(crates).toHaveAttribute('href', 'https://crates.io/users/SairaDev02');
    await expect(crates).toHaveAttribute('rel', 'me');
  });

  test('shows no placeholder text and no empty sections', async ({ page }) => {
    const body = page.locator('body');
    for (const text of ['[placeholder]', 'No posts yet.', 'Coming soon.']) {
      await expect(body).not.toContainText(text);
    }
    const footer = page.getByRole('contentinfo');
    await expect(footer).not.toContainText('Writing');
    await expect(footer).not.toContainText('Resume');
  });
});
