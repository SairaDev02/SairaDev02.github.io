// The home page's schema.org graph: the site, its profile page and the handle's Person,
// linked by @id so a parser can join them into one entity. Pure, so the shape is unit-tested.
import type { SiteMetadata } from './site';

export function profileGraph(meta: SiteMetadata, dateModified: string) {
  const website = `${meta.url}#website`;
  const page = `${meta.url}#profilepage`;
  const person = `${meta.url}#person`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': website,
        url: meta.url,
        name: meta.name,
        alternateName: new URL(meta.url).host,
      },
      {
        '@type': 'ProfilePage',
        '@id': page,
        url: meta.url,
        headline: meta.title,
        description: meta.description,
        dateModified,
        mainEntity: { '@id': person },
        isPartOf: { '@id': website },
      },
      {
        '@type': 'Person',
        '@id': person,
        url: meta.url,
        name: meta.name,
        image: meta.avatar,
        sameAs: [meta.profiles.github, meta.profiles.crates],
      },
    ],
  };
}
