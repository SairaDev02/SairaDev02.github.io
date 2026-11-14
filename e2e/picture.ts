// The CD player's picture as a test surface: the scene's grid mapped to CSS px, and a wait
// for its first frame. Until that frame is drawn the canvas ignores presses and previews.
import type { Page } from '@playwright/test';
import { NARROW, WIDE } from '../src/scripts/player/geometry';
import { expect } from './test';

/** The picture's grid (the wide one, or the portrait one on phones) mapped to CSS px. */
export async function picture(page: Page) {
  const canvas = page.locator('[data-player] canvas');
  await canvas.scrollIntoViewIfNeeded();
  const grid = await canvas.evaluate((c: HTMLCanvasElement) => ({ w: c.width, h: c.height }));
  const g = grid.w === NARROW.W ? NARROW : WIDE;
  const box = (await canvas.boundingBox())!;
  const at = (x: number, y: number) => [box.x + (x / g.W) * box.width, box.y + (y / g.H) * box.height] as const;
  return { g, at };
}

/** Waits for the scene: until its first frame is drawn, the canvas ignores presses. */
export async function waitForScene(page: Page) {
  const canvas = page.locator('[data-player] canvas');
  await expect
    .poll(() =>
      canvas.evaluate((c: HTMLCanvasElement) => {
        const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
        const seen = new Set<number>();
        for (let k = 0; k < d.length && seen.size < 3; k += 4 * 97) seen.add((d[k] << 16) | (d[k + 1] << 8) | d[k + 2]);
        return seen.size;
      }),
    )
    .toBeGreaterThan(1);
}
