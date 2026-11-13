// /sitemap.xml: the home page and its site-modified date, built the same way as llms.txt.
import type { APIRoute } from 'astro';
import { SITE } from '../lib/site';
import { siteModifiedAtBuild } from '../lib/site-date';
import { sitemapXml } from '../lib/sitemap';

export const GET: APIRoute = async () => {
  const xml = sitemapXml(SITE.url, await siteModifiedAtBuild());
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
