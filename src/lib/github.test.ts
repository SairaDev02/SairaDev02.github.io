import { describe, expect, it, vi } from 'vitest';
import { githubClient, loadRepos, type GitHubClient } from './github';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('githubClient', () => {
  it('sends the token and retries transient failures (422 "taking too long", 5xx)', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(json({ message: 'taking too long' }, 422))
      .mockResolvedValueOnce(json({}, 502))
      .mockResolvedValueOnce(json([{ ok: 1 }]));
    const client = githubClient({ token: 't0k', fetch, sleep: async () => {} });
    await expect(client.json('/users/x/repos')).resolves.toEqual([{ ok: 1 }]);
    expect(fetch).toHaveBeenCalledTimes(3);
    const init = fetch.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer t0k');
  });

  it('fails the build after three transient failures, and at once on other errors', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => json({}, 503));
    const client = githubClient({ fetch, sleep: async () => {} });
    await expect(client.json('/a')).rejects.toThrow(/503 \/a/);
    expect(fetch).toHaveBeenCalledTimes(3);

    const forbidden = vi.fn<typeof globalThis.fetch>(async () => json({ message: 'rate limit' }, 403));
    await expect(githubClient({ fetch: forbidden, sleep: async () => {} }).json('/b')).rejects.toThrow(/403/);
    expect(forbidden).toHaveBeenCalledTimes(1);
  });

  it('reads an empty repository (409) as no commits and a missing README (404) as empty', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async (url) =>
      String(url).endsWith('/readme') ? new Response('Not Found', { status: 404 }) : json({}, 409),
    );
    const client = githubClient({ fetch, sleep: async () => {} });
    await expect(client.json('/repos/x/y/commits')).resolves.toEqual([]);
    await expect(client.text('/repos/x/y/readme')).resolves.toBe('');
  });
});

describe('loadRepos', () => {
  const raw = (name: string, pushed: string, extra: object = {}) => ({
    name,
    description: ` ${name} desc `,
    language: 'Rust',
    topics: ['cli'],
    html_url: `https://github.com/u/${name}`,
    pushed_at: pushed,
    fork: false,
    ...extra,
  });
  const commit = (date: string) => ({ commit: { author: { date }, committer: { date } } });

  function fakeClient(routes: Record<string, unknown>): GitHubClient {
    return {
      json: async (path) => {
        if (!(path in routes)) throw new Error(`unexpected ${path}`);
        return routes[path];
      },
      text: async (path) => String(routes[path] ?? ''),
    };
  }

  it('lists public non-fork repos, newest push first, with commits, waveform and lyrics', async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => commit(new Date(Date.UTC(2025, 0, 1 + i)).toISOString()));
    const client = fakeClient({
      '/users/u/repos?per_page=100&type=owner&sort=pushed': [
        raw('old', '2024-01-01T00:00:00Z'),
        raw('forked', '2026-01-01T00:00:00Z', { fork: true }),
        raw('new', '2025-06-01T00:00:00Z', { description: null, language: null }),
      ],
      '/repos/u/old/commits?per_page=100&page=1': [commit('2023-01-01T00:00:00Z'), commit('2023-12-31T00:00:00Z')],
      '/repos/u/new/commits?per_page=100&page=1': page1,
      '/repos/u/new/commits?per_page=100&page=2': [commit('2025-06-01T00:00:00Z')],
      '/repos/u/old/readme': '# old\n\nHello there.',
    });
    const repos = await loadRepos('u', client);
    expect(repos.map((r) => r.name)).toEqual(['new', 'old']);
    const [neu, old] = repos;
    expect(neu).toMatchObject({ description: null, language: null, commits: 101, lyrics: [] });
    expect(neu.firstCommit).toBe('2025-01-01T00:00:00.000Z');
    expect(neu.lastCommit).toBe('2025-06-01T00:00:00.000Z');
    expect(neu.wave.reduce((a, b) => a + b, 0)).toBe(101);
    expect(old).toMatchObject({
      description: 'old desc',
      language: 'Rust',
      topics: ['cli'],
      url: 'https://github.com/u/old',
      pushedAt: '2024-01-01T00:00:00Z',
      commits: 2,
      lyrics: [{ text: 'Hello there.', heading: false }],
    });
  });

  it('rejects an unexpected API shape at the boundary', async () => {
    const client = fakeClient({ '/users/u/repos?per_page=100&type=owner&sort=pushed': [{ name: 42 }] });
    await expect(loadRepos('u', client)).rejects.toThrow(/name/);
  });
});
