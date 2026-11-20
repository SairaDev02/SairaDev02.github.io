// The theme module: owns the root's data-theme attribute after load.
//
// The pre-paint script (theme-init.js) sets the first value. This module then applies the
// header's System / Light / Dark radios and, while on System, changes of the device's
// prefers-color-scheme. The choice lives in localStorage under `theme` as `light` or
// `dark`; System removes the key. Storage failures fall back to System, silently.
//
// Subscribing (for the scenes): call `onThemeChange(listener)`. The
// listener runs after the attribute has changed, inside the view transition when one is
// used, so a scene re-reads its colours from the new custom properties and redraws. It is
// the document event `themechange` with `detail: { theme: 'light' | 'dark' }`. It fires
// only when the resolved theme changes, not on first load: read `currentTheme()` then.

export type Theme = 'light' | 'dark';
type Choice = Theme | 'system';

const isChoice = (value: string): value is Choice => value === 'light' || value === 'dark' || value === 'system';
const isTheme = (value: unknown): value is Theme => value === 'light' || value === 'dark';

const KEY = 'theme';
const EVENT = 'themechange';
const root = document.documentElement;
const device = matchMedia('(prefers-color-scheme: dark)');

/** The theme now applied to the page. */
export const currentTheme = (): Theme => (root.dataset.theme === 'dark' ? 'dark' : 'light');

/** Calls `listener` whenever the resolved theme changes. Returns a function that stops it. */
export const onThemeChange = (listener: (theme: Theme) => void) => {
  const handler = (e: Event) => {
    if (e instanceof CustomEvent && isTheme(e.detail?.theme)) listener(e.detail.theme);
  };
  document.addEventListener(EVENT, handler);
  return () => document.removeEventListener(EVENT, handler);
};

// Kept in memory too, so a choice made while storage is blocked still holds for the visit.
let choice: Choice = 'system';
try {
  const stored = localStorage.getItem(KEY);
  if (isTheme(stored)) choice = stored;
} catch {
  // Storage blocked: System.
}

const resolve = (): Theme => (choice === 'system' ? (device.matches ? 'dark' : 'light') : choice);

const apply = () => {
  const theme = resolve();
  if (theme === currentTheme()) return;
  const swap = () => {
    root.dataset.theme = theme;
    document.dispatchEvent(new CustomEvent(EVENT, { detail: { theme } }));
  };
  if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) swap();
  else document.startViewTransition(swap);
};

const radios = document.querySelectorAll<HTMLInputElement>('input[name="theme"]');
for (const radio of radios) radio.checked = radio.value === choice;
for (const radio of radios) {
  radio.addEventListener('change', () => {
    if (!radio.checked || !isChoice(radio.value)) return;
    choice = radio.value;
    try {
      if (choice === 'system') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, choice);
    } catch {
      // Storage blocked: the choice holds for this visit only.
    }
    apply();
  });
}
device.addEventListener('change', () => {
  if (choice === 'system') apply();
});
