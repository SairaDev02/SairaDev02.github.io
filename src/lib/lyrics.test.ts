import { describe, expect, it } from 'vitest';
import { readmeToLyrics } from './lyrics';

const texts = (md: string) => readmeToLyrics(md).map((l) => (l.heading ? `[${l.text}]` : l.text));

describe('readmeToLyrics', () => {
  it('returns no lines for an empty README', () => {
    expect(readmeToLyrics('')).toEqual([]);
  });

  it('drops a leading title heading and turns later headings into tags', () => {
    const md = '# my-repo\n\nA small tool.\n\n## Usage\n\nRun it.';
    expect(texts(md)).toEqual(['A small tool.', '[Usage]', 'Run it.']);
  });

  it('joins wrapped paragraph lines and splits sentences', () => {
    const md = 'First sentence\ncontinues here. Second one!';
    expect(texts(md)).toEqual(['First sentence continues here.', 'Second one!']);
  });

  it('skips fenced code and tables', () => {
    const md = 'Intro.\n\n```sh\nnpm install\n```\n\n| a | b |\n| - | - |\n\nOutro.';
    expect(texts(md)).toEqual(['Intro.', 'Outro.']);
  });

  it('keeps link text and drops images, badges, HTML and emphasis marks', () => {
    const md =
      '[![CI](https://x/badge.svg)](https://x) ![logo](logo.png) <img src="a.png">\n' +
      'Uses **[Bevy](https://bevyengine.org)** and `wgpu`.';
    expect(texts(md)).toEqual(['Uses Bevy and wgpu.']);
  });

  it('makes each list item its own line', () => {
    expect(texts('- one\n- two\n1. three')).toEqual(['one', 'two', 'three']);
  });

  it('breaks long sentences at a clause, else at a word, within the width', () => {
    const clause = 'This sentence has a comfortable first clause, and then it keeps going for a while longer.';
    const words = 'Supercalifragilistic words keep coming without any clause break at all in this line here.';
    for (const line of readmeToLyrics(`${clause}\n\n${words}`)) expect(line.text.length).toBeLessThanOrEqual(58);
    expect(texts(clause)[0]).toBe('This sentence has a comfortable first clause,');
    expect(texts(words).join(' ')).toBe(words);
  });

  it('keeps at most 16 lines', () => {
    const md = Array.from({ length: 30 }, (_, i) => `- item ${i}`).join('\n');
    const lines = readmeToLyrics(md);
    expect(lines).toHaveLength(16);
    expect(lines[15].text).toBe('item 15');
  });
});
