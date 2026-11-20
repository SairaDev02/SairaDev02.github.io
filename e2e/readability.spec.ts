// Readability gates beyond axe: no informative text under 12 px, every text pairing at
// least 4.5:1 against the background it actually sits on (the previewed row's tint, the
// card and the tags included), state marks at least 3:1, and forced colours keeping the
// focus indicator and the selected theme option visible.
import type { Page } from '@playwright/test';
import { expect, test } from './test';

/**
 * Every element carrying text of its own, with its size and the contrast of its colour
 * against its real background: the ancestors' backgrounds composited over the stock colour.
 * Computed in the page, so a tint (color-mix) or a translucent tag resolves as painted.
 */
const measureText = (page: Page) =>
  page.evaluate(() => {
    const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
    type Rgba = [number, number, number, number];
    /** Any CSS colour as 0–255 channels plus alpha 0–1, by painting one pixel. */
    const rgba = (css: string): Rgba => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = '#000';
      ctx.fillStyle = css;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
      return [r, g, b, a / 255];
    };
    const over = (top: Rgba, base: Rgba): Rgba => {
      const a = top[3] + base[3] * (1 - top[3]);
      const mix = (i: number) => (top[i] * top[3] + base[i] * base[3] * (1 - top[3])) / (a || 1);
      return [mix(0), mix(1), mix(2), a];
    };
    const stock = rgba(getComputedStyle(document.documentElement).getPropertyValue('--bg'));
    const background = (el: Element): Rgba => {
      const layers: Rgba[] = [];
      for (let e: Element | null = el; e; e = e.parentElement) layers.push(rgba(getComputedStyle(e).backgroundColor));
      return layers.reduceRight((base, layer) => over(layer, base), stock);
    };
    const luminance = ([r, g, b]: Rgba) => {
      const [R, G, B] = [r, g, b].map((c) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * R + 0.7152 * G + 0.0722 * B;
    };
    const found: { text: string; size: number; ratio: number }[] = [];
    for (const el of document.body.querySelectorAll('*')) {
      const text = [...el.childNodes]
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent?.trim() ?? '')
        .join(' ')
        .trim();
      if (!text || el.closest('script, style, noscript')) continue;
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      // Visually hidden text (the legend, the status words) is not drawn.
      if (rect.width <= 1 || rect.height <= 1 || style.visibility === 'hidden' || style.display === 'none') continue;
      const bg = background(el);
      const fg = over(rgba(style.color), bg);
      const [hi, lo] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
      found.push({ text: text.slice(0, 40), size: parseFloat(style.fontSize), ratio: (hi + 0.05) / (lo + 0.05) });
    }
    return found;
  });

const small = (found: Awaited<ReturnType<typeof measureText>>) =>
  found.filter((t) => t.size < 12).map((t) => `${t.text} ${t.size}px`);
const faint = (found: Awaited<ReturnType<typeof measureText>>) =>
  found.filter((t) => t.ratio < 4.5).map((t) => `${t.text} ${t.ratio.toFixed(2)}:1`);

test.describe('type size and contrast', () => {
  for (const scheme of ['light', 'dark'] as const) {
    test(`home text is at least 12 px and 4.5:1 in ${scheme}, with a row previewed`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/');
      await page.locator('[data-asset="0"]').focus();
      // The card and the tags are built by the scene's script after load.
      await expect(page.locator('[data-sensor-card]')).toBeVisible();
      await expect(page.locator('[data-sensor-tag="A-01"]')).toBeVisible();
      const found = await measureText(page);
      expect(found.length).toBeGreaterThan(20);
      expect(small(found)).toEqual([]);
      expect(faint(found)).toEqual([]);
    });

    test(`404 text is at least 12 px and 4.5:1 in ${scheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/no-such-track');
      const found = await measureText(page);
      expect(found.length).toBeGreaterThan(3);
      expect(small(found)).toEqual([]);
      expect(faint(found)).toEqual([]);
    });

    test(`the marks that carry state are at least 3:1 against the stock in ${scheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/');
      await expect(page.locator('[data-sensor-tag="A-01"]')).toBeVisible();
      const ratios = await page.evaluate(() => {
        const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
        const lum = (css: string) => {
          ctx.fillStyle = css;
          ctx.fillRect(0, 0, 1, 1);
          const data = ctx.getImageData(0, 0, 1, 1).data;
          return [0, 1, 2]
            .map((i) => data[i] / 255)
            .map((s) => (s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4))
            .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
        };
        const stock = lum(getComputedStyle(document.documentElement).getPropertyValue('--bg'));
        const against = (css: string) => (Math.max(lum(css), stock) + 0.05) / (Math.min(lum(css), stock) + 0.05);
        const style = (selector: string) => getComputedStyle(document.querySelector(selector)!);
        return {
          'focus ring (magenta)': against(getComputedStyle(document.documentElement).getPropertyValue('--ink-m')),
          'live dot': against(style('.chip .dot').backgroundColor),
          'live chip outline': against(style('.chip').borderTopColor),
          'live tag outline': against(style('[data-sensor-tag].is-live').borderTopColor),
        };
      });
      for (const [mark, ratio] of Object.entries(ratios)) expect(ratio, mark).toBeGreaterThanOrEqual(3);
    });
  }
});

test.describe('forced colours', () => {
  test.use({ colorScheme: 'light', forcedColors: 'active' });

  test('a focused row keeps a 2 px solid outline', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-asset="1"]').focus();
    const outline = await page.locator('[data-asset="1"]').evaluate((el) => {
      const s = getComputedStyle(el);
      return { style: s.outlineStyle, width: parseFloat(s.outlineWidth), color: s.outlineColor };
    });
    expect(outline.style).toBe('solid');
    expect(outline.width).toBeGreaterThanOrEqual(2);
    expect(outline.color).not.toBe('rgba(0, 0, 0, 0)');
  });

  test('the selected theme option is outlined and the others are not', async ({ page }) => {
    await page.goto('/');
    const options = page.getByRole('group', { name: 'Colour theme' }).locator('label span');
    await expect(options).toHaveCount(3);
    // System is checked on a first visit.
    expect(await options.evaluateAll((all) => all.map((s) => getComputedStyle(s).outlineStyle))).toEqual([
      'solid',
      'none',
      'none',
    ]);
  });

  test('a theme option focused by keyboard shows a ring', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('group', { name: 'Colour theme' }).getByRole('radio', { name: 'System' }).focus();
    await page.keyboard.press('ArrowRight');
    const light = page.getByRole('group', { name: 'Colour theme' }).getByRole('radio', { name: 'Light' });
    await expect(light).toBeFocused();
    expect(await light.evaluate((input) => getComputedStyle(input.nextElementSibling!).outlineStyle)).toBe('solid');
  });
});
