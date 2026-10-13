import { colOf, rowOf } from '../core/grid.ts';
import { pieceOutline } from './shape.ts';

const SVG_NS = 'http://www.w3.org/2000/svg';
let uid = 0;

/** The paint's timing (ms): letters melt one after another, the colour spreads, then a light line traces the piece. */
export const PAINT_STAGGER_MS = 65;
const MELT_MS = 560;
const SPREAD_MS = 820;
const LINE_MS = 460;
const lineDelay = (letters: number) => (letters - 1) * PAINT_STAGGER_MS + 420;
/** How long a word's paint takes to settle completely. */
export const paintDuration = (letters: number) => lineDelay(letters) + LINE_MS;

const el = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] => {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
};

/** A paint splash's outline: a ragged ring of bumps around (x, y), drawn as one smooth path. */
function splashPath(x: number, y: number, r: number): string {
  const n = 13;
  const pts = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.25;
    const reach = r * (0.78 + Math.random() * 0.34);
    return [x + Math.cos(a) * reach, y + Math.sin(a) * reach];
  });
  const mid = (i: number) => {
    const [ax, ay] = pts[i % n];
    const [bx, by] = pts[(i + 1) % n];
    return [(ax + bx) / 2, (ay + by) / 2];
  };
  const f = (v: number) => v.toFixed(1);
  let d = `M${f(mid(0)[0])},${f(mid(0)[1])}`;
  for (let i = 1; i <= n; i++) {
    const [cx, cy] = pts[i % n];
    const [mx, my] = mid(i);
    d += `Q${f(cx)},${f(cy)} ${f(mx)},${f(my)}`;
  }
  return d + 'Z';
}

interface Layout {
  rows: number;
  cols: number;
  cell: number;
  gap: number;
}

/**
 * The painting, as pieces, under the letter tiles: each found word is one joined shape of the
 * painting, in full colour, separated from its neighbours by the board's gaps, so the board fills up
 * like a puzzle being assembled. Once every word is found the painting shows whole, in a gold frame,
 * with faint seams still showing the pieces it was made of.
 */
export class PieceLayer {
  readonly el: SVGSVGElement;
  /** The picture's address; a local copy once it has downloaded, so pieces show it at once. */
  private href: string;
  private blobUrl: string | null = null;
  private destroyed = false;
  private readonly id = `pieces-${++uid}`;
  private readonly defs: SVGDefsElement;
  private readonly piecesG: SVGGElement;
  private readonly wholeG: SVGGElement;
  /** Drawn pieces, by word index. */
  private readonly drawn = new Map<number, SVGGElement>();
  private layout: Layout | null = null;
  /** Settles once the picture is ready to show, or has failed to load. */
  readonly loaded: Promise<void>;

  constructor(image: string) {
    this.href = image;
    this.loaded = fetch(image)
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
      .then((blob) => {
        if (this.destroyed) return;
        this.blobUrl = URL.createObjectURL(blob);
        this.href = this.blobUrl;
        this.el.querySelectorAll('image').forEach((n) => n.setAttribute('href', this.href));
      })
      .catch(() => undefined);
    this.el = el('svg', { class: 'pieces', 'aria-hidden': 'true' });
    this.defs = el('defs');
    this.piecesG = el('g');
    this.wholeG = el('g', { class: 'pieces-whole' });
    this.el.append(this.defs, this.piecesG, this.wholeG);
  }

  /** The picture's address: the local copy once it has downloaded. */
  get picture(): string {
    return this.href;
  }

  destroy(): void {
    this.destroyed = true;
    if (this.blobUrl) URL.revokeObjectURL(this.blobUrl);
  }

  /** Sizes the layer to the board. Clears it: the caller redraws what's found, without animation. */
  setLayout(layout: Layout): void {
    this.layout = layout;
    const { rows, cols, cell, gap } = layout;
    const w = cols * cell + (cols - 1) * gap;
    const h = rows * cell + (rows - 1) * gap;
    this.el.setAttribute('viewBox', `0 0 ${w} ${h}`);
    this.el.setAttribute('width', String(w));
    this.el.setAttribute('height', String(h));
    this.clear();
  }

  /** Removes every piece and the finished picture (a restart). */
  clear(): void {
    this.drawn.forEach((g) => g.remove());
    this.drawn.clear();
    this.defs.querySelectorAll('clipPath, mask').forEach((c) => c.remove());
    this.wholeG.replaceChildren();
    this.el.classList.remove('is-whole');
  }

