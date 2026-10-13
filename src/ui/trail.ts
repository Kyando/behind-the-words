import { artUrl, LEVELS, ROOMS, type Room } from '../core/levels.ts';
import type { LevelDef } from '../core/types.ts';
import { h, reducedMotion, svg } from './dom.ts';
import { centreOf, replay, sparkles } from './fx.ts';
import { ICONS } from './icons.ts';
import type { Sfx } from './sfx.ts';

export interface TrailOptions {
  isDone(id: string): boolean;
  stars: number;
  sound: boolean;
  onPlay(level: LevelDef): void;
  onToggleSound(): boolean;
  sfx: Sfx;
  /** A level just restored: its painting lands in its spot when the trail comes back. */
  justDone?: string;
  /** That restoration won its star (a first finish): the star is counted in as it lands. */
  earned?: boolean;
}

/** One painting's place on the trail. */
interface Piece {
  level?: LevelDef;
  room: Room;
  /** Its number in the room, from 1. */
  n: number;
  state: 'done' | 'next' | 'locked' | 'soon';
}

/**
 * The trail home screen: each room is a wall of framed paintings, hung in staggered rows of three
 * and two. Restored ones show their painting in a gold frame; the next waits with a Start plaque;
 * the rest are covered, numbered, until reached.
 */
export class Trail {
  readonly el: HTMLElement;
  private readonly focus: HTMLElement | null;
  private readonly popIn: boolean;
  private readonly opts: TrailOptions;
  private readonly starChip: HTMLElement;

  constructor(opts: TrailOptions) {
    this.opts = opts;
    const soundBtn = h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Sound' }, svg(opts.sound ? ICONS.sound : ICONS.mute));
    soundBtn.addEventListener('click', () => soundBtn.replaceChildren(svg(opts.onToggleSound() ? ICONS.sound : ICONS.mute)));
    const top = h(
      'header',
      { class: 'trail-top' },
      h('div', { class: 'wordmark' }, h('span', { class: 'wordmark-mark' }, svg(ICONS.palette)), h('span', {}, 'Behind the ', h('b', {}, 'Words'))),
      (this.starChip = h('span', { class: 'chip chip-star', 'aria-label': `${opts.stars} stars` }, svg(ICONS.star), h('span', {}, String(opts.earned ? opts.stars - 1 : opts.stars)))),
      soundBtn,
    );

    const rooms = this.pieces();
    this.el = h('main', { class: 'screen trail' }, top, this.wall(rooms));

    // The paintings drop in outward from the one in focus (just restored, or next), nearest first.
    this.focus = this.el.querySelector<HTMLElement>(opts.justDone ? `[data-id="${opts.justDone}"]` : '.node.is-next') ?? this.el.querySelector<HTMLElement>('.node.is-next');
    const slots = [...this.el.querySelectorAll<HTMLElement>('.spot')];
    const at = slots.findIndex((s) => this.focus && s.contains(this.focus));
    slots.forEach((s, i) => s.style.setProperty('--n', String(Math.min(14, Math.abs(i - Math.max(0, at))))));
    this.popIn = !!opts.justDone && !document.startViewTransition;
  }

  /** Every room with its pieces, in trail order. */
  private pieces(): { room: Room; open: boolean; done: number; pieces: Piece[] }[] {
    const next = LEVELS.find((l) => !this.opts.isDone(l.id));
    return ROOMS.map((room) => {
      const levels = LEVELS.filter((l) => l.room === room.id);
      const open = this.opts.stars >= room.gate;
      const count = Math.max(room.planned, levels.length);
      const pieces = Array.from({ length: count }, (_, i): Piece => {
        const level = levels[i];
        const state = !level ? 'soon' : open && this.opts.isDone(level.id) ? 'done' : open && level === next ? 'next' : 'locked';
        return { level, room, n: i + 1, state };
      });
      return { room, open, done: pieces.filter((p) => p.state === 'done').length, pieces };
    });
  }

