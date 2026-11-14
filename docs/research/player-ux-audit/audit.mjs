// Throwaway audit of the live player. Run: node docs/research/player-ux-audit/audit.mjs
// Visits https://sairadev02.github.io/ read-only (no login, no forms). Clicking play
// navigates to GitHub after ~2.4 s; states are captured before that.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const URL = 'https://sairadev02.github.io/';
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), 'shots');
const log = [];
const note = (w, k, v) => { log.push({ w, k, v }); console.log(w, k, JSON.stringify(v)); };

const GEO = {
  wide: { W: 512, H: 224, tray: [382, 112, 66], body: [300, 18, 496, 206], area: [14, 12, 286, 212] },
  narrow: { W: 256, H: 320, tray: [96, 81, 58], body: [14, 12, 242, 150], area: [8, 160, 248, 316] },
};
function slots(n, a) {
  const rows = n <= 8 ? Math.min(2, Math.max(1, n)) : 3;
  const cols = Math.ceil(n / rows);
  const cw = (a[2] - a[0]) / cols, ch = (a[3] - a[1]) / rows;
  const r = Math.max(14, Math.min(32, Math.floor(Math.min(cw, ch) / 2) - 8));
  return { r, s: Array.from({ length: n }, (_, i) => { const row = Math.floor(i / cols), col = i % cols; const nudge = (row % 2 ? 1 : -1) * cw * 0.12; return [a[0] + (col + .5) * cw + nudge, a[1] + (row + .5) * ch]; }) };
}

const browser = await chromium.launch();

async function session(width, height, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, reducedMotion: opts.rm ? 'reduce' : 'no-preference', hasTouch: opts.touch, isMobile: opts.touch });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  return { ctx, page, errors };
}
const lcd = (page) => page.evaluate(() => ({ num: document.querySelector('[data-lcd-num]')?.textContent, title: document.querySelector('[data-lcd-title]')?.textContent, flag: document.querySelector('[data-lcd]')?.dataset.flag, dock: document.querySelector('[data-np-title]')?.textContent, kicker: document.querySelector('[data-np-kicker]')?.textContent, playing: document.querySelector('[data-dock]')?.classList.contains('is-playing'), url: location.href }));
async function geom(page) {
  const narrow = await page.evaluate(() => matchMedia('(max-width: 600px)').matches);
  const g = narrow ? GEO.narrow : GEO.wide;
  const n = await page.evaluate(() => JSON.parse(document.getElementById('tracks').textContent).length);
  const box = await page.locator('[data-player] canvas').boundingBox();
  const { r, s } = slots(n, g.area);
  const px = (x, y) => [box.x + (x / g.W) * box.width, box.y + (y / g.H) * box.height];
  return { g, n, box, r, s, px, narrow };
}
const shot = (page, name, full = false) => page.screenshot({ path: path.join(out, name + '.png'), fullPage: full });
const canvasShot = async (page, name) => page.locator('[data-player] .frame').screenshot({ path: path.join(out, name + '.png') });
const sample = (page) => page.evaluate(() => { const c = document.querySelector('[data-player] canvas'); const x = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; const set = new Set(); for (let i = 0; i < x.length; i += 4 * 17) set.add((x[i] << 16) | (x[i + 1] << 8) | x[i + 2]); return { distinct: set.size, w: c.width, h: c.height }; });

