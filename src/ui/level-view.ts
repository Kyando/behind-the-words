import { adjacent, colOf, rowOf } from '../core/grid.ts';
import { HOLE_LETTER, matchTrace, type Word } from '../core/puzzle.ts';
import { steer } from '../core/steer.ts';
import type { Session } from '../game/session.ts';
import { artUrl } from '../core/levels.ts';
import { h, reducedMotion, svg, unit } from './dom.ts';
import { buzz, centreOf, confetti, replay, sparkles } from './fx.ts';
import { ICONS } from './icons.ts';
import { PAINT_STAGGER_MS, paintDuration, PieceLayer } from './pieces.ts';
import { pieceOutline } from './shape.ts';
import type { Sfx } from './sfx.ts';

export interface LevelViewOptions {
  session: Session;
  sfx: Sfx;
  /** Deal the level in: title, word chips and tiles arrive one after another. */
  intro?: boolean;
  /** Leave for the trail (the close button). */
  onClose(): void;
  /** The painting is restored and the player asked to go on. */
  onContinue(): void;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
/** Longest stretch (in cells) between two finger positions read on their own, so fast swipes and cut corners step through every cell. */
const SAMPLE = 0.2;
/** A found word's tiles leave one after another, this far apart (ms), each flight taking FLIGHT_MS. */
const STAGGER_MS = PAINT_STAGGER_MS;
/**
 * The level's arrival (ms): the word chips pop up CHIP_STEP apart after the title; the tiles are dealt
 * in a diagonal wave from the top-left, one diagonal every DIAG_STEP, each card a little early or late
 * (up to CARD_JITTER) and flying for CARD_FLIGHT; then the grid hops once, HOP_STEP per diagonal.
 */
const CHIP_START = 380;
const CHIP_STEP = 80;
const DIAG_STEP = 95;
const CARD_JITTER = 60;
const CARD_FLIGHT = 560;
const HOP_STEP = 55;
const FLIGHT_MS = 720;

/**
 * One level, laid out like a game lesson: a close button and progress bar on top, the painting's
 * name, the words to find as chips, and the letter board, with the painting under the letters, cut
 * into one piece per word. A found word's tiles fly to its chip and its piece is painted in. At the
 * end the whole painting shows, and a banner rises with the way on.
 */
export class LevelView {
  readonly el: HTMLElement;
  private readonly s: Session;
  private readonly opts: LevelViewOptions;
  /** Title, words, trace and board: one group, centred in the space under the progress bar. */
  private readonly stage: HTMLElement;
  private readonly boardWrap: HTMLElement;
  private readonly board: HTMLElement;
  private readonly links: SVGSVGElement;
  private readonly pieces: PieceLayer;
  /** Words found whose tiles are still flying to their chip. */
  private readonly flying = new Set<number>();
  private readonly tiles: HTMLElement[] = [];
  private readonly traceEl: HTMLElement;
  private readonly progressFill: HTMLElement;
  private readonly wordList: HTMLElement;
  private readonly heading: HTMLElement;
  /** Word chips by word index. */
  private readonly chips: HTMLElement[] = [];
  private readonly resizeObserver: ResizeObserver;
  private destroyed = false;
  private trace: number[] = [];
  /** The drag in progress: the last finger position (in cells, see toCells) and the last step taken. */
  private gesture: { moved: boolean; onEnd: boolean; u: number; v: number; dir: number } | null = null;
  private cellPx = 0;
  /** Cell size the pieces were last drawn at. */
  private piecesCell = 0;
  private gapPx = 0;

