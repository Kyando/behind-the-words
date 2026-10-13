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
  /** A level just restored: its painting lands in its node when the trail comes back. */
  justDone?: string;
  /** That restoration won its star (a first finish): the star is counted in as it lands. */
  earned?: boolean;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * How a room's paintings are laid out: cells of a 4-column, 7-row field (row 0 at the room's foot),
 * each one a straight step across or up from the one before, like a word bending on the board.
 * Each room starts at the bottom and leaves from the top row, into the next room above.
 */
type Cell = readonly [col: number, row: number];
const FIELD_ROWS = 6;
const PATTERNS: readonly (readonly Cell[])[] = [
  // Snake: across the foot, up, back, and up the middle in shorter steps.
  [[0, 0], [1, 0], [2, 0], [3, 0], [3, 2], [2, 2], [1, 2], [1, 4], [2, 4], [2, 6]],
  // Stairs climbing to the right, then back along the top.
  [[0, 0], [0, 1], [1, 1], [1, 3], [2, 3], [2, 4], [3, 4], [3, 6], [2, 6], [1, 6]],
  // A hook: along the foot, up the left side, across and up again.
  [[3, 0], [2, 0], [1, 0], [0, 0], [0, 2], [0, 4], [1, 4], [2, 4], [2, 6], [3, 6]],
  // A step to the right, a long bar back left, up the side and out along the top.
  [[2, 0], [3, 0], [3, 2], [2, 2], [1, 2], [0, 2], [0, 4], [0, 6], [1, 6], [2, 6]],
];

/** The layout for a room of count paintings: its pattern, or a plain snake when the count differs. */
function layout(room: number, count: number): readonly Cell[] {
  const pattern = PATTERNS[room % PATTERNS.length];
  if (pattern.length === count) return pattern;
  const lines = Math.ceil(count / 4);
  const step = lines > 1 ? FIELD_ROWS / (lines - 1) : 0;
  return Array.from({ length: count }, (_, i) => {
    const line = Math.floor(i / 4);
    return [line % 2 ? 3 - (i % 4) : i % 4, line * step] as const;
  });
}

/**
 * The home screen: one trail of paintings that climbs, room after room, from the bottom of the screen
 * up. Each room opens with its banner at its foot. A restored painting fills its node; the next one
 * waits with a Start bubble; the rest are locked until reached.
 */
export class Trail {
  readonly el: HTMLElement;
  private readonly focus: HTMLElement | null;
  private readonly popIn: boolean;
  private readonly opts: TrailOptions;
  private readonly starChip: HTMLElement;

  constructor(opts: TrailOptions) {
    this.opts = opts;
    const next = LEVELS.find((l) => !opts.isDone(l.id));
    const soundBtn = h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Sound' }, svg(opts.sound ? ICONS.sound : ICONS.mute));
    soundBtn.addEventListener('click', () => soundBtn.replaceChildren(svg(opts.onToggleSound() ? ICONS.sound : ICONS.mute)));
    const top = h(
      'header',
      { class: 'trail-top' },
      h('div', { class: 'wordmark' }, h('span', { class: 'wordmark-mark' }, svg(ICONS.palette)), h('span', {}, 'Behind the ', h('b', {}, 'Words'))),
      (this.starChip = h('span', { class: 'chip chip-star', 'aria-label': `${opts.stars} stars` }, svg(ICONS.star), h('span', {}, String(opts.earned ? opts.stars - 1 : opts.stars)))),
      soundBtn,
    );

    const path = h('div', { class: 'trail-path' });
    ROOMS.forEach((room, r) => {
      const levels = LEVELS.filter((l) => l.room === room.id);
      const open = opts.stars >= room.gate;
      const nodes = h('ol', { class: 'trail-nodes' });
      const count = Math.max(room.planned, levels.length);
      const cells = layout(r, count);
      for (let i = 0; i < count; i++) {
        const level = levels[i];
        nodes.append(this.node(level, open, level === next, cells[i], opts, room));
      }
      path.append(h('section', { class: 'room', 'data-room': room.id }, this.banner(room, levels, open, opts), nodes));
    });
    this.el = h('main', { class: 'screen trail' }, top, h('div', { class: 'trail-scroll' }, path));

    // The path drawn from node to node: solid up to the next painting, dotted beyond.
    const line = document.createElementNS(SVG_NS, 'svg');
    line.classList.add('trail-line');
    line.setAttribute('aria-hidden', 'true');
    path.prepend(line);
    new ResizeObserver(() => this.drawLine(path, line)).observe(path);
    // The nodes drop in on arrival; draw again once they've landed.
    let landing = 0;
    path.addEventListener('animationend', (e) => {
      if (e.animationName !== 'drop-in') return;
      cancelAnimationFrame(landing);
      landing = requestAnimationFrame(() => this.drawLine(path, line));
    });

    // The paintings drop in outward from the one in focus (just restored, or next), nearest first.
    this.focus = this.el.querySelector<HTMLElement>(opts.justDone ? `[data-id="${opts.justDone}"]` : '.node.is-next') ?? this.el.querySelector<HTMLElement>('.node.is-next');
    const slots = [...path.querySelectorAll<HTMLElement>('.node-slot')];
    const at = slots.findIndex((s) => this.focus && s.contains(this.focus));
    slots.forEach((s, i) => s.style.setProperty('--n', String(Math.abs(i - Math.max(0, at)))));
    this.popIn = !!opts.justDone && !document.startViewTransition;
  }