async function run(width, height, label, touch = false) {
  const { ctx, page, errors } = await session(width, height, { touch });
  const G = await geom(page);
  note(label, 'geometry', { n: G.n, canvas: G.box, narrow: G.narrow, r: G.r, rscreen: (G.r / G.g.W) * G.box.width });
  await page.locator('[data-player]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await shot(page, `${label}-01-idle`);
  note(label, 'idle', await lcd(page));
  note(label, 'horizontalOverflow', await page.evaluate(() => document.documentElement.scrollWidth - innerWidth));

  const G1 = await geom(page);
  await page.mouse.move(...G1.px(...G1.s[2]));
  await page.waitForTimeout(500);
  await canvasShot(page, `${label}-02-hover-disc`);
  note(label, 'hover disc 2', await lcd(page));
  await page.mouse.move(5, 5);
  await page.waitForTimeout(400);
  note(label, 'after pointer leaves disc', await lcd(page));

  const row = page.locator('[data-track]').nth(3);
  await row.scrollIntoViewIfNeeded();
  await row.hover();
  await page.waitForTimeout(400);
  await shot(page, `${label}-03-hover-row`);
  note(label, 'hover row 3', { ...(await lcd(page)), on: await page.locator('[data-track].on').count() });

  await page.mouse.move(2, 2);
  await row.focus();
  await page.waitForTimeout(300);
  note(label, 'focus row 3', await lcd(page));
  await page.evaluate(() => document.activeElement.blur());
  note(label, 'blur row', await lcd(page));
  await page.locator('[data-player]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);

  if (true) {
    const G2 = await geom(page);
    const from = G2.s[1];
    const to = [from[0] + 40, from[1] + 20];
    await page.mouse.move(...G2.px(...from)); await page.mouse.down();
    await page.mouse.move(...G2.px(...to), { steps: 8 });
    await page.waitForTimeout(300);
    await canvasShot(page, `${label}-04-drag-sky`);
    note(label, 'dragging in sky', await lcd(page));
    await page.mouse.up(); await page.waitForTimeout(600);
    await canvasShot(page, `${label}-05-dropped-sky`);
    note(label, 'dropped in sky', await lcd(page));
    const body = G2.g.body; const bodyPt = [(body[0] + body[2]) / 2 + 45, body[1] + 30];
    await page.mouse.move(...G2.px(...to)); await page.mouse.down();
    await page.mouse.move(...G2.px(...bodyPt), { steps: 10 });
    await page.mouse.up(); await page.waitForTimeout(900);
    await canvasShot(page, `${label}-06-dropped-body`);
    note(label, 'dropped on body', await lcd(page));
    const t = G2.g.tray;
    const from3 = G2.s[3];
    await page.mouse.move(...G2.px(...from3)); await page.mouse.down();
    await page.mouse.move(...G2.px(t[0], t[1]), { steps: 12 });
    await page.waitForTimeout(400);
    await canvasShot(page, `${label}-07-over-tray`);
    note(label, 'over tray (held)', await lcd(page));
    await page.keyboard.press('Escape');
    await page.mouse.move(G2.box.x + G2.box.width + 80, G2.box.y + 5, { steps: 6 });
    await page.waitForTimeout(300);
    note(label, 'over tray then pointer outside canvas (still pressed)', await lcd(page));
    await page.mouse.up(); await page.waitForTimeout(300);
    note(label, 'released outside canvas', await lcd(page));
    await shot(page, `${label}-08-released-outside`);
    await page.waitForTimeout(2800);
    note(label, 'after wait (did it navigate?)', await lcd(page));
    if (!page.url().startsWith(URL)) { await page.goBack(); await page.waitForTimeout(1500); note(label, 'after back', await lcd(page)); await shot(page, `${label}-09-after-back`); }
  }

  const G3 = await geom(page);
  await page.mouse.click(...G3.px(G3.g.body[0] + 20, G3.g.body[3] - 10));
  await page.waitForTimeout(300);
  note(label, 'click on body (no disc)', await lcd(page));

  await shot(page, `${label}-10-dock`);
  const before = await lcd(page);
  await page.locator('[data-np="next"]:visible').first().click();
  await page.waitForTimeout(300);
  note(label, 'next', { before: before.dock, after: (await lcd(page)).dock, lcd: (await lcd(page)).title });
  await page.locator('[data-np="prev"]:visible').first().click();
  await page.locator('[data-np="prev"]:visible').first().click();
  note(label, 'prev x2', (await lcd(page)).dock);
  if (await page.locator('[data-np="shuffle"]:visible').count()) await page.locator('[data-np="shuffle"]:visible').first().click(); else note(label, 'shuffle button hidden in dock', true);
  note(label, 'shuffle aria', await page.locator('[data-np="shuffle"]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-pressed'))));
  note(label, 'LCD after dock cue', await lcd(page));
  if (await page.locator('[data-np="shuffle"]:visible').count()) await page.locator('[data-np="shuffle"]:visible').first().click(); else note(label, 'shuffle button hidden in dock', true);

  await page.locator('[data-np-panel="lyrics"]').click();
  await page.waitForTimeout(600);
  await shot(page, `${label}-11-lyrics-open`);
  note(label, 'lyrics box', await page.evaluate(() => { const p = document.querySelector('[data-panel="lyrics"]').getBoundingClientRect(); const b = document.querySelector('.bar').getBoundingClientRect(); return { panelTop: p.top, panelH: p.height, barH: b.height, vh: innerHeight }; }));
  note(label, 'lyrics lines', await page.evaluate(() => ({ n: document.querySelectorAll('[data-lines] li').length, now: document.querySelector('[data-lines] li.now')?.textContent?.slice(0, 60) })));
  note(label, 'canvas colours with lyrics open', await sample(page));
  await page.locator('[data-player]').scrollIntoViewIfNeeded(); await page.waitForTimeout(500);
  await canvasShot(page, `${label}-12-canvas-lyrics-open`);
  await shot(page, `${label}-13-viewport-lyrics-open-player`);
  note(label, 'canvas vs panel', await page.evaluate(() => { const c = document.querySelector('[data-player] canvas').getBoundingClientRect(); const p = document.querySelector('[data-panel="lyrics"]').getBoundingClientRect(); return { canvasTop: c.top, canvasBottom: c.bottom, panelTop: p.top, vh: innerHeight }; }));
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  note(label, 'Escape closes lyrics; focus', await page.evaluate(() => ({ hidden: document.querySelector('[data-panel="lyrics"]').hidden, active: document.activeElement?.tagName + ':' + (document.activeElement?.getAttribute('aria-label') || document.activeElement?.textContent?.slice(0, 20)) })));
  note(label, 'canvas colours after close', await sample(page));

  await page.locator('[data-np-panel="queue"]').click(); await page.waitForTimeout(400);
  await shot(page, `${label}-14-queue-open`);
  note(label, 'queue items', await page.evaluate(() => [...document.querySelectorAll('[data-q-now] [data-q-name], [data-q-next] [data-q-name]')].slice(0, 4).map((e) => e.textContent)));
  await page.locator('[data-np-panel="lyrics"]').click(); await page.waitForTimeout(300);
  note(label, 'lyrics replaces queue? [lyricsHidden, queueHidden]', await page.evaluate(() => [document.querySelector('[data-panel="lyrics"]').hidden, document.querySelector('[data-panel="queue"]').hidden]));
  await page.locator('[data-np-panel="queue"]').click(); await page.waitForTimeout(300);
  const q2 = page.locator('[data-q-next] [data-q-pick]').nth(1);
  const qname = await q2.locator('[data-q-name]').textContent();
  await q2.click(); await page.waitForTimeout(300);
  note(label, 'queue pick cues', { picked: qname, ...(await lcd(page)) });
  const up = page.locator('[data-q-next] [data-move="-1"]:not(:disabled)').first();
  if (await up.count()) { await up.click(); note(label, 'move up focus kept', await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))); }
  note(label, 'target sizes', await page.evaluate(() => { const f = (s) => { const e = [...document.querySelectorAll(s)].find((e) => e.offsetParent); if (!e) return [s, null]; const r = e.getBoundingClientRect(); return [s, Math.round(r.width), Math.round(r.height)]; }; return ['[data-np="play"]', '[data-np="next"]', '[data-np="prev"]', '[data-np="shuffle"]', '[data-np-panel="lyrics"]', '[data-np-panel="queue"]', '[data-move]', '[data-q-handle]', '[data-q-pick]'].map(f); }));
  await page.keyboard.press('Escape');

  await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
  const order = [];
  for (let k = 0; k < 40; k++) { await page.keyboard.press('Tab'); order.push(await page.evaluate(() => { const e = document.activeElement; return e.tagName + ':' + (e.getAttribute('aria-label') || e.dataset.np || e.dataset.npPanel || e.getAttribute('href') || e.textContent.trim().slice(0, 18)); })); }
  note(label, 'tab order (40)', order);
  note(label, 'canvas tabIndex', await page.evaluate(() => document.querySelector('[data-player] canvas').tabIndex));
  note(label, 'focused element vs dock', await page.evaluate(() => { const e = document.activeElement; const r = e.getBoundingClientRect(); const bar = document.querySelector('.bar')?.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, barTop: bar?.top }; }));
  await shot(page, `${label}-15-tab-focus`);
  const r5 = page.locator('[data-track]').nth(2); await r5.focus(); await page.waitForTimeout(300);
  await shot(page, `${label}-16-row-focus`);
  note(label, 'row focus cue', await lcd(page));
  await page.locator('[data-player]').scrollIntoViewIfNeeded(); await page.waitForTimeout(400);
  await page.locator('[data-np="play"]:visible').first().click();
  for (const [ms, tag] of [[300, 'a'], [900, 'b'], [700, 'c']]) { await page.waitForTimeout(ms); await shot(page, `${label}-17-load-${tag}`); note(label, 'load ' + tag, await lcd(page)); }
  note(label, 'next clicked during load (ignored?)', await page.locator('[data-np="next"]:visible').first().click({ timeout: 1000 }).then(() => 'clicked', () => 'click failed'));
  note(label, 'LCD after next-during-load', await lcd(page));
  await page.waitForTimeout(2500).catch(() => {});
  note(label, 'after load', { url: page.url() });
  if (!page.url().startsWith(URL)) {
    await page.goBack({ waitUntil: 'load' }).catch(() => {}); await page.waitForTimeout(2000);
    await shot(page, `${label}-18-after-back`);
    note(label, 'after back', await lcd(page));
    note(label, 'canvas after back', await sample(page));
  }
  note(label, 'console errors', errors);
  await ctx.close();
}