  constructor(opts: LevelViewOptions) {
    this.opts = opts;
    this.s = opts.session;
    const p = this.s.puzzle;
    const art = p.def.art;

    this.progressFill = h('span', { class: 'progress-fill' });
    const top = h(
      'header',
      { class: 'lesson-top' },
      h('button', { type: 'button', class: 'icon-btn close-btn', 'aria-label': 'Back to the trail', onclick: () => opts.onClose() }, svg(ICONS.close)),
      h('div', { class: 'progress', role: 'progressbar', 'aria-label': 'Words found' }, this.progressFill),
    );

    this.heading = h(
      'div',
      { class: 'lesson-title' },
      h('p', { class: 'lesson-artist' }, `${art.artist} · ${art.year}`),
      h('h1', {}, art.title),
    );

    // The words to find, alphabetical, so their order gives nothing away.
    this.wordList = h(
      'ul',
      { class: 'word-list', 'aria-label': 'Words to find' },
      ...[...p.words]
        .sort((a, b) => a.text.localeCompare(b.text))
        .map((w) => {
          const chip = h('li', { class: 'word-chip' }, h('span', {}, w.text));
          this.chips[w.index] = chip;
          return chip;
        }),
    );

    // Board: the painting's pieces at the bottom, the letter tiles over them, then the trace shape.
    this.board = h('div', { class: 'board', role: 'grid', 'aria-label': 'Letter board' });
    this.board.style.setProperty('--rows', String(p.rows));
    this.board.style.setProperty('--cols', String(p.cols));
    for (let cell = 0; cell < p.rows * p.cols; cell++) {
      const tile = h('div', { class: p.letters[cell] === HOLE_LETTER ? 'tile is-hole' : 'tile' }, h('span', { class: 'tile-letter' }, p.letters[cell]));
      this.tiles.push(tile);
      this.board.append(tile);
    }
    this.links = document.createElementNS(SVG_NS, 'svg');
    this.links.classList.add('links');
    this.links.setAttribute('aria-hidden', 'true');
    this.pieces = new PieceLayer(artUrl(art.slug));
    this.board.append(this.pieces.el, this.links);
    this.bindPointer();

    this.traceEl = h('div', { class: 'trace', role: 'status', 'aria-live': 'polite' });
    this.boardWrap = h('div', { class: 'board-wrap' }, this.board);
    this.stage = h('div', { class: 'lesson-stage' }, this.heading, this.wordList, this.traceEl, this.boardWrap);
    this.el = h('main', { class: 'screen lesson', 'data-room': p.def.room, style: `--art: url("${artUrl(art.slug)}")` }, top, this.stage);

    this.resizeObserver = new ResizeObserver(() => this.fit());
    this.resizeObserver.observe(this.stage);
    this.render();
    if (this.s.solved) this.finish(false);
    else if (opts.intro && !reducedMotion()) {
      this.el.classList.add('is-entering', 'is-dealing');
      requestAnimationFrame(() => this.dealIn());
    }
  }

