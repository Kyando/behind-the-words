import { artUrl, LEVELS, ROOMS, type Room } from '../core/levels.ts';
import type { LevelDef } from '../core/types.ts';
import { h, svg } from './dom.ts';
import { ICONS } from './icons.ts';

export interface TrailOptions {
  isDone(id: string): boolean;
  stars: number;
  sound: boolean;
  onPlay(level: LevelDef): void;
  onToggleSound(): boolean;
  /** A level just restored: its node pops when the trail comes back. */
  justDone?: string;
}

/** How far each node sits from the centre line, in node widths: the path winds left and right. */
const WIND = [0, 0.55, 0.85, 0.55, 0, -0.55, -0.85, -0.55];

/**
 * The home screen: one trail of paintings that climbs, room after room, from the bottom of the screen
 * up. Each room opens with its banner at its foot. A restored painting fills its node; the next one
 * waits with a Start bubble; the rest are locked until reached.
 */
export class Trail {
  readonly el: HTMLElement;

  constructor(opts: TrailOptions) {
    const next = LEVELS.find((l) => !opts.isDone(l.id));
    const soundBtn = h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Sound' }, svg(opts.sound ? ICONS.sound : ICONS.mute));
    soundBtn.addEventListener('click', () => soundBtn.replaceChildren(svg(opts.onToggleSound() ? ICONS.sound : ICONS.mute)));
    const top = h(
      'header',
      { class: 'trail-top' },
      h('div', { class: 'wordmark' }, h('span', { class: 'wordmark-mark' }, svg(ICONS.palette)), h('span', {}, 'Behind the ', h('b', {}, 'Words'))),
      h('span', { class: 'chip chip-star', 'aria-label': `${opts.stars} stars` }, svg(ICONS.star), String(opts.stars)),
      soundBtn,
    );

    const path = h('div', { class: 'trail-path' });
    let index = 0;
    for (const room of ROOMS) {
      const levels = LEVELS.filter((l) => l.room === room.id);
      const open = opts.stars >= room.gate;
      const nodes = h('ol', { class: 'trail-nodes' });
      const count = Math.max(room.planned, levels.length);
      for (let i = 0; i < count; i++) {
        const level = levels[i];
        const offset = WIND[index++ % WIND.length];
        nodes.append(this.node(level, open, level === next, offset, opts, room));
      }
      path.append(h('section', { class: 'room', 'data-room': room.id }, this.banner(room, levels, open, opts), nodes));
    }
    this.el = h('main', { class: 'screen trail' }, top, h('div', { class: 'trail-scroll' }, path));

    // Bring the next painting into view.
    requestAnimationFrame(() => {
      const target = this.el.querySelector<HTMLElement>(opts.justDone ? `[data-id="${opts.justDone}"]` : '.node.is-next') ?? this.el.querySelector<HTMLElement>('.node.is-next');
      target?.scrollIntoView({ block: 'center' });
      if (opts.justDone) this.el.querySelector(`[data-id="${opts.justDone}"]`)?.classList.add('is-new');
    });
  }

  private banner(room: Room, levels: LevelDef[], open: boolean, opts: TrailOptions): HTMLElement {
    const done = levels.filter((l) => opts.isDone(l.id)).length;
    const n = ROOMS.indexOf(room) + 1;
    return h(
      'header',
      { class: `room-banner${open ? '' : ' is-locked'}`, 'data-room': room.id, style: `--room: ${room.color}; --room-edge: ${room.edge}` },
      h('div', {}, h('p', { class: 'room-eyebrow' }, `Room ${n}`), h('h2', {}, room.name), h('p', { class: 'room-tagline' }, room.tagline)),
      open
        ? h('span', { class: 'room-count' }, `${done}/${Math.max(room.planned, levels.length)}`)
        : h('span', { class: 'room-gate' }, svg(ICONS.lock), h('span', {}, svg(ICONS.star), String(room.gate))),
    );
  }

  private node(level: LevelDef | undefined, open: boolean, isNext: boolean, offset: number, opts: TrailOptions, room: Room): HTMLElement {
    const style = `--x: ${offset}; --room: ${room.color}; --room-edge: ${room.edge}`;
    if (!level || !open) {
      return h('li', { class: 'node-slot', 'data-room': room.id, style }, h('span', { class: 'node is-locked', 'aria-label': level ? 'Locked painting' : 'Coming soon' }, svg(ICONS.lock)));
    }
    const done = opts.isDone(level.id);
    const btn = h(
      'button',
      {
        type: 'button',
        class: `node${done ? ' is-done' : ''}${isNext ? ' is-next' : ''}${!done && !isNext ? ' is-locked' : ''}`,
        'data-id': level.id,
        'aria-label': done ? `${level.art.title} (restored)` : isNext ? 'Next painting' : 'Locked painting',
        disabled: !done && !isNext,
        onclick: () => opts.onPlay(level),
      },
      done ? h('span', { class: 'node-art', style: `background-image: url("${artUrl(level.art.slug)}")` }) : svg(isNext ? ICONS.palette : ICONS.lock),
    );
    return h('li', { class: `node-slot${isNext ? ' has-bubble' : ''}`, 'data-room': room.id, style }, isNext ? h('span', { class: 'node-bubble' }, done ? 'Replay' : 'Start') : null, btn);
  }
}