await run(1280, 800, 'w1280');
await run(800, 900, 'w800');
await run(375, 740, 'w375', true);

{
  const { ctx, page } = await session(1280, 800, { rm: true });
  const G = await geom(page);
  await shot(page, 'rm-01-idle');
  await page.mouse.move(...G.px(...G.s[2])); await page.waitForTimeout(500);
  await canvasShot(page, 'rm-02-hover');
  note('rm', 'hover', await lcd(page));
  await page.mouse.move(5, 5); await page.waitForTimeout(300);
  await page.locator('[data-np-panel="lyrics"]').click(); await page.waitForTimeout(600);
  note('rm', 'lyrics [now, past] counts after 3s', (await page.waitForTimeout(3000), await page.evaluate(() => [document.querySelectorAll('[data-lines] li.now').length, document.querySelectorAll('[data-lines] li.past').length])));
  await shot(page, 'rm-03-lyrics');
  await page.keyboard.press('Escape');
  await page.mouse.move(...G.px(...G.s[3])); await page.mouse.down(); await page.mouse.move(...G.px(G.g.tray[0], G.g.tray[1]), { steps: 10 }); await page.waitForTimeout(300);
  await canvasShot(page, 'rm-04-over-tray'); note('rm', 'over tray', await lcd(page));
  await page.mouse.up(); await page.waitForTimeout(800);
  note('rm', 'after drop in tray', await lcd(page));
  await ctx.close();
}
fs.writeFileSync(path.join(out, '..', 'raw-log.json'), JSON.stringify(log, null, 1));
await browser.close();
