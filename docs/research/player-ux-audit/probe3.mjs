// Timing probes: click-to-navigation delay by width, and how long the canvas stays flat navy after a breakpoint resize.
import { chromium } from '@playwright/test';
const URL = 'https://sairadev02.github.io/';
const browser = await chromium.launch();
const open = async (w, h, extra = {}) => { const ctx = await browser.newContext({ viewport: { width: w, height: h }, ...extra }); const page = await ctx.newPage(); await page.goto(URL, { waitUntil: 'networkidle' }); await page.waitForTimeout(1500); return { ctx, page }; };

for (const [label, w, h, extra, how] of [['desktop 1280 click play', 1280, 800, {}, 'click'], ['desktop 1280 row click', 1280, 800, {}, 'row'], ['phone 375 tap play', 375, 740, { hasTouch: true, isMobile: true }, 'tap'], ['phone 375 tap row', 375, 740, { hasTouch: true, isMobile: true }, 'taprow'], ['phone 375 tap play, mouse moved first', 375, 740, { hasTouch: true, isMobile: true }, 'tapwoke']]) {
  for (let rep = 0; rep < 2; rep++) {
    const { ctx, page } = await open(w, h, extra);
    const t0 = Date.now();
    const nav = page.waitForURL((u) => !u.href.startsWith(URL), { timeout: 10000, waitUntil: 'commit' }).then(() => Date.now() - t0, () => -1);
    if (how === 'click') await page.locator('[data-np="play"]:visible').first().click();
    if (how === 'tap') await page.locator('[data-np="play"]:visible').first().tap();
    if (how === 'tapwoke') { await page.evaluate(() => window.scrollBy(0, 1)); await page.waitForTimeout(300); await page.locator('[data-np="play"]:visible').first().tap(); }
    if (how === 'row') await page.locator('[data-track]').nth(1).click();
    if (how === 'taprow') await page.locator('[data-track]').nth(1).tap();
    console.log(label, 'rep', rep, 'ms to navigation commit:', await nav);
    await ctx.close();
  }
}

for (const panel of [false, true]) {
  const { ctx, page } = await open(800, 700);
  await page.mouse.move(300, 300); await page.waitForTimeout(300);
  if (panel) await page.locator('[data-np-panel="lyrics"]').click();
  await page.setViewportSize({ width: 500, height: 700 });
  const t0 = Date.now();
  let flatFor = 0, first = null;
  for (let i = 0; i < 100; i++) {
    const flat = await page.evaluate(() => { const c = document.querySelector('[data-player] canvas'); const x = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < x.length; i += 40) if (x[i] === 0x13 && x[i + 1] === 0x23 && x[i + 2] === 0x8a) n++; return n / (x.length / 40) > 0.95; });
    if (flat) flatFor = Date.now() - t0; else if (first === null) first = Date.now() - t0;
    if (!flat && Date.now() - t0 > 300 && first !== null) break;
    await page.waitForTimeout(30);
  }
  console.log('breakpoint resize, lyrics panel', panel, 'last flat-navy sample at ms', flatFor, 'first non-flat at', first);
  await ctx.close();
}
await browser.close();
