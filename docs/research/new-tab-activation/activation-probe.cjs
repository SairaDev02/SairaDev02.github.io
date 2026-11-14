// Probe: transient user activation timing in Chromium. Run with
//   NODE_PATH=<repo>/node_modules node activation-probe.cjs
// Only Chromium was installed when this ran; Firefox/WebKit were not measured.
//
// page.evaluate() runs with userGesture=true and itself renews activation, so the page
// samples navigator.userActivation.isActive on its own 50 ms timer and the log is read
// only at the end of each scenario.
const { chromium } = require('playwright-core');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SAMPLER = () => {
  window.__log = [];
  window.__ev = [];
  const t0 = performance.now();
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'keydown']) {
    addEventListener(type, () => window.__ev.push([type, Math.round(performance.now() - t0)]), true);
  }
  setInterval(() => window.__log.push([Math.round(performance.now() - t0), navigator.userActivation.isActive]), 50);
};

// Summarise the sample log as spans of isActive === true.
const SPANS = (log) => {
  const spans = [];
  let start = null;
  for (const [t, a] of log) {
    if (a && start === null) start = t;
    if (!a && start !== null) { spans.push([start, t]); start = null; }
  }
  if (start !== null) spans.push([start, log[log.length - 1][0]]);
  return spans;
};

async function scenario(browser, name, run, total) {
  const ctx = await browser.newContext({ hasTouch: true });
  const page = await ctx.newPage();
  await page.setContent('<button style="width:200px;height:100px">x</button>');
  await page.evaluate(SAMPLER);
  await sleep(300);
  await run(page);
  await sleep(total);
  const { log, ev } = await page.evaluate(() => ({ log: window.__log, ev: window.__ev }));
  console.log(name, 'events(ms)=', JSON.stringify(ev), 'activeSpans(ms)=', JSON.stringify(SPANS(log)));
  await page.close();
}

(async () => {
  const browser = await chromium.launch();
  console.log('Chromium', browser.version());
  await scenario(browser, 'A quick click', async (p) => {
    await p.mouse.move(50, 50);
    await p.mouse.down();
    await p.mouse.up();
  }, 7000);
  await scenario(browser, 'B mouse down, hold 3 s, up', async (p) => {
    await p.mouse.move(50, 50);
    await p.mouse.down();
    await sleep(3000);
    await p.mouse.up();
  }, 7000);
  await scenario(browser, 'C Enter keydown', async (p) => {
    await p.keyboard.press('Enter');
  }, 7000);
  await scenario(browser, 'D Escape keydown', async (p) => {
    await p.keyboard.press('Escape');
  }, 7000);
  await scenario(browser, 'E touch tap (pointerup/touchend)', async (p) => {
    await p.touchscreen.tap(50, 50);
  }, 7000);
  await browser.close();
})();
