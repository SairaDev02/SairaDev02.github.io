// Keyboard, focus and panel/hover interplay probes (desktop 1280 and phone 375).
import { chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const URL = 'https://sairadev02.github.io/';
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), 'shots');
const browser = await chromium.launch();
const open = async (w, h) => { const ctx = await browser.newContext({ viewport: { width: w, height: h } }); const page = await ctx.newPage(); await page.goto(URL, { waitUntil: 'networkidle' }); await page.waitForTimeout(1200); return { ctx, page }; };

for (const [w, h] of [[1280, 800], [375, 740]]) {
  const { ctx, page } = await open(w, h);
  console.log('---', w);
  // fresh keyboard walk
  const order = [];
  let obscured = [];
  for (let k = 0; k < 24; k++) {
    await page.keyboard.press('Tab');
    const r = await page.evaluate(() => { const e = document.activeElement; const b = e.getBoundingClientRect(); const bar = document.querySelector('.bar').getBoundingClientRect(); const inDock = !!e.closest('[data-dock]'); const label = e.getAttribute('aria-label') || e.textContent.trim().slice(0, 24) || e.tagName; return { label, inDock, top: Math.round(b.top), bottom: Math.round(b.bottom), barTop: Math.round(bar.top), vh: innerHeight, hiddenByDock: !inDock && b.bottom > bar.top && b.top < innerHeight }; });
    order.push(r.label + (r.hiddenByDock ? ' [UNDER DOCK]' : ''));
    if (r.hiddenByDock) { obscured.push(r); if (obscured.length === 1) await page.screenshot({ path: path.join(out, `probe-w${w}-focus-under-dock.png`) }); }
  }
  console.log('tab order', JSON.stringify(order));
  console.log('focus obscured by dock', JSON.stringify(obscured.slice(0, 3)));
  await ctx.close();
}

{
  const { ctx, page } = await open(1280, 800);
  // hover re-renders the open Lyrics panel
  await page.locator('[data-np-panel="lyrics"]').click();
  await page.waitForTimeout(3000); // let lyric highlight advance
  const state = () => page.evaluate(() => ({ title: document.querySelector('[data-lyrics-title]').textContent, now: [...document.querySelectorAll('[data-lines] li:not(.tag)')].findIndex((l) => l.classList.contains('now')), scroll: document.querySelector('[data-panel="lyrics"]').scrollTop }));
  console.log('lyrics before hover', JSON.stringify(await state()));
  const box = await page.locator('[data-player] canvas').boundingBox();
  // disc 0 centre in wide grid: (150, 112) of 512x224
  await page.mouse.move(box.x + (87 / 512) * box.width, box.y + (62 / 224) * box.height, { steps: 4 });
  await page.waitForTimeout(300);
  console.log('lyrics after hovering a visible disc above panel', JSON.stringify(await state()));
  await page.mouse.move(5, 5); await page.waitForTimeout(300);
  console.log('lyrics after pointer leaves', JSON.stringify(await state()));
  await page.screenshot({ path: path.join(out, 'probe-hover-while-lyrics.png') });
  await page.keyboard.press('Escape');

  // queue: move up until first, focus
  await page.locator('[data-np-panel="queue"]').click();
  const down = page.locator('[data-q-next] [data-move="-1"]:not(:disabled)').first();
  await down.focus(); await page.keyboard.press('Enter');
  console.log('after Enter on first-enabled up (item moves to top) active =', JSON.stringify(await page.evaluate(() => document.activeElement.tagName + ':' + (document.activeElement.getAttribute('aria-label') || ''))));
  // Escape mid-drag
  await page.keyboard.press('Escape');
  const b2 = await page.locator('[data-player] canvas').boundingBox();
  await page.mouse.move(b2.x + (150 / 512) * b2.width, b2.y + (62 / 224) * b2.height);
  await page.mouse.down(); await page.mouse.move(b2.x + (382 / 512) * b2.width, b2.y + (112 / 224) * b2.height, { steps: 8 });
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  console.log('Escape mid-drag over tray, LCD:', await page.locator('[data-lcd-title]').textContent());
  await page.mouse.move(b2.x + (150 / 512) * b2.width, b2.y + (62 / 224) * b2.height, { steps: 8 }); // drag back out
  console.log('dragged back out of tray, LCD:', await page.locator('[data-lcd-title]').textContent());
  await page.mouse.up();
  // LCD live region
  console.log('LCD aria-live:', await page.evaluate(() => document.querySelector('[data-lcd] .main').getAttribute('aria-live')), '| dock title live?', await page.evaluate(() => !!document.querySelector('[data-np-title]').closest('[aria-live]')), '| dock panel buttons expanded:', await page.evaluate(() => [...document.querySelectorAll('[data-np-panel]')].map((b) => b.getAttribute('aria-expanded'))));
  // playing state announce: is "Now playing"/load announced?
  console.log('play button label:', await page.locator('[data-np="play"]:visible').first().getAttribute('aria-label'), '| aria-disabled during load?');
  await ctx.close();
}
await browser.close();
