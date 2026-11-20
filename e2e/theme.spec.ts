// The theme setting: System / Light / Dark, resolved before first paint, kept in
// localStorage under `theme`, and followed live while on System.
import type { Page } from '@playwright/test';
import { expect, test } from './test';

const themeOf = (page: Page) => page.evaluate(() => document.documentElement.dataset.theme);
const stored = (page: Page) => page.evaluate(() => localStorage.getItem('theme'));
const group = (page: Page) => page.getByRole('group', { name: 'Colour theme' });

test.describe('first load follows the device', () => {
  for (const scheme of ['light', 'dark'] as const) {
    test(`${scheme} device scheme`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/');
      expect(await themeOf(page)).toBe(scheme);
      await expect(group(page).getByRole('radio', { name: 'System' })).toBeChecked();
    });
  }

  test('the attribute is set by DOMContentLoaded, before first paint', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => {
        (window as unknown as { themeAtDcl: string | undefined }).themeAtDcl = document.documentElement.dataset.theme;
      });
    });
    await page.goto('/');
    expect(await page.evaluate(() => (window as unknown as { themeAtDcl: string }).themeAtDcl)).toBe('dark');
  });
});

test('a device scheme change is followed while on System', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  expect(await themeOf(page)).toBe('light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(() => themeOf(page)).toBe('dark');
});

test('a device scheme change is ignored once a theme is chosen', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await group(page).getByRole('radio', { name: 'Light' }).check({ force: true });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.waitForTimeout(500);
  expect(await themeOf(page)).toBe('light');
});

test('Light and Dark override the device and survive a reload; System clears the key', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');

  await group(page).getByRole('radio', { name: 'Dark' }).check({ force: true });
  await expect.poll(() => themeOf(page)).toBe('dark');
  expect(await stored(page)).toBe('dark');
  await page.reload();
  expect(await themeOf(page)).toBe('dark');
  await expect(group(page).getByRole('radio', { name: 'Dark' })).toBeChecked();

  await page.emulateMedia({ colorScheme: 'dark' });
  await group(page).getByRole('radio', { name: 'Light' }).check({ force: true });
  await expect.poll(() => themeOf(page)).toBe('light');
  expect(await stored(page)).toBe('light');
  await page.reload();
  expect(await themeOf(page)).toBe('light');

  await group(page).getByRole('radio', { name: 'System' }).check({ force: true });
  expect(await stored(page)).toBeNull();
  await expect.poll(() => themeOf(page)).toBe('dark');
});

test('unavailable storage falls back to System silently', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('denied', 'SecurityError');
      },
    });
  });
  await page.goto('/');
  expect(await themeOf(page)).toBe('dark');
  await group(page).getByRole('radio', { name: 'Light' }).check({ force: true });
  await expect.poll(() => themeOf(page)).toBe('light');
});

test('the setting is a labelled group of three radios, each at least 24 by 24', async ({ page }) => {
  await page.goto('/');
  await expect(group(page).getByRole('radio')).toHaveCount(3);
  for (const name of ['System', 'Light', 'Dark']) {
    const box = await group(page).getByText(name, { exact: true }).boundingBox();
    expect(box, name).not.toBeNull();
    expect(box!.width, `${name} width`).toBeGreaterThanOrEqual(24);
    expect(box!.height, `${name} height`).toBeGreaterThanOrEqual(24);
  }
});

test('the module notifies subscribers with the resolved theme', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await page.evaluate(() => {
    const seen: string[] = [];
    (window as unknown as { seen: string[] }).seen = seen;
    document.addEventListener('themechange', (e) => seen.push((e as CustomEvent<{ theme: string }>).detail.theme));
  });
  await group(page).getByRole('radio', { name: 'Dark' }).check({ force: true });
  await expect.poll(() => page.evaluate(() => (window as unknown as { seen: string[] }).seen)).toEqual(['dark']);
});

test.describe('policy in both themes', () => {
  for (const scheme of ['light', 'dark'] as const) {
    for (const path of ['/', '/no-such-track']) {
      test(`${path} in ${scheme}: no CSP violation`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await page.addInitScript(() => {
          const log: string[] = [];
          (window as unknown as { cspLog: string[] }).cspLog = log;
          document.addEventListener('securitypolicyviolation', (e) => log.push(`${e.effectiveDirective} ${e.blockedURI}`));
        });
        await page.goto(path);
        expect(await themeOf(page)).toBe(scheme);
        await group(page).getByRole('radio', { name: scheme === 'light' ? 'Dark' : 'Light' }).check({ force: true });
        expect(await page.evaluate(() => (window as unknown as { cspLog: string[] }).cspLog)).toEqual([]);
      });
    }
  }
});
