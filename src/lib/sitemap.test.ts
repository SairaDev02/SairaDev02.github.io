import { describe, expect, it } from 'vitest';
import { sitemapXml } from './sitemap';

describe('sitemapXml', () => {
  const xml = sitemapXml('https://sairadev02.github.io/', '2026-11-13T22:11:01.000Z');

  it('lists the home page with the site-modified date as its lastmod', () => {
    expect(xml).toContain('<loc>https://sairadev02.github.io/</loc>');
    expect(xml).toContain('<lastmod>2026-11-13T22:11:01.000Z</lastmod>');
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
  });

  it('has exactly one URL and no changefreq or priority', () => {
    expect(xml.match(/<url>/g)).toHaveLength(1);
    expect(xml).not.toContain('changefreq');
    expect(xml).not.toContain('priority');
  });
});
