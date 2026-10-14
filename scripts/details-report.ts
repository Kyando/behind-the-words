/**
 * How well the small details sit on their things: every word whose area is 4 cells or fewer, in
 * every generated level, with the share of its thing it covers. Lists the misses first.
 *   node scripts/details-report.ts
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fit } from '../src/core/generate.ts';
import type { LevelDef } from '../src/core/types.ts';

const dir = join(import.meta.dirname, '..', 'src', 'levels');
const rows: { level: string; word: string; cells: number; share: number }[] = [];
for (const f of readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
  const level = JSON.parse(readFileSync(join(dir, f), 'utf8')) as LevelDef;
  for (const w of level.words) {
    const [r0, c0, r1, c1] = w.at!;
    const cells = (r1 - r0 + 1) * (c1 - c0 + 1);
    if (cells <= 4) rows.push({ level: level.id, word: w.text, cells, share: fit(w.path, level.cols, w.at!) });
  }
}
rows.sort((a, b) => a.share - b.share);
for (const r of rows) console.log(`${String(Math.round(r.share * 100)).padStart(4)}%  ${r.word.padEnd(9)} ${r.level} (${r.cells} cells)`);
const full = rows.filter((r) => r.share === 1).length;
console.log(`\n${rows.length} details: ${full} fully covered, mean ${Math.round((100 * rows.reduce((s, r) => s + r.share, 0)) / rows.length)}%`);
