import { colOf, rowOf } from './grid.ts';

/**
 * Turns a dragging finger into a trace by its motion rather than the tile under it: once the finger
 * is half a cell past the centre of the trace's end, the trace steps that way, wherever in the cell
 * (or in the gap between tiles) the finger is. Turning, or stepping back, asks a little more, so a
 * sloppy straight drag doesn't wander into the next row.
 */

/** How far past the end's centre (in cells) the finger must be to keep going the same way... */
export const STRAIGHT = 0.5;
/** ...to turn or step back... */
export const TURN = 0.62;
/** ...and to fold the trace back onto an earlier tile that isn't the one just before the end. */
export const FOLD = 0.78;

export interface SteerState {
  trace: number[];
  /** The last step, as a cell offset (±1 or ±cols); 0 before the first. */
  dir: number;
}

/**
 * Advances the trace for one finger position (u, v), measured in cells so that the centre of the
 * cell at (row, col) is (col, row). Takes as many steps as the finger is ahead.
 */
export function steer(state: SteerState, u: number, v: number, rows: number, cols: number, free: (cell: number) => boolean): SteerState {
  let { trace, dir } = state;
  for (let guard = 0; guard < rows + cols && trace.length; guard++) {
    const end = trace[trace.length - 1];
    const dx = u - colOf(end, cols);
    const dy = v - rowOf(end, cols);
    const options = [
      { d: Math.sign(dx), off: Math.sign(dx), dist: Math.abs(dx), inside: inRange(colOf(end, cols) + Math.sign(dx), cols) },
      { d: Math.sign(dy), off: Math.sign(dy) * cols, dist: Math.abs(dy), inside: inRange(rowOf(end, cols) + Math.sign(dy), rows) },
    ]
      .filter((o) => o.d !== 0)
      .map((o) => ({ ...o, need: o.off === dir ? STRAIGHT : TURN }))
      .filter((o) => o.dist >= o.need)
      // The boundary the finger is furthest past is the one it crossed first.
      .sort((a, b) => b.dist / b.need - a.dist / a.need);
    let moved = false;
    for (const o of options) {
      if (!o.inside) continue;
      const next = end + o.off;
      const at = trace.indexOf(next);
      if (at >= 0 && at === trace.length - 2) trace = trace.slice(0, -1);
      else if (at >= 0) {
        if (o.dist < FOLD) continue;
        trace = trace.slice(0, at + 1);
      } else if (free(next)) trace = [...trace, next];
      else continue;
      dir = o.off;
      moved = true;
      break;
    }
    if (!moved) break;
  }
  return { trace, dir };
}

const inRange = (i: number, n: number): boolean => i >= 0 && i < n;
