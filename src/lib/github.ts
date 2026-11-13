// Build-time loader for the owner's public repositories (GitHub REST API). Runs only in
// Astro's build / dev server; the page embeds the result. About 2 + 2 calls per repo, so
// pass GITHUB_TOKEN: the anonymous limit is 60 calls an hour.
import { readmeToLyrics, type Lyric } from './lyrics';
import { binCommits } from './wave';

export const GITHUB_USER = 'SairaDev02';
/** Public repositories kept off the site, by name (GitHub names ignore case). */
export const HIDDEN_REPOS = ['SairaDev02.github.io', 'HearSeePrototype'];

export interface Repo {
  name: string;
  description: string | null;
  language: string | null;
  topics: string[];
  url: string;
  /** ISO time of the last push to any branch. */
  pushedAt: string;
  /** Commits on the default branch, counting at most MAX_COMMIT_PAGES * 100. */
  commits: number;
  firstCommit: string | null;
  lastCommit: string | null;
  /** Commit counts per lifetime slice; see wave.ts. */
  wave: number[];
  /** README condensed into short lines; see lyrics.ts. */
  lyrics: Lyric[];
}

const MAX_COMMIT_PAGES = 5;
const ATTEMPTS = 3;

export interface GitHubClient {
  /** JSON from an API path. An empty repository's 409 reads as []. */
  json(path: string): Promise<unknown>;
  /** Raw text (README); 404 reads as ''. */
  text(path: string): Promise<string>;
}

export function githubClient({
  token,
  fetch = globalThis.fetch,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
}: {
  token?: string;
  fetch?: typeof globalThis.fetch;
  sleep?: (ms: number) => Promise<void>;
} = {}): GitHubClient {
  const headers = (accept: string) => ({
    Accept: accept,
    'User-Agent': 'portfolio-build',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  });
  // GitHub sometimes answers 422 "taking too long" or a 5xx on list endpoints; a retry
  // succeeds, so try a few times with a short backoff before failing the build.
  // `empty` lists the statuses that mean "nothing here" for this kind of request.
  const get = async (path: string, accept: string, empty: number[]): Promise<Response | null> => {
    for (let attempt = 1; ; attempt++) {
      const res = await fetch(`https://api.github.com${path}`, { headers: headers(accept) });
      if (res.ok) return res;
      if (empty.includes(res.status)) return null;
      const transient = res.status === 422 || res.status >= 500;
      if (!transient || attempt === ATTEMPTS) throw new Error(`GitHub API ${res.status} ${path}: ${await res.text()}`);
      await sleep(800 * attempt);
    }
  };
  return {
    async json(path) {
      // 409: the repository is empty, so it has no commits.
      const res = await get(path, 'application/vnd.github+json', [409]);
      return res ? res.json() : [];
    },
    async text(path) {
      const res = await get(path, 'application/vnd.github.raw', [404]);
      return res ? res.text() : '';
    },
  };
}

/**
 * Recorded API responses in place of the network, for builds that need fixed data (the
 * e2e tests). `json` and `text` map API paths to bodies, as the two client methods return
 * them; the responses still go through the same parsing as live ones. An unrecorded JSON
 * path throws, so a fixture that falls behind the loader fails the build.
 */
export function fixtureClient(fixture: unknown): GitHubClient {
  const valid =
    isObj(fixture) && isObj(fixture.json) && isObj(fixture.text) && Object.values(fixture.text).every((v) => typeof v === 'string');
  if (!valid) throw new Error('GitHub fixture: not a valid fixture; expected { json: { [path]: body }, text: { [path]: string } }');
  const json = fixture.json as Obj;
  const text = fixture.text as Record<string, string>;
  return {
    async json(path) {
      if (!Object.hasOwn(json, path)) throw new Error(`GitHub fixture: path not in the fixture: ${path}`);
      return json[path];
    },
    async text(path) {
      return Object.hasOwn(text, path) ? text[path] : '';
    },
  };
}

// ---------- parsing the untrusted API responses ----------

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

function field<T>(o: Obj, key: string, ok: (v: unknown) => v is T, what: string): T {
  const v = o[key];
  if (!ok(v)) throw new Error(`GitHub API: expected ${key} to be ${what}, got ${JSON.stringify(v)}`);
  return v;
}
const isStr = (v: unknown): v is string => typeof v === 'string';
const isStrOrNull = (v: unknown): v is string | null => v === null || typeof v === 'string';
const isBool = (v: unknown): v is boolean => typeof v === 'boolean';

