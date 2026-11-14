// Follow-up probes: the "flat navy frame" lead, breakpoint resize, phone play, disc-in-tray holds.
import { chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const URL = 'https://sairadev02.github.io/';
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), 'shots');
const browser = await chromium.launch();
const stats = (page) => page.evaluate(() => { const c = document.querySelector('[data-player] canvas'); const x = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; const m = new Map(); for (let i = 0; i < x.length; i += 4) { const k = (x[i] << 16) | (x[i + 1] << 8) | x[i + 2]; m.set(k, (m.get(k) || 0) + 1); } const top = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k, n]) => [k.toString(16), +(n / (x.length / 4)).toFixed(2)]); return { w: c.width, h: c.height, cssW: c.getBoundingClientRect().width, top, alpha0: x[3] }; });
const ctxOf = async (w, h, extra = {}) => { const ctx = await browser.newContext({ viewport: { width: w, height: h }, ...extra }); const page = await ctx.newPage(); await page.goto(URL, { waitUntil: 'networkidle' }); await page.waitForTimeout(1500); return { ctx, page }; };

// 1. lead: lyrics open at short viewports + resize across the 600px breakpoint
{
  const { ctx, page } = await ctxOf(1280, 520);
  await page.mouse.move(600, 300); await page.waitForTimeout(400);
  console.log('short vp idle', JSON.stringify(await stats(page)));
  await page.locator('[data-np-panel="lyrics"]').click(); await page.waitForTimeout(800);
  console.log('short vp lyrics open', JSON.stringify(await stats(page)), JSON.stringify(await page.evaluate(() => { const p = document.querySelector('[data-panel="lyrics"]').getBoundingClientRect(); const c = document.querySelector('[data-player] canvas').getBoundingClientRect(); return { panelTop: p.top, canvasTop: c.top, canvasBottom: c.bottom, vh: innerHeight }; })));
  await page.screenshot({ path: path.join(out, 'probe-short-lyrics.png') });
  await page.setViewportSize({ width: 500, height: 520 }); await page.waitForTimeout(60);
  console.log('resize->500 at 60ms', JSON.stringify(await stats(page)));
  await page.locator('[data-player] .frame').screenshot({ path: path.join(out, 'probe-resize-60ms.png') });
  await page.waitForTimeout(1500);
  console.log('resize->500 at 1.5s', JSON.stringify(await stats(page)));
  await page.locator('[data-np-panel="lyrics"]').click();
  await page.setViewportSize({ width: 800, height: 520 }); await page.waitForTimeout(60);
  console.log('resize->800 at 60ms', JSON.stringify(await stats(page)));
  await page.locator('[data-player] .frame').screenshot({ path: path.join(out, 'probe-resize-back-60ms.png') });
  await page.waitForTimeout(1500);
  console.log('resize->800 at 1.5s', JSON.stringify(await stats(page)));
  await ctx.close();
}
// 2. phone: play then wait for navigation
{
  const { ctx, page } = await ctxOf(375, 740, { hasTouch: true, isMobile: true });
  await page.locator('[data-np="play"]:visible').first().tap();
  for (let i = 0; i < 8; i++) { await page.waitForTimeout(700); console.log('phone play +', (i + 1) * 0.7, page.url()); }
  await ctx.close();
}
// 3. play with the canvas off screen and with lyrics open (does a load show?)
{
  const { ctx, page } = await ctxOf(1280, 800);
  await page.locator('[data-np-panel="lyrics"]').click();
  await page.locator('[data-np="play"]:visible').first().click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(out, 'probe-play-with-lyrics.png') });
  console.log('play with lyrics open: panel hidden?', await page.evaluate(() => document.querySelector('[data-panel="lyrics"]').hidden));
  await ctx.close();
}
// 4. phone touch: tap a disc (play) and touch scroll over canvas; tray-less cue via tap on row
{
  const { ctx, page } = await ctxOf(375, 740, { hasTouch: true, isMobile: true });
  const box = await page.locator('[data-player] canvas').boundingBox();
  console.log('phone canvas', JSON.stringify(box), 'touch-action', await page.evaluate(() => getComputedStyle(document.querySelector('[data-player] canvas')).touchAction));
  const r = await page.evaluate(() => { const b = document.querySelector('.bar').getBoundingClientRect(); return { barTop: b.top, vh: innerHeight }; });
  console.log('bar', JSON.stringify(r), 'canvas bottom hidden behind dock?', box.y + box.height > r.barTop);
  await page.screenshot({ path: path.join(out, 'probe-phone-first-screen.png') });
  await ctx.close();
}
await browser.close();