  /** On screen: bring the piece in focus into view (before a view transition takes its picture). */
  shown(): void {
    this.focus?.scrollIntoView({ block: 'center' });
    // Without view transitions the painting can't travel here, so its spot pops in instead.
    if (this.popIn) this.focus?.classList.add('is-new');
    if (this.opts.justDone) window.setTimeout(() => this.landed(), reducedMotion() ? 0 : 560);
  }

  /** The restored painting has landed: sparkles, a ding, and its star counted in. */
  private landed(): void {
    if (!this.el.isConnected || !this.focus) return;
    const { x, y } = centreOf(this.focus);
    sparkles(x, y, 12, 64);
    this.opts.sfx.sparkle();
    replay(this.focus, 'is-landed');
    if (!this.opts.earned) return;
    const count = this.starChip.lastElementChild as HTMLElement;
    window.setTimeout(() => {
      count.textContent = String(this.opts.stars);
      replay(this.starChip, 'pop');
      const c = centreOf(this.starChip);
      sparkles(c.x, c.y, 7, 34);
      this.opts.sfx.star();
    }, 260);
  }

  // ── The pieces ──────────────────────────────────────────────────────────

  /** A piece's button: the painting once restored, a palette when next, its number otherwise. */
  private button(p: Piece, extra = ''): HTMLElement {
    const { level, state } = p;
    const playable = state === 'done' || state === 'next';
    const face =
      state === 'done'
        ? h('span', { class: 'node-art', style: `background-image: url("${artUrl(level!.art.slug)}")` })
        : state === 'next'
          ? svg(ICONS.palette)
          : h('span', { class: 'node-num' }, String(p.n));
    return h(
      playable ? 'button' : 'span',
      {
        type: playable ? 'button' : undefined,
        class: `node is-${state}${extra}`,
        'data-id': level?.id,
        style: state === 'done' && this.opts.justDone === level?.id ? 'view-transition-name: painting' : undefined,
        'aria-label': state === 'done' ? `${level!.art.title} (restored)` : state === 'next' ? 'Next painting' : state === 'soon' ? 'Coming soon' : 'Locked painting',
        onclick: playable ? () => this.opts.onPlay(level!) : undefined,
      },
      face,
    );
  }

  private banner(room: Room, open: boolean, done: number, count: number): HTMLElement {
    const n = ROOMS.indexOf(room) + 1;
    return h(
      'header',
      { class: `room-banner${open ? '' : ' is-locked'}`, 'data-room': room.id },
      h('div', {}, h('p', { class: 'room-eyebrow' }, `Room ${n}`), h('h2', {}, room.name), h('p', { class: 'room-tagline' }, room.tagline)),
      open ? h('span', { class: 'room-count' }, `${done}/${count}`) : h('span', { class: 'room-gate' }, svg(ICONS.lock), h('span', {}, svg(ICONS.star), String(room.gate))),
    );
  }

    /** Each room a wall, its paintings hung in staggered rows of three and two. */
  private wall(rooms: ReturnType<Trail['pieces']>): HTMLElement {
    const list = h('div', { class: 'walls' });
    for (const { room, open, done, pieces } of rooms) {
      const hang = h('div', { class: 'hang' });
      let k = 0;
      for (let row = 0; k < pieces.length; row++) {
        const size = row % 2 ? 2 : 3;
        const line = h('div', { class: 'hang-row' });
        for (const p of pieces.slice(k, k + size)) {
          line.append(
            h(
              'div',
              { class: `spot frame-spot is-${p.state}`, 'data-room': room.id, style: `--tilt: ${(((p.n * 7) % 5) - 2) * 0.8}deg` },
              h('span', { class: 'nail', 'aria-hidden': 'true' }),
              this.button(p, ' hung'),
              h('span', { class: 'plaque' }, p.state === 'done' ? p.level!.art.title : p.state === 'next' ? 'Start' : `No. ${p.n}`),
            ),
          );
        }
        k += size;
        hang.append(line);
      }
      list.append(h('section', { class: `wall${open ? '' : ' is-closed'}`, 'data-room': room.id }, this.banner(room, open, done, pieces.length), hang));
    }
    return h('div', { class: 'trail-scroll' }, list);
  }
}
