import { expect, test } from './test';

test('/llms.txt indexes the same repositories as the home page', async ({ request }) => {
  const res = await request.get('/llms.txt');
  expect(res.ok()).toBe(true);
  const body = await res.text();
  expect(body).toMatch(/^# SairaDev02\n/);
  expect(body).toContain('- [tidepool](https://github.com/SairaDev02/tidepool): Command-line synthesiser for tide charts. (Rust)');
  expect(body).toContain('- [quiet-notes](https://github.com/SairaDev02/quiet-notes)\n');
  expect(body).not.toContain('forked-lib');
});
