import { colOf, neighbors, rowOf, turns } from './grid.ts';
import { HOLE_LETTER, validateLevel } from './puzzle.ts';
import type { Area, ArtDef, LevelDef, WordDef } from './types.ts';

/** What a level contains; the generator decides where the words go. */
export interface LevelSpec {
  id: string;
  room: string;
  rows: number;
  cols: number;
  /** The words to find, each a thing you can see in the painting and where it is on the board;
   *  their letters must add up to rows * cols. */
  words: SpecWord[];
  art: ArtDef;
  /** Picks another of the generator's layouts, once one has been chosen by eye (default 0). */
  seed?: number;
  /** Cells left empty, for boards that aren't a full rectangle. */
  holes?: number[];
}

export interface SpecWord {
  text: string;
  /** The cells the thing covers on this board (see board-grid.ts to read them off the picture). */
  at: Area;
}

/** Steps from a cell to the nearest cell of an area (0 inside it). */
export function distance(cell: number, cols: number, [r0, c0, r1, c1]: Area): number {
  const r = rowOf(cell, cols);
  const c = colOf(cell, cols);
  return Math.max(r0 - r, 0, r - r1) + Math.max(c0 - c, 0, c - c1);
}

/**
 * How well a word sits on its thing, 0 to 1: its letters over the area, out of as many as could be
 * (the whole word for a big area, the whole area for a small one, like a pearl under a long word).
 */
export function fit(path: number[], cols: number, at: Area): number {
  const size = (at[2] - at[0] + 1) * (at[3] - at[1] + 1);
  return path.filter((c) => distance(c, cols, at) === 0).length / Math.min(path.length, size);
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Self-avoiding walks of `length` empty cells from `start`, leaning towards `at`. */
function randomPaths(start: number, length: number, owner: Int16Array, rows: number, cols: number, rng: () => number, max: number, at: Area): number[][] {
  const out: number[][] = [];
  const path = [start];
  const used = new Set(path);
  let budget = 400;
  const walk = () => {
    if (out.length >= max || --budget < 0) return;
    if (path.length === length) {
      out.push([...path]);
      return;
    }
    const steps = neighbors(path[path.length - 1], rows, cols).map((c) => ({ c, d: distance(c, cols, at) + rng() * 1.5 }));
    for (const { c: next } of steps.sort((a, b) => a.d - b.d)) {
      if (owner[next] >= 0 || used.has(next)) continue;
      path.push(next);
      used.add(next);
      walk();
      path.pop();
      used.delete(next);
    }
  };
  walk();
  return out;
}

/** Marks a hole as taken, so no word is laid through it. */
const HOLE = 0x7fff;

/** Can `size` be written as a sum of some of `lengths`? */
function subsetSum(lengths: number[], size: number): boolean {
  const ok = new Array<boolean>(size + 1).fill(false);
  ok[0] = true;
  for (const len of lengths) for (let s = size; s >= len; s--) ok[s] ||= ok[s - len];
  return ok[size];
}

/**
 * Tiles the grid with one path per word. Only shapes here; letters come later.
 * First the words with the tightest areas (small things, like a pearl) are laid straight onto them;
 * then the rest of the board is filled from its first empty cell, so dead ends show up early.
 */
function tile(lengths: number[], areas: Area[], rows: number, cols: number, holes: number[], rng: () => number): number[][] | null {
  const n = rows * cols;
  const owner = new Int16Array(n).fill(-1);
  for (const h of holes) owner[h] = HOLE;
  const paths: (number[] | null)[] = lengths.map(() => null);
  let budget = 4000;
  const cellsOf = ([r0, c0, r1, c1]: Area) => {
    const out: number[] = [];
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) out.push(r * cols + c);
    return out;
  };

  // Every empty region must be fillable by some of the remaining words.
  const feasible = (): boolean => {
    const remaining = lengths.filter((_, i) => !paths[i]);
    const seen = new Uint8Array(n);
    for (let start = 0; start < n; start++) {
      if (owner[start] >= 0 || seen[start]) continue;
      let size = 0;
      const stack = [start];
      seen[start] = 1;
      while (stack.length) {
        const c = stack.pop()!;
        size++;
        for (const x of neighbors(c, rows, cols)) {
          if (owner[x] < 0 && !seen[x]) {
            seen[x] = 1;
            stack.push(x);
          }
        }
      }
      if (!subsetSum(remaining, size)) return false;
    }
    return true;
  };

  const place = (): boolean => {
    if (--budget < 0) return false;
    const start = owner.indexOf(-1);
    if (start < 0) return true;
    // The words whose things are here (or nearest) are tried first.
    const order = shuffle(lengths.map((_, k) => k).filter((k) => !paths[k]), rng).sort((a, b) => distance(start, cols, areas[a]) - distance(start, cols, areas[b]));
    for (const i of order) {
      for (const cells of randomPaths(start, lengths[i], owner, rows, cols, rng, 6, areas[i])) {
        cells.forEach((c) => (owner[c] = i));
        // The walk starts on the top-left-most empty cell; reading it backwards doubles the shapes.
        paths[i] = rng() < 0.5 ? cells : [...cells].reverse();
        if (feasible() && place()) return true;
        cells.forEach((c) => (owner[c] = -1));
        paths[i] = null;
        if (budget < 0) return false;
      }
    }
    return false;
  };

  // Tight words first: a random number of them (up to all), smallest area per letter first, each onto its thing.
  const tight = lengths
    .map((len, i) => ({ i, room: cellsOf(areas[i]).length / len + rng() * 0.8 }))
    .sort((a, b) => a.room - b.room)
    .slice(0, Math.floor(rng() * (lengths.length + 1)));
  for (const { i } of tight) {
    const starts = shuffle(cellsOf(areas[i]).filter((c) => owner[c] < 0), rng).slice(0, 8);
    let laid = false;
    for (const start of starts) {
      for (const cells of randomPaths(start, lengths[i], owner, rows, cols, rng, 4, areas[i])) {
        if (fit(cells, cols, areas[i]) < 0.6) continue;
        cells.forEach((c) => (owner[c] = i));
        paths[i] = cells;
        if (feasible()) {
          laid = true;
          break;
        }
        cells.forEach((c) => (owner[c] = -1));
        paths[i] = null;
      }
      if (laid) break;
    }
  }

  return place() ? (paths as number[][]) : null;
}

