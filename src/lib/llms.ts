// The site as an llms.txt file (https://llmstxt.org): a Markdown index for language models.
import type { Repo } from './github';

const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim();

function entry(r: Repo): string {
  const notes = [r.description && oneLine(r.description), r.language && `(${r.language})`].filter(Boolean).join(' ');
  return `- [${r.name}](${r.url})${notes ? `: ${notes}` : ''}`;
}

/** `repos` in display order; `site` is the absolute home page URL. */
export function llmsTxt(user: string, site: string, repos: Repo[]): string {
  return [
    `# ${user}`,
    '',
    `> Portfolio of the GitHub user ${user}: their public repositories, presented as a music playlist.`,
    '',
    `The [Home page](${site}) lists every public, non-fork repository, most recently pushed first. ` +
      'The list below is rebuilt with the site each day.',
    '',
    '## Repositories',
    '',
    ...repos.map(entry),
    '',
    '## Optional',
    '',
    `- [GitHub profile](https://github.com/${user})`,
    `- [crates.io profile](https://crates.io/users/${user})`,
    '',
  ].join('\n');
}
