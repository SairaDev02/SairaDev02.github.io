// Exports the link preview card to src/assets/og-card.png: starts the dev server, where
// astro.config.mjs injects /og-card, screenshots only the card, and stops the server.
// Run `npm run og:export` and commit the PNG when the card's design or palette changes.
// The production build reads the committed file; no browser runs during a build.
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createConnection } from 'node:net';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = fileURLToPath(new URL('../src/assets/og-card.png', import.meta.url));
const ASTRO = fileURLToPath(new URL('../node_modules/astro/bin/astro.mjs', import.meta.url));
const PORT = 4331; // not Playwright's 4322, so a running test server is never reused
const CARD_URL = `http://127.0.0.1:${PORT}/og-card`;
const CARD = [1200, 630];
const MAX_BYTES = 300 * 1024;

/** Starts the dev server and resolves once the card route answers; the caller stops it. */
async function startServer() {
  // Fail fast rather than let Vite move to another port and leave us polling this one.
  if (await isListening()) throw new Error(`Port ${PORT} is already in use.`);
  const server = spawn(
    process.execPath,
    // `--ignore-lock`: a dev server killed by a failed run leaves a lock file behind, and
    // the export must not need `astro dev stop` (or kill someone's own server) first.
    [ASTRO, 'dev', '--host', '127.0.0.1', '--port', String(PORT), '--ignore-lock'],
    { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  let log = '';
  server.stdout.on('data', (chunk) => (log += chunk));
  server.stderr.on('data', (chunk) => (log += chunk));

  const deadline = Date.now() + 90_000;
  for (;;) {
    if (server.exitCode !== null) throw new Error(`astro dev exited:\n${log}`);
    try {
      // The card route only; the home page would fetch the GitHub API to render.
      if ((await fetch(CARD_URL)).ok) return server;
    } catch {
      // Not listening yet.
    }
    if (Date.now() > deadline) throw new Error(`astro dev did not start:\n${log}`);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

/** Stops the server and every process it started (esbuild's service, on Windows). */
async function stopServer(server) {
  if (server.exitCode !== null) return;
  const gone = new Promise((resolve) => server.on('exit', resolve));
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' });
    await gone;
  } else {
    server.kill();
    await gone;
  }
  await waitForPortFree();
}

/** Waits until nothing listens on the port, so the next export can bind it again. */
async function waitForPortFree() {
  const deadline = Date.now() + 10_000;
  while (await isListening()) {
    if (Date.now() > deadline) throw new Error(`Port ${PORT} is still in use.`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

/** Whether anything accepts a connection on the export port. */
function isListening() {
  return new Promise((resolve) => {
    const socket = createConnection({ host: '127.0.0.1', port: PORT });
    const done = (listening) => {
      socket.destroy();
      resolve(listening);
    };
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
    socket.setTimeout(1000, () => done(false));
  });
}

/** The card's pixel size, read from the PNG's IHDR chunk, and a guard on the size budget. */
async function checkPng() {
  const png = await readFile(OUT);
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!png.subarray(0, 8).equals(signature) || png.subarray(12, 16).toString('latin1') !== 'IHDR') {
    throw new Error(`${OUT} is not a PNG.`);
  }
  const [width, height] = [png.readUInt32BE(16), png.readUInt32BE(20)];
  if (width !== CARD[0] || height !== CARD[1]) throw new Error(`The card is ${width}x${height}, not ${CARD.join('x')}.`);
  if (png.byteLength >= MAX_BYTES) throw new Error(`The card is ${png.byteLength} bytes, over the ${MAX_BYTES}-byte budget.`);
  return `${width}x${height}, ${png.byteLength} bytes`;
}

const server = await startServer();
try {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1300, height: 900 }, deviceScaleFactor: 1 });
    await page.goto(CARD_URL);
    // The route sets this after painting the sky and loading the card's three faces.
    await page.locator('[data-og-ready="true"]').waitFor();
    await page.locator('#og-card').screenshot({ path: OUT, animations: 'disabled' });
  } finally {
    await browser.close();
  }
  console.log(`og:export wrote src/assets/og-card.png (${await checkPng()})`);
} finally {
  await stopServer(server);
}