  /** On screen: bring the room in focus into view (before a view transition takes its picture). */
  shown(): void {
    (this.focus?.closest('.room') ?? this.focus)?.scrollIntoView({ block: 'center' });
    // Without view transitions the painting can't travel here, so its node pops in instead.
    if (this.popIn) this.focus?.classList.add('is-new');
    if (this.opts.justDone) window.setTimeout(() => this.landed(), reducedMotion() ? 0 : 560);
  }

  /** The restored painting has landed in its node: sparkles, a ding, and its star counted in. */
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

  /** From each node to the next, in trail order: straight within a room, a curve into the next room. */
  private drawLine(path: HTMLElement, line: SVGSVGElement): void {
    const box = path.getBoundingClientRect();
    const nodes = [...path.querySelectorAll<HTMLElement>('.node')];
    const points = nodes.map((n) => {
      const r = n.getBoundingClientRect();
      return { x: r.left + r.width / 2 - box.left, y: r.top + r.height / 2 - box.top, ahead: n.classList.contains('is-locked') };
    });
    line.setAttribute('width', String(box.width));
    line.setAttribute('height', String(box.height));
    const segments = { walked: '', ahead: '' };
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      const bend = (a.y - b.y) / 2;
      segments[b.ahead ? 'ahead' : 'walked'] += `M${a.x},${a.y} C${a.x},${a.y - bend} ${b.x},${b.y + bend} ${b.x},${b.y} `;
    }
    line.replaceChildren(
      ...Object.entries(segments).map(([kind, d]) => {
        const p = document.createElementNS(SVG_NS, 'path');
        p.setAttribute('class', `is-${kind}`);
        p.setAttribute('d', d);
        return p;
      }),
    );
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

  /** A painting at its cell of the room's field. */
  private node(level: LevelDef | undefined, open: boolean, isNext: boolean, [col, row]: Cell, opts: TrailOptions, room: Room): HTMLElement {
    const style = `--c: ${col}; --r: ${row / FIELD_ROWS}; --room: ${room.color}; --room-edge: ${room.edge}`;
    if (!level || !open) {
      return h('li', { class: 'node-slot', 'data-room': room.id, style }, h('span', { class: 'node is-locked', 'aria-label': level ? 'Locked painting' : 'Coming soon' }, svg(ICONS.lock)));
    }
    const done = opts.isDone(level.id);
    const landing = opts.justDone === level.id;
    const btn = h(
      'button',
      {
        type: 'button',
        class: `node${done ? ' is-done' : ''}${isNext ? ' is-next' : ''}${!done && !isNext ? ' is-locked' : ''}`,
        'data-id': level.id,
        style: landing ? 'view-transition-name: painting' : undefined,
        'aria-label': done ? `${level.art.title} (restored)` : isNext ? 'Next painting' : 'Locked painting',
        disabled: !done && !isNext,
        onclick: () => opts.onPlay(level),
      },
      done ? h('span', { class: 'node-art', style: `background-image: url("${artUrl(level.art.slug)}")` }) : svg(isNext ? ICONS.palette : ICONS.lock),
    );
    return h('li', { class: `node-slot${isNext ? ' has-bubble' : ''}`, 'data-room': room.id, style }, isNext ? h('span', { class: 'node-bubble' }, done ? 'Replay' : 'Start') : null, btn);
  }
}
