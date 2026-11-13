import { describe, expect, it } from 'vitest';
import type { Repo } from './github';
import { llmsTxt } from './llms';

const repo = (over: Partial<Repo>): Repo => ({
  name: 'tool',
  description: null,
  language: null,
  topics: [],
  url: 'https://github.com/SairaDev02/tool',
  pushedAt: '2026-11-12T10:00:00Z',
  commits: 3,
  firstCommit: null,
  lastCommit: null,
  wave: [],
  lyrics: [],
  ...over,
});

describe('llmsTxt', () => {
  const site = 'https://sairadev02.github.io/';

  it('follows the llms.txt layout: title, summary, then a linked repository list', () => {
    const text = llmsTxt('SairaDev02', site, [
      repo({ name: 'alpha', description: 'Does a thing.', language: 'Rust', url: 'https://github.com/SairaDev02/alpha' }),
      repo({ name: 'beta', url: 'https://github.com/SairaDev02/beta' }),
    ]);
    const lines = text.split('\n');
    expect(lines[0]).toBe('# SairaDev02');
    expect(lines[2]).toMatch(/^> /);
    expect(text).toContain('## Repositories\n\n- [alpha](https://github.com/SairaDev02/alpha): Does a thing. (Rust)\n- [beta](https://github.com/SairaDev02/beta)\n');
    expect(text).toContain('[Home page](https://sairadev02.github.io/)');
    expect(text.endsWith('\n')).toBe(true);
  });

  it('keeps each entry on one line when a description spans several', () => {
    const text = llmsTxt('u', site, [repo({ description: 'Line one.\nLine  two.' })]);
    expect(text).toContain('): Line one. Line two.\n');
  });

  it('lists the crates.io profile under Optional, next to the GitHub profile', () => {
    const text = llmsTxt('SairaDev02', site, []);
    const optional = text.slice(text.indexOf('## Optional'));
    expect(optional).toContain(
      '- [GitHub profile](https://github.com/SairaDev02)\n- [crates.io profile](https://crates.io/users/SairaDev02)\n',
    );
  });
});
