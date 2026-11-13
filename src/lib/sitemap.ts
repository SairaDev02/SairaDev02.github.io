// /sitemap.xml: the pages meant to be indexed, with the site-modified date as their
// lastmod. Only the home page is listed; indexes, the sitemap itself, the 404 page and the
// verification files stay out.
export function sitemapXml(url: string, lastModified: string): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    '  <url>',
    `    <loc>${url}</loc>`,
    `    <lastmod>${lastModified}</lastmod>`,
    '  </url>',
    '</urlset>',
    '',
  ].join('\n');
}
