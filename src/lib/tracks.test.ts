import { describe, expect, it } from 'vitest';
import type { Track } from './format';
import { serializeTracks } from './tracks';

const track = (over: Partial<Track>): Track => ({
  name: 'tool',
  description: null,
  language: null,
  topics: [],
  url: 'https://github.com/SairaDev02/tool',
  pushedAt: '2026-11-12T10:00:00Z',
  commits: 3,
  firstCommit: null,
  lastCommit: null,
  lyrics: [],
  ...over,
});

describe('serializeTracks', () => {
  it('keeps a description containing </script> from ending the script element', () => {
    const description = 'Breaks out </script><img src=x onerror="alert(1)">';
    const json = serializeTracks([track({ description })]);
    // The literal end tag is what would close the script element early, so it must not
    // appear in the serialized text at all.
    expect(json).not.toContain('</script');
    expect(json).toContain('\\u003c');
    expect(JSON.parse(json)[0].description).toBe(description);
  });

  it('parses back to the same tracks', () => {
    const tracks = [
      track({ name: 'tidepool', description: 'Tide tables as drones. <audio> & more', language: 'Rust', commits: 5 }),
      track({ name: 'quiet-notes' }),
    ];
    expect(JSON.parse(serializeTracks(tracks))).toEqual(tracks);
  });
});
