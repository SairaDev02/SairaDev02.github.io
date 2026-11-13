// The site-modified date: the newest change the site can vouch for. It is the later of the
// newest push among the repositories the page shows and the last commit that touched site
// files, never the build clock, so a nightly rebuild with no changes keeps the same date.
import { execFileSync } from 'node:child_process';
import { getRepos } from './github';

/** The site files: content and configuration, not docs, tests or the build output. */
const SITE_PATHS = ['src', 'public', 'astro.config.mjs'];

/**
 * The later of the two dates, as a UTC ISO 8601 timestamp. The git date is an argument so
 * this rule stays pure and testable.
 */
export function siteModifiedDate(repoPushedAt: string, siteCommitDate: string): string {
  return new Date(Math.max(Date.parse(repoPushedAt), Date.parse(siteCommitDate))).toISOString();
}

/**
 * Committer date of the last commit that touched site files. Runs git at build time;
 * `run` is the seam for tests. Throws when git has no date, so the build fails loudly
 * instead of dropping the date.
 */
export function readSiteCommitDate(run: (args: string[]) => string = git): string {
  const date = run(['log', '-1', '--format=%cI', '--', ...SITE_PATHS]).trim();
  if (!date) throw new Error('Site-modified date: git returned no commit date for the site files.');
  return date;
}

function git(args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8' });
}

/** The date this build reports: the sitemap `lastmod` and the ProfilePage `dateModified`. */
export async function siteModifiedAtBuild(): Promise<string> {
  const [newest] = await getRepos();
  if (!newest) throw new Error('Site-modified date: the site shows no repositories, so no push date.');
  return siteModifiedDate(newest.pushedAt, readSiteCommitDate());
}
