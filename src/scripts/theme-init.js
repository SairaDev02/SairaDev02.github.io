// Pre-paint theme script. BaseLayout inlines this file verbatim in the head, and
// astro.config.mjs hashes the same file for the CSP, so edit it only here. It resolves the
// theme (the stored choice, else the device scheme) and sets data-theme on the root before
// first paint. src/scripts/theme.ts owns the attribute after load.
(() => {
  let choice = null;
  try {
    choice = localStorage.getItem('theme');
  } catch {
    // Storage blocked: System.
  }
  const dark = choice === 'dark' || (choice !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
})();