function list(v: unknown, what: string): Obj[] {
  if (!Array.isArray(v) || !v.every(isObj)) throw new Error(`GitHub API: expected a list of ${what}`);
  return v;
}

interface RawRepo {
  name: string;
  description: string | null;
  language: string | null;
  topics: string[];
  url: string;
  pushedAt: string;
  fork: boolean;
}

function parseRepo(o: Obj): RawRepo {
  const topics = o.topics ?? [];
  if (!Array.isArray(topics) || !topics.every(isStr)) throw new Error('GitHub API: expected topics to be strings');
  return {
    name: field(o, 'name', isStr, 'a string'),
    description: field(o, 'description', isStrOrNull, 'a string or null'),
    language: field(o, 'language', isStrOrNull, 'a string or null'),
    topics,
    url: field(o, 'html_url', isStr, 'a string'),
    pushedAt: field(o, 'pushed_at', isStr, 'a string'),
    fork: field(o, 'fork', isBool, 'a boolean'),
  };
}

function commitTime(o: Obj): number {
  const c = isObj(o.commit) ? o.commit : {};
  const who = isObj(c.author) ? c.author : isObj(c.committer) ? c.committer : {};
  const t = Date.parse(field(who, 'date', isStr, 'a date string'));
  if (Number.isNaN(t)) throw new Error('GitHub API: unreadable commit date');
  return t;
}

// ---------- loading ----------

async function commitTimes(client: GitHubClient, user: string, name: string): Promise<number[]> {
  const times: number[] = [];
  for (let page = 1; page <= MAX_COMMIT_PAGES; page++) {
    const batch = list(await client.json(`/repos/${user}/${name}/commits?per_page=100&page=${page}`), 'commits');
    times.push(...batch.map(commitTime));
    if (batch.length < 100) break;
  }
  return times.sort((a, b) => a - b);
}

/** Public, non-fork, non-hidden repositories of `user`, most recently pushed first. */
export async function loadRepos(user: string, client: GitHubClient, { hidden = [] }: { hidden?: string[] } = {}): Promise<Repo[]> {
  const raw = list(await client.json(`/users/${user}/repos?per_page=100&type=owner&sort=pushed`), 'repositories').map(parseRepo);
  const hide = new Set(hidden.map((n) => n.toLowerCase()));
  const repos = await Promise.all(
    raw
      .filter((r) => !r.fork && !hide.has(r.name.toLowerCase()))
      .map(async (r): Promise<Repo> => {
        const [times, readme] = await Promise.all([commitTimes(client, user, r.name), client.text(`/repos/${user}/${r.name}/readme`)]);
        const iso = (t: number | undefined) => (t === undefined ? null : new Date(t).toISOString());
        return {
          name: r.name,
          description: r.description?.trim() || null,
          language: r.language,
          topics: r.topics,
          url: r.url,
          pushedAt: r.pushedAt,
          commits: times.length,
          firstCommit: iso(times[0]),
          lastCommit: iso(times.at(-1)),
          wave: binCommits(times),
          lyrics: readmeToLyrics(readme),
        };
      }),
  );
  return repos.sort((a, b) => Date.parse(b.pushedAt) - Date.parse(a.pushedAt));
}

let cache: Promise<Repo[]> | undefined;

/**
 * Loaded once per build / dev-server process. With REPOS_FIXTURE set to a JSON file (see
 * fixtureClient), the build reads recorded responses instead of calling the API.
 */
export function getRepos(): Promise<Repo[]> {
  cache ??= (async () => {
    // Astro exposes non-public variables from the build environment to server code.
    const fixture: string | undefined = import.meta.env.REPOS_FIXTURE;
    const token: string | undefined = import.meta.env.GITHUB_TOKEN;
    let client: GitHubClient;
    if (fixture) {
      const { readFile } = await import('node:fs/promises');
      console.warn(`[github] REPOS_FIXTURE is set: building from ${fixture}, not the GitHub API.`);
      client = fixtureClient(JSON.parse(await readFile(fixture, 'utf8')));
    } else {
      if (!token) console.warn('[github] GITHUB_TOKEN is not set: using the anonymous limit of 60 requests an hour.');
      client = githubClient({ token });
    }
    return loadRepos(GITHUB_USER, client, { hidden: HIDDEN_REPOS });
  })();
  return cache;
}
