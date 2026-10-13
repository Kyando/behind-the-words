import { neighbors, turns } from './grid.ts';
import { HOLE_LETTER, validateLevel } from './puzzle.ts';
import type { ArtDef, LevelDef, WordDef } from './types.ts';

/** What a level contains; the generator decides where the words go. */
export interface LevelSpec {
  id: string;
  room: string;
  rows: number;
  cols: number;
  /** The words to find, all things you can see in the painting; their letters must add up to rows * cols. */
  words: string[];
  art: ArtDef;
  /** Cells left empty, for boards that aren't a full rectangle. */
  holes?: number[];
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

/** Random self-avoiding walks of `length` empty cells starting at `start`. */
function randomPaths(start: number, length: number, owner: Int16Array, rows: number, cols: number, rng: () => number, max: number): number[][] {
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
    for (const next of shuffle(neighbors(path[path.length - 1], rows, cols), rng)) {
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
 * Fills the first empty cell each step, so dead ends show up early.
 */
function tile(lengths: number[], rows: number, cols: number, holes: number[], rng: () => number): number[][] | null {
  const n = rows * cols;
  const owner = new Int16Array(n).fill(-1);
  for (const h of holes) owner[h] = HOLE;
  const paths: (number[] | null)[] = lengths.map(() => null);
  let budget = 4000;

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
    for (const i of shuffle(lengths.map((_, k) => k).filter((k) => !paths[k]), rng)) {
      for (const cells of randomPaths(start, lengths[i], owner, rows, cols, rng, 6)) {
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

  return place() ? (paths as number[][]) : null;
}

/** Bendier boards feel more like Tetris: reward turns, and a little variety in shapes. */
function score(def: LevelDef): number {
  const bent = def.words.filter((w) => turns(w.path) > 0).length;
  return def.words.reduce((sum, w) => sum + Math.min(turns(w.path), 3), 0) + bent * 2;
}

/** Best of `attempts` random valid layouts, or null if none passed validation. */
export function generateLevel(spec: LevelSpec, seed: number, attempts = 400): LevelDef | null {
  const { rows, cols } = spec;
  const texts = spec.words.map((w) => w.toUpperCase());
  const total = texts.reduce((s, t) => s + t.length, 0);
  const holes = spec.holes ?? [];
  if (total !== rows * cols - holes.length) throw new Error(`${spec.id}: words have ${total} letters for ${rows * cols - holes.length} cells`);

  const rng = mulberry32(seed);
  let best: LevelDef | null = null;
  let bestScore = -Infinity;
  for (let i = 0; i < attempts; i++) {
    const paths = tile(texts.map((t) => t.length), rows, cols, holes, rng);
    if (!paths) continue;
    const words: WordDef[] = texts.map((text, k) => ({ text, path: paths[k] }));
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
