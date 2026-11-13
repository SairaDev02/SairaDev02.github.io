import { describe, expect, it } from 'vitest';
import { READY_SECTIONS, SECTIONS } from './sections';

describe('SECTIONS', () => {
  it('marks Projects and Contact ready, and Writing and Resume not', () => {
    const ready = Object.fromEntries(SECTIONS.map((s) => [s.label, s.ready]));
    expect(ready).toEqual({ Projects: true, Contact: true, Writing: false, Resume: false });
  });
});

describe('READY_SECTIONS', () => {
  it('returns only the ready sections, in site order', () => {
    expect(READY_SECTIONS.map((s) => s.label)).toEqual(['Projects', 'Contact']);
  });
});