  /**
   * The level arrives: the title, then the word chips popping up one by one, then the letter tiles
   * dealt like cards from the bottom of the screen in a diagonal wave; once all are down the grid
   * gives one hop and settles.
   */
  private dealIn(): void {
    this.fit();
    const sfx = this.opts.sfx;
    const audible = navigator.userActivation?.hasBeenActive ?? true;
    const chips = [...this.wordList.children] as HTMLElement[];
    const anims: Animation[] = [];
    chips.forEach((chip, i) =>
      anims.push(
        chip.animate(
          [
            { transform: 'scale(0.3)', opacity: 0 },
            { transform: 'scale(1.14)', opacity: 1, offset: 0.6 },
            { transform: 'none', opacity: 1 },
          ],
          { duration: 360, delay: CHIP_START + i * CHIP_STEP, easing: 'cubic-bezier(0.3, 1.3, 0.5, 1)', fill: 'backwards' },
        ),
      ),
    );

    const start = CHIP_START + Math.max(2, chips.length) * CHIP_STEP;
    const cols = this.s.puzzle.cols;
    const diagonal = (cell: number) => rowOf(cell, cols) + colOf(cell, cols);
    const cards = this.tiles.map((tile, cell) => ({ tile, cell })).filter(({ tile, cell }) => !tile.classList.contains('is-hole') && this.s.ownerAt(cell) < 0);
    const viewW = window.innerWidth;
    const viewH = window.innerHeight;
    const lands: number[] = [];
    let last = start;
    cards.forEach(({ tile, cell }) => {
      const r = tile.getBoundingClientRect();
      const delay = start + diagonal(cell) * DIAG_STEP + Math.random() * CARD_JITTER;
      lands.push((delay + CARD_FLIGHT) / 1000);
      last = Math.max(last, delay + CARD_FLIGHT);
      const side = Math.random() < 0.5 ? -1 : 1;
      const dx = viewW / 2 + (Math.random() - 0.5) * 90 - (r.left + r.width / 2);
      const dy = viewH + r.height * 0.6 - r.top;
      const spin = side * (12 + Math.random() * 22);
      anims.push(
        tile.animate(
          [
            { transform: `translate(${dx}px, ${dy}px) rotate(${spin}deg) scale(1.08)`, easing: 'cubic-bezier(0.2, 0.65, 0.35, 1)' },
            { transform: 'translate(0, -6px) rotate(0deg) scale(1.06)', offset: 0.8, easing: 'cubic-bezier(0.5, 0, 0.9, 0.6)' },
            { transform: 'none' },
          ],
          { duration: CARD_FLIGHT, delay, fill: 'backwards' },
        ),
      );
    });
    const hop = last + 100;
    cards.forEach(({ tile, cell }) =>
      tile.animate(
        [{ transform: 'none' }, { transform: 'translateY(-7px) scale(1.06)', offset: 0.4 }, { transform: 'translateY(1px) scale(0.99)', offset: 0.75 }, { transform: 'none' }],
        { duration: 520, delay: hop + diagonal(cell) * HOP_STEP, easing: 'ease-in-out' },
      ),
    );
    const first = anims[0];
    if (audible && first) {
      void first.ready
        .then(() => {
          const now = Number(document.timeline.currentTime ?? 0);
          const skew = (now - Number(first.startTime ?? now)) / 1000 + sfx.latency;
          const at = (ms: number) => ms / 1000 - skew;
          sfx.pops(chips.length, at(CHIP_START + 25), CHIP_STEP / 1000);
          sfx.deal(at(start), lands.map((s) => s - skew));
          sfx.settle(at(hop));
        })
        .catch(() => undefined);
    }
    this.el.classList.remove('is-dealing');
    window.setTimeout(() => this.el.classList.remove('is-entering'), last);
  }

  destroy(): void {
    this.destroyed = true;
    this.resizeObserver.disconnect();
    this.pieces.destroy();
  }

  // ── tracing ─────────────────────────────────────────────────────────────

  /** A point on the board in cells, so that the centre of the tile at (row, col) is (col, row). */
  private toCells(x: number, y: number): { u: number; v: number } {
    const rect = this.board.getBoundingClientRect();
    const size = this.tiles[0].offsetWidth;
    const step = this.tiles[1].offsetLeft - this.tiles[0].offsetLeft;
    return { u: (x - rect.left - size / 2) / step, v: (y - rect.top - size / 2) / step };
  }

  /** The cell under a point, gaps included; -1 off the board. */
  private cellAt(x: number, y: number): number {
    const p = this.s.puzzle;
    const { u, v } = this.toCells(x, y);
    const c = Math.round(u);
    const r = Math.round(v);
    return r < 0 || c < 0 || r >= p.rows || c >= p.cols ? -1 : r * p.cols + c;
  }

  private free(cell: number): boolean {
    return cell >= 0 && this.s.ownerAt(cell) < 0 && this.s.puzzle.letters[cell] !== HOLE_LETTER;
  }

