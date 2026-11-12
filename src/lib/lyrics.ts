// A repository's README condensed into short "lyric" lines for the now-playing dock.
// Headings become section tags; code, tables, images and badges are dropped.

export interface Lyric {
  text: string;
  heading: boolean;
}

export const LYRIC_LINES = 16;
export const LYRIC_WIDTH = 58;

/** Plain text from inline markdown: drop HTML, badges and images, keep link text, strip marks. */
function inline(md: string): string {
  return md
    .replace(/<[^>]+>/g, '')
    .replace(/\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)/g, '') // linked badges
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // links -> text
    .replace(/[*_`~]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Clause breaks, preferred over word breaks. The punctuation stays on the first line.
const CLAUSES = [', ', '; ', ': ', ' — '];

/** Break a paragraph into lines no longer than `width`: sentences, then clauses, then words. */
function toLines(text: string, width: number): string[] {
  const out: string[] = [];
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    let rest = sentence.trim();
    while (rest.length > width) {
      const window = rest.slice(0, width + 1);
      // End of the last clause that fits, if it leaves a first line of reasonable length.
      const clause = Math.max(...CLAUSES.map((sep) => window.lastIndexOf(sep) + sep.length - 1));
      const cut = clause > width / 3 ? clause : window.lastIndexOf(' ');
      if (cut <= 0) break; // a single word longer than the width: leave it whole
      out.push(rest.slice(0, cut).trim());
      rest = rest.slice(cut).trim();
    }
    if (rest) out.push(rest);
  }
  return out;
}

export function readmeToLyrics(md: string, maxLines = LYRIC_LINES, width = LYRIC_WIDTH): Lyric[] {
  const lyrics: Lyric[] = [];
  let para: string[] = [];
  let fenced = false;
  const flush = () => {
    const text = inline(para.join(' '));
    para = [];
    if (text) for (const line of toLines(text, width)) lyrics.push({ text: line, heading: false });
  };
  for (const raw of md.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(raw)) {
      fenced = !fenced;
      flush();
      continue;
    }
    if (fenced || /^\s*\|/.test(raw)) continue; // code blocks, tables
    const heading = raw.match(/^#{1,6}\s+(.*)/);
    const item = raw.match(/^\s*(?:[-*+]|\d+\.)\s+(.*)/);
    if (heading) {
      flush();
      const text = inline(heading[1]);
      if (text) lyrics.push({ text, heading: true });
    } else if (item) {
      flush();
      para.push(item[1]);
    } else if (!raw.trim()) flush();
    else para.push(raw.trim());
    // One extra line of slack: the leading title heading is dropped below.
    if (lyrics.length > maxLines) break;
  }
  flush();
  // The README's own title duplicates the repository name.
  if (lyrics[0]?.heading) lyrics.shift();
  return lyrics.slice(0, maxLines);
}
