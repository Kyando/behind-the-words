/**
 * Lays out every level in scripts/level-specs.ts, writes src/levels/NNN-<id>.json and copies each
 * level's painting to public/art/<slug>.jpg (long edge 1600 px) from art/images/.
 *   npm run levels:generate              all levels
 *   npm run levels:generate -- 3         only the third
 *   npm run levels:generate -- 3 --seed 7  the third, with another layout
 */
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { generateLevel } from '../src/core/generate.ts';
import { SPECS } from './level-specs.ts';

const root = join(import.meta.dirname, '..');
const dir = join(root, 'src', 'levels');
const artOut = join(root, 'public', 'art');
mkdirSync(dir, { recursive: true });
mkdirSync(artOut, { recursive: true });
const args = process.argv.slice(2);
const seedAt = args.indexOf('--seed');
const seedOffset = seedAt >= 0 ? Number(args.splice(seedAt, 2)[1]) : 0;
const only = args.map(Number).filter(Boolean);

const hash = (s: string) => [...s].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0, 7);

/** Compact JSON: one line per grid row and per word. */
function format(def: object): string {
  return JSON.stringify(def, null, 2).replace(/\[\s+([\d,\s]+?)\s+\]/g, (_, nums: string) => `[${nums.split(/,\s*/).join(', ')}]`);
}

let failed = 0;
for (const [i, spec] of SPECS.entries()) {
  const n = i + 1;
  if (only.length && !only.includes(n)) continue;
  const prefix = `${String(n).padStart(3, '0')}-`;
  const file = `${prefix}${spec.id}.json`;
  const started = performance.now();
  const def = generateLevel(spec, hash(spec.id) + seedOffset);
  const ms = Math.round(performance.now() - started);
  if (!def) {
    console.error(`✗ ${file}: no valid layout (${ms} ms) — try another --seed`);
    failed++;
    continue;
  }
  for (const old of readdirSync(dir)) if (old.startsWith(prefix) && old.endsWith('.json')) rmSync(join(dir, old));
  writeFileSync(join(dir, file), `${format(def)}\n`);

  const src = join(root, 'art', 'images', `${spec.art.slug}.jpg`);
  const out = join(artOut, `${spec.art.slug}.jpg`);
  if (!existsSync(src)) console.error(`  ! no image at art/images/${spec.art.slug}.jpg (run npm run art:download)`);
  else if (!existsSync(out)) await sharp(src).resize(1600, 1600, { fit: 'inside' }).jpeg({ quality: 84, mozjpeg: true }).toFile(out);
  console.log(`✓ ${file} (${ms} ms)\n${def.grid.map((r) => `    ${r.split('').join(' ')}`).join('\n')}`);
}
process.exit(failed ? 1 : 0);
