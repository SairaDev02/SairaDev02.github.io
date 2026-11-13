// The home page's tracks JSON, for the `<script type="application/json" id="tracks">`
// element the client script reads. Repository data comes from outside the site, so a
// description containing "</script>" must not be able to close the element early: `<` is
// escaped as `\u003c`, which JSON.parse turns back into `<`.
import type { Track } from './format';

/** The script element's JSON text for these tracks: `JSON.stringify`, with `<` escaped. */
export const serializeTracks = (tracks: readonly Track[]): string =>
  JSON.stringify(tracks).replaceAll('<', '\\u003c');