  private bindPointer(): void {
    const b = this.board;
    b.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || this.s.solved) return;
      const cell = this.cellAt(e.clientX, e.clientY);
      if (!this.free(cell)) {
        this.setTrace([]);
        return;
      }
      e.preventDefault();
      try {
        b.setPointerCapture(e.pointerId);
      } catch {
        // Synthetic pointers can't be captured; their moves still reach the board.
      }
      const tr = this.trace;
      const end = tr[tr.length - 1];
      const onEnd = cell === end && tr.length >= 2;
      if (cell === end) {
        // Keep going from the end of the trace.
      } else if (tr.length && adjacent(end, cell, this.s.puzzle.cols) && !tr.includes(cell)) {
        this.setTrace([...tr, cell]);
      } else if (tr.includes(cell)) {
        this.setTrace(tr.slice(0, tr.indexOf(cell) + 1));
      } else {
        this.setTrace([cell]);
      }
      this.gesture = { moved: false, onEnd, ...this.toCells(e.clientX, e.clientY), dir: 0 };
    });

    // The trace follows the finger's motion (see steer), with the stretches between samples filled in.
    b.addEventListener('pointermove', (e) => {
      const g = this.gesture;
      if (!g) return;
      const { rows, cols } = this.s.puzzle;
      const free = (cell: number) => this.free(cell);
      let state = { trace: this.trace, dir: g.dir };
      const seen = e.getCoalescedEvents?.() ?? [];
      for (const ev of seen.length ? seen : [e]) {
        const { u, v } = this.toCells(ev.clientX, ev.clientY);
        const n = Math.max(1, Math.ceil(Math.hypot(u - g.u, v - g.v) / SAMPLE));
        for (let i = 1; i <= n; i++) state = steer(state, g.u + ((u - g.u) * i) / n, g.v + ((v - g.v) * i) / n, rows, cols, free);
        g.u = u;
        g.v = v;
      }
      g.dir = state.dir;
      if (state.trace !== this.trace) {
        g.moved = true;
        this.setTrace(state.trace);
      }
    });

    const finish = (cancelled: boolean) => {
      const g = this.gesture;
      this.gesture = null;
      if (!g || cancelled) return;
      // A drag that ran one tile past a word still counts as the word.
      const short = this.trace.slice(0, -1);
      if (g.moved && short.length > 1 && matchTrace(this.s.puzzle, this.trace) < 0 && matchTrace(this.s.puzzle, short) >= 0) this.trace = short;
      if (matchTrace(this.s.puzzle, this.trace) >= 0 || (g.moved && this.trace.length > 1) || g.onEnd) this.submit();
    };
    b.addEventListener('pointerup', () => finish(false));
    b.addEventListener('pointercancel', () => finish(true));
  }

  private setTrace(next: number[]): void {
    if (next.length > this.trace.length) this.opts.sfx.tick(next.length);
    this.trace = next;
    this.render();
  }

  private submit(): void {
    const trace = this.trace;
    this.trace = [];
    if (trace.length < 2) {
      this.render();
      return;
    }
    const letters = trace.map((c) => this.s.puzzle.letters[c]).join('');
    const result = this.s.submit(trace);
    if (result.kind === 'miss') {
      this.opts.sfx.nope();
      buzz(30);
      trace.forEach((c) => replay(this.tiles[c], 'miss'));
      this.showTrace(letters, 'is-miss');
      this.render();
      return;
    }
    const { word } = result;
    const calm = reducedMotion();
    if (!calm) this.flyTiles(word);
    this.render();
    this.pieces.add(word.index, word.path, calm ? undefined : word.path.map((c) => this.s.puzzle.letters[c]));
    this.showTrace(word.text, 'is-found');
    this.opts.sfx.piece(word.path.length, STAGGER_MS);
    buzz(15);
    const settle = calm ? 0 : Math.max((word.path.length - 1) * STAGGER_MS + FLIGHT_MS, paintDuration(word.path.length));
    if (result.solved) window.setTimeout(() => this.celebrate(), Math.max(0, settle - 150));
  }

  /** Copies of the found word's tiles fly from the board to its chip, each on its own spinning arc. */
  private flyTiles(word: Word): void {
    const chip = this.chips[word.index];
    const to = chip.getBoundingClientRect();
    const tx = to.left + to.width / 2;
    const ty = to.top + to.height / 2;
    this.flying.add(word.index);
    const anims = word.path.map((c, i) => {
      const tile = this.tiles[c];
      const from = tile.getBoundingClientRect();
      const copy = tile.cloneNode(true) as HTMLElement;
      copy.className = 'tile fly-tile';
      copy.querySelector('.tile-letter')?.remove();
      copy.setAttribute('aria-hidden', 'true');
      Object.assign(copy.style, { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px` });
      // Out on the page the copy no longer inherits the board's cell size, which its rounded corners
      // and its pressable edge are measured in.
      copy.style.setProperty('--cell', `${this.cellPx}px`);
      document.body.append(copy);
      const dx = tx - (from.left + from.width / 2);
      const dy = ty - (from.top + from.height / 2);
      const side = Math.random() < 0.5 ? -1 : 1;
      const len = Math.hypot(dx, dy) || 1;
      const bow = (50 + Math.random() * 80) * side;
      const cx = dx / 2 + (-dy / len) * bow;
      const cy = dy / 2 + (dx / len) * bow - 40;
      const spin = side * (120 + Math.random() * 160);
      const tilt = side * (4 + Math.random() * 5);
      // The tile keeps its pressable edge in flight; a soft drop shadow grows as it lifts off.
      const own = getComputedStyle(tile).boxShadow;
      const edge = own === 'none' ? '0 0 0 transparent' : own;
      const lifted = `${edge}, 0 14px 18px rgb(45 35 80 / 0.22)`;
      const frames: Keyframe[] = [
        { transform: 'translate(0, 0) rotate(0deg) scale(1)', boxShadow: `${edge}, 0 0 0 rgb(45 35 80 / 0)`, opacity: 1, offset: 0 },
        { transform: `translate(0, -10px) rotate(${tilt}deg) scale(1.14)`, boxShadow: lifted, opacity: 1, offset: 0.16 },
      ];
      for (let k = 1; k <= 6; k++) {
        const t = k / 6;
        const x = 2 * (1 - t) * t * cx + t * t * dx;
        const y = 2 * (1 - t) * t * cy + t * t * dy - 10 * (1 - t);
        frames.push({ transform: `translate(${x}px, ${y}px) rotate(${tilt + spin * t ** 1.4}deg) scale(${1.14 - 0.86 * t})`, boxShadow: lifted, opacity: t < 0.75 ? 1 : 1 - (t - 0.75) * 3.2, offset: 0.16 + 0.84 * t });
      }
      const anim = copy.animate(frames, { duration: FLIGHT_MS, delay: i * STAGGER_MS, easing: 'cubic-bezier(0.35, 0, 0.45, 1)', fill: 'both' });
      anim.finished.then(() => copy.remove(), () => copy.remove());
      return anim;
    });
    anims[anims.length - 1].finished.then(() => {
      this.flying.delete(word.index);
      this.render();
      replay(chip, 'pop');
      const { x, y } = centreOf(chip);
      sparkles(x, y, 7, 38);
      this.opts.sfx.found();
    });
  }

  // ── the end ─────────────────────────────────────────────────────────────

  private celebrate(): void {
    if (this.destroyed) return;
    this.opts.sfx.win();
    buzz([20, 60, 30]);
    this.finish(true);
    const r = this.board.getBoundingClientRect();
    confetti(r.left + r.width / 2, r.top + r.height * 0.4);
  }

  /** The whole painting shows on the board, the chips and title make way, and the banner rises. */
  private finish(animate: boolean): void {
    this.board.classList.add('is-complete');
    this.el.classList.add('is-complete');
    this.pieces.showWhole((cell) => this.s.ownerAt(cell), animate);
    const art = this.s.puzzle.def.art;
    const banner = h(
      'section',
      { class: 'result-banner' },
      h(
        'div',
        { class: 'result-text' },
        h('span', { class: 'result-badge' }, svg(ICONS.check)),
        h('div', {}, h('h2', {}, 'Painting restored!'), h('p', {}, h('b', {}, '+1 ★'), ` ${art.title}`)),
      ),
      h('button', { type: 'button', class: 'btn btn-green btn-block', onclick: () => this.opts.onContinue() }, 'Continue'),
    );
    if (animate) {
      banner.classList.add('is-rising');
      this.opts.sfx.slide();
    }
    window.setTimeout(() => {
      if (this.destroyed) return;
      const before = this.board.getBoundingClientRect();
      this.el.append(banner);
      // The word list and trace make way, and the framed painting glides to its place above the banner.
      this.el.style.setProperty('--banner-h', `${banner.offsetHeight + 12}px`);
      this.el.classList.add('is-framed');
      const after = this.board.getBoundingClientRect();
      if (animate) this.board.animate([{ translate: `${before.left - after.left}px ${before.top - after.top}px` }, { translate: '0 0' }], { duration: 550, easing: 'cubic-bezier(0.3, 1.15, 0.5, 1)' });
    }, animate ? 900 : 0);
  }

  // ── rendering ───────────────────────────────────────────────────────────

  /** The word being traced (or the last result) above the board. */
  private showTrace(text: string, state = ''): void {
    const pill = h('span', { class: `trace-pill ${state}` }, text);
    this.traceEl.replaceChildren(pill);
    if (!state) return;
    replay(pill, 'is-new');
    window.setTimeout(() => {
      if (pill.isConnected && !this.trace.length) this.traceEl.replaceChildren();
    }, 1200);
  }

  private render(): void {
    const p = this.s.puzzle;
    const traced = new Set(this.trace);
    const end = this.trace[this.trace.length - 1];
    this.tiles.forEach((tile, cell) => {
      tile.classList.toggle('is-found', this.s.ownerAt(cell) >= 0);
      tile.classList.toggle('is-trace', traced.has(cell));
      tile.classList.toggle('is-end', cell === end && this.trace.length > 0);
    });
    if (this.trace.length) this.showTrace(this.trace.map((c) => p.letters[c]).join(''));
    else if (!this.traceEl.querySelector('.is-found, .is-miss')) this.traceEl.replaceChildren();
    this.board.classList.toggle('is-tracing', this.trace.length > 0);
    p.words.forEach((w) => this.chips[w.index].classList.toggle('is-found', this.s.isFound(w.index) && !this.flying.has(w.index)));
    this.progressFill.style.width = `${(100 * this.s.foundCount) / p.words.length}%`;
    this.drawTrace();
  }

  /** The word being traced: its tiles join into one gold shape (the shape its piece will take). */
  private drawTrace(): void {
    const p = this.s.puzzle;
    if (!this.trace.length) {
      this.links.replaceChildren();
      return;
    }
    const d = pieceOutline(this.trace, p.cols, this.cellPx, this.gapPx, this.cellPx * 0.24);
    const shape = (cls: string) => {
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('class', cls);
      path.setAttribute('d', d);
      return path;
    };
    this.links.replaceChildren(shape('trace-shadow'), shape('trace-shape'));
  }

  /** Sizes cells to the space the stage leaves the board once the title, words and trace are in. */
  private fit(): void {
    const p = this.s.puzzle;
    const cs = getComputedStyle(this.boardWrap);
    const ss = getComputedStyle(this.stage);
    const above = this.heading.offsetHeight + this.wordList.offsetHeight + this.traceEl.offsetHeight;
    const width = this.stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const height = this.stage.clientHeight - parseFloat(ss.paddingTop) - parseFloat(ss.paddingBottom) - above - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const u = unit();
    const gap = Math.round((width < 480 * u ? 6 : 8) * u);
    const byWidth = (width - gap * (p.cols - 1)) / p.cols;
    const byHeight = (height - 8 * u - gap * (p.rows - 1)) / p.rows;
    let size = Math.max(Math.round(34 * u), Math.min(Math.round(84 * u), Math.floor(Math.min(byWidth, byHeight))));
    // Once framed, the painting keeps its size (the words making way would otherwise grow it).
    if (this.el.classList.contains('is-framed') && this.cellPx) size = Math.min(size, this.cellPx);
    this.cellPx = size;
    this.gapPx = gap;
    this.el.style.setProperty('--cell', `${size}px`);
    this.el.style.setProperty('--gap', `${gap}px`);
    const w = p.cols * size + (p.cols - 1) * gap;
    const hgt = p.rows * size + (p.rows - 1) * gap;
    this.links.setAttribute('viewBox', `0 0 ${w} ${hgt}`);
    this.links.setAttribute('width', String(w));
    this.links.setAttribute('height', String(hgt));
    if (size !== this.piecesCell) {
      this.piecesCell = size;
      this.pieces.setLayout({ rows: p.rows, cols: p.cols, cell: size, gap });
      for (const word of p.words) if (this.s.isFound(word.index)) this.pieces.add(word.index, word.path);
      if (this.board.classList.contains('is-complete')) this.pieces.showWhole((cell) => this.s.ownerAt(cell), false);
    }
    this.drawTrace();
  }
}
