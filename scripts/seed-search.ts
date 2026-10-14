/**
 * Tries ten layouts (seeds 0-9) of each level and prints how well their words sit on their things,
 * to pick a spec's `seed`.
 *   node scripts/seed-search.ts the-milkmaid,view-of-delft
 */
import { fit, generateLevel } from '../src/core/generate.ts';
import { SPECS } from './level-specs.ts';
const hash = (s: string) => [...s].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0, 7);
for (const id of process.argv[2].split(',')) {
  const spec = SPECS.find((s) => s.id === id)!;
  const rows: string[] = [];
  for (let seed = 0; seed < 10; seed++) {
    const def = generateLevel(spec, hash(id) + seed);
    if (!def) { rows.push(`${seed}: none`); continue; }
    const f = def.words.map((w) => ({ t: w.text, v: fit(w.path, def.cols, w.at!) }));
    const mean = f.reduce((s, x) => s + x.v, 0) / f.length;
    const min = Math.min(...f.map((x) => x.v));
    rows.push(`${seed}: mean ${Math.round(mean * 100)} min ${Math.round(min * 100)} ${f.filter((x) => x.v < 0.6).map((x) => `${x.t}${Math.round(x.v * 100)}`).join(' ')}`);
  }
  console.log(id + '\n  ' + rows.join('\n  '));
}
