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
 * Where a painting sits in its room: x across (0 to 1) and r up from the foot (0 to 1).
 * Each room's paintings follow a winding curve that sweeps across the whole screen as it climbs,
 * evenly spaced along it, so the room fills its screen without crowding anywhere.
 */
type Spot = readonly [x: number, r: number];

/** Each room's sweep: how many times it crosses the screen, where it starts, a second ripple. */
const SWEEPS = [
  { turns: 2.25, phase: -1.2, ripple: 0.03 },
  { turns: 2.6, phase: 0.4, ripple: -0.04 },
  { turns: 2.5, phase: 2.2, ripple: 0.03 },
  { turns: 2.8, phase: 3.4, ripple: -0.03 },
];
/** The field's shape (width / height) the spacing is measured in: a phone screen's room. */
const ASPECT = 0.62;

function layout(room: number, count: number): Spot[] {
  const { turns, phase, ripple } = SWEEPS[room % SWEEPS.length];
  const at = (t: number): Spot => [
    0.5 + 0.42 * Math.sin(2 * Math.PI * turns * t + phase) + ripple * Math.sin(2 * Math.PI * 2.3 * t + phase * 1.7),
    t,
  ];
  // Each painting is the same straight-line distance from the one before (as seen on screen, not
  // along the curve, which would bunch them where it turns): find the widest spacing that fits.
  const steps = 800;
  const curve = Array.from({ length: steps + 1 }, (_, i) => at(0.03 + (0.94 * i) / steps));
  const apart = (p: Spot, q: Spot) => Math.hypot((p[0] - q[0]) * ASPECT, p[1] - q[1]);
  const place = (gap: number): Spot[] => {
    const spots = [curve[0]];
    for (const p of curve) if (spots.length < count && apart(p, spots[spots.length - 1]) >= gap) spots.push(p);
    return spots;
  };
  let lo = 0;
  let hi = 1;
  for (let k = 0; k < 30; k++) {
    const mid = (lo + hi) / 2;
    if (place(mid).length === count) lo = mid;
    else hi = mid;
  }
  return place(lo);
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
      const spots = layout(r, count);
      for (let i = 0; i < count; i++) {
        const level = levels[i];
        nodes.append(this.node(level, open, level === next, spots[i], opts, room));
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

  /** The path through every node in trail order, as one winding curve. */
  private drawLine(path: HTMLElement, line: SVGSVGElement): void {
    const box = path.getBoundingClientRect();
    const nodes = [...path.querySelectorAll<HTMLElement>('.node')];
    const points = nodes.map((n) => {
      const r = n.getBoundingClientRect();
      return { x: r.left + r.width / 2 - box.left, y: r.top + r.height / 2 - box.top, ahead: n.classList.contains('is-locked') };
    });
    line.setAttribute('width', String(box.width));
    line.setAttribute('height', String(box.height));
    // One smooth curve through all the nodes (Catmull-Rom as Béziers), solid where walked.
    const segments = { walked: '', ahead: '' };
    const pt = (i: number) => points[Math.max(0, Math.min(points.length - 1, i))];
    for (let i = 1; i < points.length; i++) {
      const [p0, p1, p2, p3] = [pt(i - 2), pt(i - 1), pt(i), pt(i + 1)];
      const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
      const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
      segments[p2.ahead ? 'ahead' : 'walked'] += `M${p1.x},${p1.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${p2.x},${p2.y} `;
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

  /** A painting at its spot in the room. */
  private node(level: LevelDef | undefined, open: boolean, isNext: boolean, [x, r]: Spot, opts: TrailOptions, room: Room): HTMLElement {
    const style = `--x: ${x.toFixed(3)}; --r: ${r.toFixed(3)}; --room: ${room.color}; --room-edge: ${room.edge}`;
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
