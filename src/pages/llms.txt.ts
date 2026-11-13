// /llms.txt, built from the same repository data as the home page.
import type { APIRoute } from 'astro';
import { GITHUB_USER, getRepos } from '../lib/github';
import { llmsTxt } from '../lib/llms';

export const GET: APIRoute = async ({ site }) => {
  if (!site) throw new Error('llms.txt needs `site` in astro.config.mjs.');
  return new Response(llmsTxt(GITHUB_USER, site.href, await getRepos()));
};
