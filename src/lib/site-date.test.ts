import { describe, expect, it } from 'vitest';
import { readSiteCommitDate, siteModifiedDate } from './site-date';

describe('siteModifiedDate', () => {
  it('takes the repository push when it is newer than the site commit', () => {
    expect(siteModifiedDate('2026-10-20T17:45:00Z', '2026-10-01T08:00:00+02:00')).toBe('2026-10-20T17:45:00.000Z');
  });

  it('takes the site commit when it is newer than the repository push', () => {
    expect(siteModifiedDate('2026-10-20T17:45:00Z', '2026-11-13T22:11:01+00:00')).toBe('2026-11-13T22:11:01.000Z');
  });
});

describe('readSiteCommitDate', () => {
  it('returns the committer date of the last commit that touched site files', () => {
    const calls: string[][] = [];
    const date = readSiteCommitDate((args) => {
      calls.push(args);
      return '2026-11-13T22:11:01+00:00\n';
    });
    expect(date).toBe('2026-11-13T22:11:01+00:00');
    expect(calls).toEqual([['log', '-1', '--format=%cI', '--', 'src', 'public', 'astro.config.mjs']]);
  });

  it('throws when git returns no date, so the build fails', () => {
    expect(() => readSiteCommitDate(() => '\n')).toThrow(/no commit date/);
  });
});
