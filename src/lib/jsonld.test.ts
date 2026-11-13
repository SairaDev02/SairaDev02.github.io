import { describe, expect, it } from 'vitest';
import type { SiteMetadata } from './site';
import { profileGraph } from './jsonld';

const meta: SiteMetadata = {
  name: 'SairaDev02',
  title: 'SairaDev02 · public repositories',
  description: 'Public repositories of SairaDev02, played as a playlist: names, descriptions, languages and commit history.',
  url: 'https://sairadev02.github.io/',
  avatar: 'https://avatars.githubusercontent.com/u/96645098',
  profiles: {
    github: 'https://github.com/SairaDev02',
    crates: 'https://crates.io/users/SairaDev02',
  },
};

const dateModified = '2026-11-13T22:11:01.000Z';
const graph = profileGraph(meta, dateModified);

type Node = Record<string, unknown>;
const nodes = graph['@graph'] as Node[];
const node = (type: string): Node => {
  const found = nodes.find((n) => n['@type'] === type);
  if (!found) throw new Error(`the graph has no ${type} node`);
  return found;
};

describe('profileGraph', () => {
  it('returns one schema.org graph of WebSite, ProfilePage and Person', () => {
    expect(graph['@context']).toBe('https://schema.org');
    expect(nodes.map((n) => n['@type'])).toEqual(['WebSite', 'ProfilePage', 'Person']);
  });

  it('links the three nodes by @id, each under the site URL', () => {
    const website = node('WebSite');
    const page = node('ProfilePage');
    const person = node('Person');
    for (const id of [website['@id'], page['@id'], person['@id']]) {
      expect(id).toMatch(/^https:\/\/sairadev02\.github\.io\/#/);
    }
    expect(new Set([website['@id'], page['@id'], person['@id']]).size).toBe(3);
    expect(page.mainEntity).toEqual({ '@id': person['@id'] });
    expect(page.isPartOf).toEqual({ '@id': website['@id'] });
  });

  it('names the site and its host', () => {
    expect(node('WebSite')).toMatchObject({ name: 'SairaDev02', alternateName: 'sairadev02.github.io', url: meta.url });
  });

  it('describes the profile page with the head strings and the site-modified date', () => {
    expect(node('ProfilePage')).toMatchObject({
      url: meta.url,
      headline: meta.title,
      description: meta.description,
      dateModified,
    });
  });

  it('gives a handle-only Person with both profiles and the avatar', () => {
    expect(node('Person')).toMatchObject({
      name: 'SairaDev02',
      url: meta.url,
      sameAs: ['https://github.com/SairaDev02', 'https://crates.io/users/SairaDev02'],
      image: 'https://avatars.githubusercontent.com/u/96645098',
    });
  });
});
