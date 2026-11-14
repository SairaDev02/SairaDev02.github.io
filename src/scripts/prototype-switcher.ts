// PROTOTYPE (map #35): floating variant switcher, dev builds only. ← / → cycle variants,
// and the choice lives in `?variant=` so a reload or a shared link keeps it.
export function mountPrototypeSwitcher<K extends string>(keys: readonly K[], names: Record<K, string>): K {
  const params = new URLSearchParams(location.search);
  const current = (keys.includes(params.get('variant') as K) ? params.get('variant') : keys[0]) as K;
  if (!import.meta.env.DEV) return current;

  const go = (dir: 1 | -1) => {
    const k = keys[(keys.indexOf(current) + dir + keys.length) % keys.length];
    params.set('variant', k);
    location.search = params.toString();
  };
  const bar = document.createElement('div');
  bar.className = 'proto-switcher';
  const prev = document.createElement('button');
  prev.textContent = '←';
  prev.addEventListener('click', () => go(-1));
  const label = document.createElement('span');
  label.textContent = `Prototype ${current} · ${names[current]}`;
  const next = document.createElement('button');
  next.textContent = '→';
  next.addEventListener('click', () => go(1));
  bar.append(prev, label, next);
  document.body.append(bar);
  addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('input, textarea, [contenteditable]') || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'ArrowLeft') go(-1);
    if (e.key === 'ArrowRight') go(1);
  });
  return current;
}
