import { chromium } from '@playwright/test';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1300, height: 900 } });
await p.goto('http://localhost:4331/prototype-og?variant=A');
await p.waitForTimeout(1500);
await p.locator('[data-host="full"] .card').screenshot({ path: process.argv[2] });
await b.close();