/**
 * Words over their things first, by far, with the worst-placed word counting most (one word lost
 * away from its thing reads worse than all of them a little off); then bendier boards, which feel
 * more like Tetris.
 */
function score(def: LevelDef): number {
  const bent = def.words.filter((w) => turns(w.path) > 0).length;
  const fits = def.words.map((w) => fit(w.path, def.cols, w.at!));
  const over = fits.reduce((sum, f) => sum + f, 0) + Math.min(...fits) * def.words.length * 0.6;
  return over * 100 + def.words.reduce((sum, w) => sum + Math.min(turns(w.path), 3), 0) + bent * 2;
}

/**
 * Best of `attempts` random valid layouts, or null if none passed validation. While some word still
 * covers less than half of its thing, it keeps looking, up to four times as long.
 */
export function generateLevel(spec: LevelSpec, seed: number, attempts = 2500): LevelDef | null {
  const { rows, cols } = spec;
  const texts = spec.words.map((w) => w.text.toUpperCase());
  const areas = spec.words.map((w) => w.at);
  const total = texts.reduce((s, t) => s + t.length, 0);
  const holes = spec.holes ?? [];
  if (total !== rows * cols - holes.length) throw new Error(`${spec.id}: words have ${total} letters for ${rows * cols - holes.length} cells`);

  const rng = mulberry32(seed);
  let best: LevelDef | null = null;
  let bestScore = -Infinity;
  const worst = (def: LevelDef) => Math.min(...def.words.map((w) => fit(w.path, cols, w.at!)));
  for (let i = 0; i < attempts * 4 && (i < attempts || !best || worst(best) < 0.5); i++) {
    const paths = tile(texts.map((t) => t.length), areas, rows, cols, holes, rng);
    if (!paths) continue;
    const words: WordDef[] = texts.map((text, k) => ({ text, path: paths[k], at: areas[k] }));
    const letters = new Array<string>(rows * cols).fill(HOLE_LETTER);
    words.forEach((w) => w.path.forEach((cell, k) => (letters[cell] = w.text[k])));
    const def: LevelDef = {
      id: spec.id,
      room: spec.room,
      rows,
      cols,
      grid: Array.from({ length: rows }, (_, r) => letters.slice(r * cols, (r + 1) * cols).join('')),
      words,
      art: spec.art,
    };
    if (validateLevel(def).length) continue;
    const s = score(def) + rng();
    if (s > bestScore) {
      best = def;
      bestScore = s;
    }
  }
  return best;
}
