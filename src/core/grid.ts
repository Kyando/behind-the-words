/** Grid geometry. Cells are indexed row * cols + col; words only bend orthogonally. */

export const rowOf = (cell: number, cols: number): number => Math.floor(cell / cols);
export const colOf = (cell: number, cols: number): number => cell % cols;

export function neighbors(cell: number, rows: number, cols: number): number[] {
  const r = rowOf(cell, cols);
  const c = colOf(cell, cols);
  const out: number[] = [];
  if (r > 0) out.push(cell - cols);
  if (r < rows - 1) out.push(cell + cols);
  if (c > 0) out.push(cell - 1);
  if (c < cols - 1) out.push(cell + 1);
  return out;
}

export function adjacent(a: number, b: number, cols: number): boolean {
  return Math.abs(rowOf(a, cols) - rowOf(b, cols)) + Math.abs(colOf(a, cols) - colOf(b, cols)) === 1;
}

/** Distinct, in-bounds cells where each step moves to an orthogonal neighbour. */
export function isPath(path: number[], rows: number, cols: number): boolean {
  if (new Set(path).size !== path.length) return false;
  if (path.some((c) => !Number.isInteger(c) || c < 0 || c >= rows * cols)) return false;
  return path.every((c, i) => i === 0 || adjacent(path[i - 1], c, cols));
}

/** Number of direction changes along a path: 0 for a straight word. */
export function turns(path: number[]): number {
  let count = 0;
  for (let i = 2; i < path.length; i++) {
    if (path[i] - path[i - 1] !== path[i - 1] - path[i - 2]) count++;
  }
  return count;
}

/** Every path in `letters` (flat, rows * cols) spelling `word`, read from first letter to last. */
export function findPaths(letters: string, rows: number, cols: number, word: string): number[][] {
  const found: number[][] = [];
  const path: number[] = [];
  const used = new Set<number>();
  const walk = (cell: number) => {
    if (letters[cell] !== word[path.length]) return;
    path.push(cell);
    used.add(cell);
    if (path.length === word.length) found.push([...path]);
    else for (const next of neighbors(cell, rows, cols)) if (!used.has(next)) walk(next);
    path.pop();
    used.delete(cell);
  };
  for (let cell = 0; cell < letters.length; cell++) walk(cell);
  return found;
}
