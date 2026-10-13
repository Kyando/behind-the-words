import { colOf, rowOf } from '../core/grid.ts';

/**
 * The outline of a set of cells joined into one piece: neighbouring cells merge across the gap
 * between them, and every corner is rounded by `radius` (inner corners too). Returns SVG path data,
 * one closed loop per boundary (a piece that encloses a cell gets a second loop; draw it with
 * `fill-rule: evenodd`).
 */
export function pieceOutline(cells: readonly number[], cols: number, cell: number, gap: number, radius: number): string {
  const mine = new Set(cells);
  const has = (r: number, c: number) => c >= 0 && c < cols && r >= 0 && mine.has(r * cols + c);
  const step = cell + gap;

  // Boundary edges on the grid's corner lattice, walked clockwise (interior on the right). Each also
  // knows where it lies in pixels: a cell's left/top side sits at its own start, right/bottom at its end.
  interface Edge {
    from: string;
    to: string;
    vertical: boolean;
    at: number;
    dir: string;
  }
  const edges = new Map<string, Edge[]>();
  const add = (fx: number, fy: number, tx: number, ty: number, vertical: boolean, at: number) => {
    const e: Edge = { from: `${fx},${fy}`, to: `${tx},${ty}`, vertical, at, dir: `${Math.sign(tx - fx)},${Math.sign(ty - fy)}` };
    const list = edges.get(e.from) ?? [];
    list.push(e);
    edges.set(e.from, list);
  };
  for (const c of mine) {
    const r = rowOf(c, cols);
    const k = colOf(c, cols);
    if (!has(r - 1, k)) add(k, r, k + 1, r, false, r * step);
    if (!has(r, k + 1)) add(k + 1, r, k + 1, r + 1, true, k * step + cell);
    if (!has(r + 1, k)) add(k + 1, r + 1, k, r + 1, false, r * step + cell);
    if (!has(r, k - 1)) add(k, r + 1, k, r, true, k * step);
  }

  let d = '';
  for (;;) {
    const start = [...edges.values()].find((l) => l.length)?.[0];
    if (!start) break;
    // Chain the loop.
    const loop: Edge[] = [];
    let e: Edge | undefined = start;
    while (e) {
      const list = edges.get(e.from)!;
      list.splice(list.indexOf(e), 1);
      loop.push(e);
      const next: Edge[] = edges.get(e.to) ?? [];
      e = next.length ? next[0] : undefined;
    }
    // A corner wherever the boundary turns: the vertical edge gives x, the horizontal one y.
    const corners: [number, number][] = [];
    for (let i = 0; i < loop.length; i++) {
      const a = loop[i];
      const b = loop[(i + 1) % loop.length];
      if (a.dir === b.dir) continue;
      corners.push(a.vertical ? [a.at, b.at] : [b.at, a.at]);
    }
    const n = corners.length;
    const toward = (p: [number, number], q: [number, number], len: number): [number, number] => {
      const dist = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
      const t = Math.min(len, dist / 2) / dist;
      return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
    };
    const fmt = (p: [number, number]) => `${+p[0].toFixed(2)},${+p[1].toFixed(2)}`;
    for (let i = 0; i < n; i++) {
      const prev = corners[(i - 1 + n) % n];
      const cur = corners[i];
      const next = corners[(i + 1) % n];
      const enter = toward(cur, prev, radius);
      const leave = toward(cur, next, radius);
      d += `${i === 0 ? 'M' : 'L'}${fmt(enter)}Q${fmt(cur)} ${fmt(leave)}`;
    }
    d += 'Z';
  }
  return d;
}
