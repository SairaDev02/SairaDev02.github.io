// The fixed now-playing dock (NowPlaying.astro): the cued track, transport controls, a
// commit-waveform progress fill, and two panels above the bar: Lyrics (the README as lines,
// highlighted one by one) and Queue (play order, reorderable by drag or buttons).
// The queue order and the open panel are the dock's own state; what is cued or playing
// belongs to the player state, and every word the dock says about a play comes from the
// play's clock, never from frames or chained timers.
import { dotDate, languageOf, plural, trackNo, type Track } from '../../lib/format';
import type { PlayerState, Progress } from '../player-state';
import { reducedMotion } from '../render/canvas';
import { kickerView, pick, playView, stepView, type Step } from './controls';
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

  // ---------- bar ----------
  const kicker = $('[data-np-kicker]');
  const queueLabel = $('[data-q-kicker]');
  const playButtons = [...document.querySelectorAll<HTMLElement>('[data-np="play"]')];
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
  // Prev and Next name their target and what pressing them does, so their names follow the
  // Cue and, while a play runs, the play.
  const stepOf = (b: HTMLElement): Step => (b.dataset.np === 'next' ? 'next' : 'prev');
  const transport = () => {
    for (const b of dock.querySelectorAll<HTMLElement>('[data-np="prev"], [data-np="next"]'))
      b.setAttribute('aria-label', stepView(stepOf(b), player.get(), queue, tracks).label);
  };
  // The played part of the waveform fills over the play: a progress fill, never a scrubber.
  const fill = (p: Progress | null, jump: boolean) => {
    const value = `inset(0 ${(1 - (p?.done ?? 0)) * 100}% 0 0)`;
    for (const w of waves) {
      const el = w.querySelector<HTMLElement>('[data-wave-fill]')!;
      if (el.style.clipPath === value) continue;
      if (jump) {
        // A new play, a return, or a return from the repository's tab is no slide.
        el.style.transition = 'none';
        el.style.clipPath = value;
        void el.offsetWidth; // commit the jump before the transition comes back
        el.style.transition = '';
      } else el.style.clipPath = value;
    }
  };
  // The label above the title, the Play button's name, the waveform and the lyrics read the
  // play's clock, so the load gives way to the play on the clock, not on an animation.
  const tick = (jump = false) => {
    const s = player.get();
    const p = player.progress();
    const label = kickerView(s, p);
    if (kicker.textContent !== label) kicker.textContent = label;
    if (queueLabel.textContent !== label) queueLabel.textContent = label;
    const play = playView(s, tracks);
    for (const b of playButtons) if (b.getAttribute('aria-label') !== play) b.setAttribute('aria-label', play);
    dock.classList.toggle('is-playing', s.play !== null);
    fill(p, jump);
    sing();
  };
  // Only a running play needs the clock; idle needs none.
  let clock = 0;
  const runClock = () => {
    if (player.get().play && !clock) clock = window.setInterval(() => tick(), 250);
    else if (!player.get().play && clock) {
      clearInterval(clock);
      clock = 0;
    }
  };
  player.subscribe((s, before) => {
    if (s.cued !== before.cued) show(s.cued);
    transport();
    runClock();
    tick(true);
  });
  // A hidden tab's timers are throttled: the fill and the lyrics catch up on return.
  addEventListener('visibilitychange', () => document.visibilityState === 'visible' && tick(true));
  addEventListener('pageshow', () => tick(true));

  const setShuffle = (on: boolean) => {
    shuffled = on;
    queue = on ? shuffleAround(n, cued()) : naturalOrder(n);
    for (const b of document.querySelectorAll('[data-np="shuffle"]')) b.setAttribute('aria-pressed', String(on));
    transport();
    if (open === 'queue') renderQueue();
  };

  // Any [data-np] button on the page: the dock's transport and the playlist header's.
  for (const b of document.querySelectorAll<HTMLElement>('[data-np]'))
    b.addEventListener('click', () => {
      if (busy()) return;
      switch (b.dataset.np) {
        case 'play':
          openAndPlay(cued());
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
          const { to } = stepView(stepOf(b), player.get(), queue, tracks);
          pick(to, player, openAndPlay);
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
    if (which === 'queue') renderQueue();
  };
  toggles.forEach((t) => t.addEventListener('click', () => setOpen(open === t.dataset.npPanel ? null : (t.dataset.npPanel as Panel))));
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && open) setOpen(null);
  });

  // Lyrics: README lines, highlighted one at a time like synced lyrics, on the play's clock:
  // 2.6 s a line from the play's start. Idle, and under reduced motion, nothing is lit.
  let sung: HTMLElement[] = [];
  let lit = -2; // the lit line: -1 for none, -2 before the first reading
  const sing = () => {
    if (open !== 'lyrics') return;
    const p = player.progress();
    const k = !p || p.phase === 'load' || reducedMotion() ? -1 : Math.min(Math.floor(p.elapsed / LINE_MS), sung.length - 1);
    if (k === lit) return;
    lit = k;
    sung.forEach((li, j) => {
      li.classList.toggle('past', j < k);
      li.classList.toggle('now', j === k);
    });
    const li = sung[k];
    if (li) panels.lyrics.scrollTo({ top: li.offsetTop - panels.lyrics.clientHeight / 3, behavior: reducedMotion() ? 'auto' : 'smooth' });
  };
  const renderLyrics = () => {
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
    sung = [...list.querySelectorAll<HTMLElement>('li:not(.tag)')];
    lit = -2;
    sing();
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
    // The Queue order is what a step follows, so its names change with it.
    transport();
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
    } else if (target.closest('[data-q-pick]') && i !== cued()) pick(i, player, openAndPlay);
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
  transport();
  runClock();
  tick(true);

  // The page pads and scrolls by the Dock's own height, so nothing focused or scrolled to
  // lands under the bar or an open panel. --dock-h is the fallback before this runs.
  const root = document.documentElement;
  const measure = () => root.style.setProperty('--dock-space', `${dock.getBoundingClientRect().height}px`);
  new ResizeObserver(measure).observe(dock);
  return { nextAfter: (i: number) => stepFrom(queue, i, 1) };
}
