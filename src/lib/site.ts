// The site's identity strings: one source for the head tags, the JSON-LD graph and the
// Contact links. The URL comes from `site` in astro.config.mjs; the handle comes from the
// GitHub user, so the site never publishes more than the handle.
import { GITHUB_USER } from './github';

const configuredSite = import.meta.env.SITE;
if (!configuredSite) throw new Error('The site metadata needs `site` in astro.config.mjs.');

/** The home page URL, absolute and with the trailing slash (the canonical form). */
const homeUrl = configuredSite.endsWith('/') ? configuredSite : `${configuredSite}/`;

export interface SiteMetadata {
  /** The site name, also the Person name: the handle only. */
  name: string;
  /** The page title and og:title. */
  title: string;
  /** The meta description and og:description. */
  description: string;
  /** The absolute home page URL. */
  url: string;
  /** The Person's avatar: the GitHub user's portrait, the JSON-LD `image`. */
  avatar: string;
  /** The profile pages that carry the same identity, also the Person's sameAs list. */
  profiles: { github: string; crates: string };
}

export const SITE: SiteMetadata = {
  name: GITHUB_USER,
  title: `${GITHUB_USER} · public repositories`,
  description: `Public repositories of ${GITHUB_USER}, played as a playlist: names, descriptions, languages and commit history.`,
  url: homeUrl,
  // GitHub serves the user's portrait at an id-based URL; there is no handle-based one.
  avatar: 'https://avatars.githubusercontent.com/u/96645098',
  profiles: {
    github: `https://github.com/${GITHUB_USER}`,
    crates: `https://crates.io/users/${GITHUB_USER}`,
  },
};

/**
 * The home page's link preview image (src/assets/og-card.png): the wordmark on a frosted
 * panel over the site's dithered sky and its sun. It describes the card and its text, so
 * someone who sees only the alt text knows what the unfurled link shows.
 */
export const OG_IMAGE_ALT = `${GITHUB_USER} in large type on a frosted panel over a pixel-dithered blue cloud sky with a small yellow sun`;
