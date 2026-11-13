// /robots.txt: everything is public, and the sitemap's origin comes from the site metadata.
import type { APIRoute } from 'astro';
import { SITE } from '../lib/site';

export const GET: APIRoute = () => {
  const body = `# Everything on this site is public; all crawlers are welcome.
User-agent: *
Allow: /

Sitemap: ${SITE.url}sitemap.xml
`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