  /**
   * Draws word `index` as one piece: its cells joined across the gaps between them. With `letters`,
   * the word arrives as paint: each letter, left behind by its tile, melts into the canvas and the
   * colour splashes out from where it fell; last, a light line goes once round the piece.
   */
  add(index: number, path: number[], letters?: string[]): void {
    if (!this.layout || this.drawn.has(index)) return;
    const { cols, cell, gap } = this.layout;
    const d = pieceOutline(path, cols, cell, gap, cell * 0.2);
    const clipId = `${this.id}-clip-${index}`;
    const clip = el('clipPath', { id: clipId });
    clip.append(el('path', { d }));
    this.defs.append(clip);

    const g = el('g', { class: 'piece' });
    const base = el('path', { class: 'piece-base', d });
    const pic = el('g', { 'clip-path': `url(#${clipId})` });
    const image = el('image', { class: 'piece-pic', href: this.href, x: 0, y: 0, width: '100%', height: '100%', preserveAspectRatio: 'xMidYMid slice' });
    pic.append(image);
    const line = el('path', { class: 'piece-line', d });
    g.append(base, pic, line);
    this.piecesG.append(g);
    this.drawn.set(index, g);
    if (letters) this.paintIn(g, image, line, path, letters);
  }

  /** The paint arriving (see add). Leaves the piece exactly as a plain add() draws it. */
  private paintIn(g: SVGGElement, image: SVGImageElement, line: SVGPathElement, path: number[], letters: string[]): void {
    const { cols, cell, gap } = this.layout!;
    const step = cell + gap;
    const center = (c: number) => [colOf(c, cols) * step + cell / 2, rowOf(c, cols) * step + cell / 2];
    const temp: Element[] = [];
    const at = (i: number) => i * PAINT_STAGGER_MS;

    // The colour's reach: a splash per letter, growing from where it fell.
    const maskId = `${this.id}-paint-${++uid}`;
    const mask = el('mask', { id: maskId, maskUnits: 'userSpaceOnUse', x: -cell, y: -cell, width: '200%', height: '200%' });
    const splashes = el('g');
    mask.append(splashes);
    this.defs.append(mask);
    temp.push(mask);
    path.forEach((c, i) => {
      const [x, y] = center(c);
      const splash = el('path', { class: 'paint-splash', d: splashPath(x, y, cell * 1.02), fill: '#fff' });
      splashes.append(splash);
      splash.animate(
        [
          { transform: 'scale(0)', offset: 0 },
          { transform: 'scale(0.5)', offset: 0.2 },
          { transform: 'scale(1)', offset: 1 },
        ],
        { duration: SPREAD_MS, delay: at(i) + 120, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)', fill: 'both' },
      );
    });
    image.setAttribute('mask', `url(#${maskId})`);
    // The colour comes in bright and settles.
    image.animate([{ filter: 'saturate(1.6) brightness(1.25)' }, { filter: 'none' }], { duration: SPREAD_MS + path.length * PAINT_STAGGER_MS, easing: 'ease-out' });

    // The letters, left on the canvas by their tiles: each swells as it soaks in, and fades.
    const ink = el('g', { class: 'piece-letters' });
    g.insertBefore(ink, line);
    temp.push(ink);
    path.forEach((c, i) => {
      const [x, y] = center(c);
      const letter = el('text', { class: 'piece-letter', x, y, 'font-size': cell * 0.5 });
      letter.textContent = letters[i];
      ink.append(letter);
      letter.animate(
        [
          { opacity: 1, transform: 'scale(1)' },
          { opacity: 0.85, transform: 'scale(1.15)', offset: 0.35 },
          { opacity: 0, transform: 'scale(1.5)' },
        ],
        { duration: MELT_MS, delay: at(i) + 40, easing: 'ease-in', fill: 'both' },
      );
    });

    const length = line.getTotalLength();
    line.style.strokeDasharray = `${length}`;
    const pen = line.animate([{ strokeDashoffset: length }, { strokeDashoffset: 0 }], {
      duration: LINE_MS,
      delay: lineDelay(path.length),
      easing: 'cubic-bezier(0.45, 0, 0.3, 1)',
      fill: 'both',
    });
    pen.finished.then(() => {
      image.removeAttribute('mask');
      line.style.strokeDasharray = '';
      pen.cancel();
      temp.forEach((node) => node.remove());
    }, () => undefined);
  }

  /** The finished painting: whole, with faint seams where different words meet. */
  showWhole(owner: (cell: number) => number, animate: boolean): void {
    if (!this.layout) return;
    const { rows, cols, cell, gap } = this.layout;
    const step = cell + gap;
    const half = gap / 2;
    let d = '';
    for (let c = 0; c < rows * cols; c++) {
      const x = colOf(c, cols) * step;
      const y = rowOf(c, cols) * step;
      if (colOf(c, cols) < cols - 1 && owner(c) !== owner(c + 1)) d += `M${x + cell + half},${y - half}V${y + cell + half}`;
      if (rowOf(c, cols) < rows - 1 && owner(c) !== owner(c + cols)) d += `M${x - half},${y + cell + half}H${x + cell + half}`;
    }
    this.wholeG.replaceChildren(
      el('image', { href: this.href, x: 0, y: 0, width: '100%', height: '100%', preserveAspectRatio: 'xMidYMid slice' }),
      el('path', { class: 'pieces-seams', d }),
    );
    this.el.classList.add('is-whole');
    this.el.classList.toggle('no-anim', !animate);
  }
}
