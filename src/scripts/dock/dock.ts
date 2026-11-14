// The fixed now-playing dock (NowPlaying.astro): the cued track, transport controls, a
// commit-waveform scrubber, and two panels above the bar: Lyrics (the README as lines,
// highlighted one by one) and Queue (play order, reorderable by drag or buttons).
// The queue order and the open panel are the dock's own state; what is cued or loading
// belongs to the player state.
// PROTOTYPE (map #35): prev/next and Queue picks cue when nothing plays and play (swap)
// during a play; variant A turns Play into Eject during a play; the bar fills over the play.
import { dotDate, languageOf, plural, trackNo, type Track } from '../../lib/format';
import type { PlayerState } from '../player-state';
import { reducedMotion } from '../render/canvas';
import { naturalOrder, reorder, shuffleAround, stepFrom, upNext } from './queue';

const LINE_MS = 2600; // pace of the lyric highlight
type Panel = 'lyrics' | 'queue';

export function mountDock(dock: HTMLElement, tracks: readonly Track[], player: PlayerState, openAndPlay: (i: number) => void) {
  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => dock.querySelector<T>(sel)!;
  const n = tracks.length;
  const waves = [...dock.querySelectorAll<HTMLElement>('[data-wave]')];
  let queue = naturalOrder(n);
  let shuffled = false;
  let open: Panel | null = null;
  const cued = () => player.get().cued;
  const busy = () => player.isLoading();
  const playing = () => player.get().play;
  const variant = () => document.documentElement.dataset.protoVariant ?? 'A';

  // ---------- bar ----------
  const show = (i: number) => {
    const t = tracks[i];
    $('[data-np-title]').textContent = `${trackNo(i)} ${t.name}`;
    $('[data-np-sub]').textContent = [languageOf(t), ...t.topics.slice(0, 3)].join(' · ');
    $('[data-np-first]').textContent = dotDate(t.firstCommit);
    $('[data-np-last]').textContent = dotDate(t.lastCommit);
    $('[data-np-commits]').textContent = plural(t.commits, 'commit');
    waves.forEach((w, k) => (w.hidden = k !== i));
    if (open === 'lyrics') renderLyrics();
    if (open === 'queue') renderQueue();
  };
  const progressBar = $('[data-proto-progress]');
  const fmt = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.ceil(ms / 1000) % 60).padStart(2, '0')}`;
  const tick = () => {
    const p = player.progress();
    const s = player.get();
    const kicker = $('[data-np-kicker]');
    if (!p || !s.play) kicker.textContent = 'Up next';
    else if (p.phase === 'load') kicker.textContent = 'Loading · opened in a new tab';
    else kicker.textContent = variant() === 'C' ? `Now playing · ${fmt(player.playMs - p.elapsed)} left` : 'Now playing';
    const play = $<HTMLButtonElement>('.ctrl [data-np="play"]');
    const eject = !!s.play && variant() === 'A';
    play.classList.toggle('as-eject', eject);
    play.setAttribute('aria-label', eject ? `Eject ${tracks[s.play!.i].name}` : 'Play: open the cued repository in a new tab');
    for (const b of document.querySelectorAll<HTMLElement>('[data-np="prev"], [data-np="next"]')) {
      const dir = b.dataset.np === 'next' ? 'Next' : 'Previous';
      b.setAttribute('aria-label', s.play ? `${dir}: play and open in a new tab` : `${dir} in queue`);
    }
  };
  // The played part of the waveform (and, in variant A, a line along the bar) fills over
  // the play, from the clock: right after a return from the repository's tab too.
  const fillTo = (el: HTMLElement, prop: 'clipPath' | 'width', from: string, to: string, ms: number) => {
    el.style.transition = 'none';
    el.style[prop] = from;
    requestAnimationFrame(() => {
      el.style.transition = `${prop === 'clipPath' ? 'clip-path' : 'width'} ${ms}ms linear`;
      el.style[prop] = to;
    });
  };
  const setPlaying = () => {
    const s = player.get();
    dock.classList.toggle('is-playing', !!s.play);
    for (const fill of dock.querySelectorAll<HTMLElement>('[data-wave-fill]')) {
      fill.style.transition = 'none';
      fill.style.clipPath = '';
    }
    progressBar.hidden = !s.play || variant() !== 'A';
    tick();
    if (!s.play) return;
    const done = player.progress()?.done ?? 0;
    const left = Math.max(0, s.play.startedAt + player.loadMs + player.playMs - Date.now());
    const fill = waves[s.play.i].querySelector<HTMLElement>('[data-wave-fill]')!;
    fillTo(fill, 'clipPath', `inset(0 ${100 - done * 100}% 0 0)`, 'inset(0 0 0 0)', left);
    fillTo(progressBar.firstElementChild as HTMLElement, 'width', `${done * 100}%`, '100%', left);
  };
  player.subscribe((s, before) => {
    if (s.cued !== before.cued) show(s.cued);
    if (s.play !== before.play) setPlaying();
  });
  addEventListener('visibilitychange', () => document.visibilityState === 'visible' && setPlaying());
  setInterval(() => player.get().play && tick(), 250);

  const setShuffle = (on: boolean) => {
    shuffled = on;
    queue = on ? shuffleAround(n, cued()) : naturalOrder(n);
    for (const b of document.querySelectorAll('[data-np="shuffle"]')) b.setAttribute('aria-pressed', String(on));
    if (open === 'queue') renderQueue();
  };

  // Any [data-np] button on the page: the dock's transport and the playlist header's.
  for (const b of document.querySelectorAll<HTMLElement>('[data-np]'))
    b.addEventListener('click', () => {
      if (busy()) return;
      const s = player.get();
      switch (b.dataset.np) {
        case 'play':
          if (s.play && variant() === 'A' && b.closest('.ctrl')) player.eject('eject');
          else if (s.play?.i !== cued()) openAndPlay(cued());
          break;
        case 'shuffle':
          setShuffle(!shuffled);
          break;
        case 'shuffle-play':
          setShuffle(true);
          openAndPlay(queue[1 % n]); // the first track after the cued one
          break;
        case 'prev':
        case 'next': {
          const to = stepFrom(queue, cued(), b.dataset.np === 'next' ? 1 : -1);
          if (s.play) openAndPlay(to);
          else player.cue(to);
          break;
        }
      }
    });

  // ---------- panels ----------
  const panels: Record<Panel, HTMLElement> = { lyrics: $('[data-panel="lyrics"]'), queue: $('[data-panel="queue"]') };
  const toggles = [...dock.querySelectorAll<HTMLButtonElement>('[data-np-panel]')];
  const setOpen = (which: Panel | null) => {
    open = which;
    for (const [k, el] of Object.entries(panels)) el.hidden = k !== which;
    toggles.forEach((t) => t.setAttribute('aria-expanded', String(t.dataset.npPanel === which)));
    if (which === 'lyrics') renderLyrics();
    else clearInterval(karaoke);
    if (which === 'queue') renderQueue();
  };
  toggles.forEach((t) => t.addEventListener('click', () => setOpen(open === t.dataset.npPanel ? null : (t.dataset.npPanel as Panel))));
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && open) setOpen(null);
  });

  // Lyrics: README lines, highlighted one at a time like synced lyrics.
  let karaoke = 0;
  const renderLyrics = () => {
    clearInterval(karaoke);
    const i = cued();
    const t = tracks[i];
    $('[data-lyrics-title]').textContent = `Lyrics · ${trackNo(i)} ${t.name}`;
    $<HTMLAnchorElement>('[data-readme]').href = `${t.url}#readme`;
    const list = $('[data-lines]');
    const lines = t.lyrics.length ? t.lyrics : null;
    list.replaceChildren(
      ...(lines ?? [{ text: 'No README yet. This one is an instrumental.', heading: false }]).map((l) => {
        const li = document.createElement('li');
        li.textContent = l.heading ? `[ ${l.text} ]` : l.text;
        li.className = l.heading ? 'tag' : lines ? '' : 'empty';
        return li;
      }),
    );
    const sung = [...list.querySelectorAll<HTMLElement>('li:not(.tag)')];
    let k = 0;
    const tick = () => {
      sung.forEach((li, j) => {
        li.classList.toggle('past', j < k);
        li.classList.toggle('now', j === k);
      });
      const li = sung[k];
      const panel = panels.lyrics;
      if (li) panel.scrollTo({ top: li.offsetTop - panel.clientHeight / 3, behavior: reducedMotion() ? 'auto' : 'smooth' });
      k++;
    };
    tick();
    if (!reducedMotion() && sung.length > 1) karaoke = window.setInterval(() => (k < sung.length ? tick() : clearInterval(karaoke)), LINE_MS);
  };

  // Queue: the cued track, then next up in play order.
  const nowList = $('[data-q-now]');
  const nextList = $('[data-q-next]');
  const template = $<HTMLTemplateElement>('[data-q-item]');
  const item = (i: number, k: number, total: number, now: boolean) => {
    const t = tracks[i];
    const li = template.content.firstElementChild!.cloneNode(true) as HTMLElement;
    li.dataset.i = String(i);
    li.classList.toggle('q-now', now);
    li.querySelector('[data-q-num]')!.textContent = trackNo(i);
    li.querySelector('[data-q-name]')!.textContent = t.name;
    li.querySelector('[data-q-meta]')!.textContent = `${languageOf(t)} · ${plural(t.commits, 'commit')}`;
    // No aria-label: the button's accessible name is its visible text (name, language,
    // commits), so speech input can say what it sees. The cued one reads as pressed.
    li.querySelector('[data-q-pick]')!.setAttribute('aria-pressed', String(now));
    const [up, down] = li.querySelectorAll<HTMLButtonElement>('[data-move]');
    up.setAttribute('aria-label', `Move ${t.name} up`);
    down.setAttribute('aria-label', `Move ${t.name} down`);
    up.disabled = k === 0;
    down.disabled = k === total - 1;
    if (now) li.querySelector('[data-q-move]')!.remove();
    return li;
  };
  const renderQueue = (focus?: { i: number; move: string }) => {
    const next = upNext(queue, cued());
    nowList.replaceChildren(item(cued(), 0, 1, true));
    nextList.replaceChildren(...next.map((i, k) => item(i, k, next.length, false)));
    if (focus) nextList.querySelector<HTMLElement>(`[data-i="${focus.i}"] [data-move="${focus.move}"]:not(:disabled)`)?.focus();
  };

  panels.queue.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const li = target.closest<HTMLElement>('[data-i]');
    if (!li || busy()) return;
    const i = Number(li.dataset.i);
    const mv = target.closest<HTMLElement>('[data-move]');
    if (mv) {
      const from = upNext(queue, cued()).indexOf(i);
      queue = reorder(queue, cued(), from, from + Number(mv.dataset.move));
      renderQueue({ i, move: mv.dataset.move! });
    } else if (target.closest('[data-q-pick]') && i !== cued()) {
      if (playing()) openAndPlay(i);
      else player.cue(i);
    }
  });

  // Drag to reorder by the handle; pointer events, so touch works too.
  nextList.addEventListener('pointerdown', (e) => {
    const li = (e.target as HTMLElement).closest('[data-q-handle]')?.closest<HTMLElement>('[data-i]');
    if (!li || busy()) return;
    e.preventDefault();
    const rows = [...nextList.children] as HTMLElement[];
    const from = rows.indexOf(li);
    const h = li.getBoundingClientRect().height;
    const y0 = e.clientY;
    let to = from;
    li.classList.add('dragging');
    li.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const dy = ev.clientY - y0;
      li.style.transform = `translateY(${dy}px)`;
      to = Math.max(0, Math.min(rows.length - 1, from + Math.round(dy / h)));
      rows.forEach((el, k) => {
        if (el === li) return;
        const shift = from < to && k > from && k <= to ? -h : from > to && k < from && k >= to ? h : 0;
        el.style.transform = shift ? `translateY(${shift}px)` : '';
      });
    };
    const up = () => {
      li.removeEventListener('pointermove', move);
      li.removeEventListener('pointerup', up);
      li.removeEventListener('pointercancel', up);
      queue = reorder(queue, cued(), from, to);
      renderQueue();
    };
    li.addEventListener('pointermove', move);
    li.addEventListener('pointerup', up);
    li.addEventListener('pointercancel', up);
  });

  show(cued());
  tick();
  return { nextAfter: (i: number) => stepFrom(queue, i, 1) };
}
