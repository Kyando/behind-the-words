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
import { fit, generateLevel } from '../src/core/generate.ts';
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
  const def = generateLevel(spec, hash(spec.id) + (spec.seed ?? 0) + seedOffset);
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
  else if (!existsSync(out)) {
    // A crop is cut into the served image itself, so the board shows exactly that part.
    let img = sharp(src);
    if (spec.art.crop) {
      const { width = 0, height = 0 } = await img.metadata();
      const [l, t, r, b] = spec.art.crop;
      img = sharp(src).extract({ left: Math.round(l * width), top: Math.round(t * height), width: Math.round((r - l) * width), height: Math.round((b - t) * height) });
    }
    await img.resize(1600, 1600, { fit: 'inside' }).jpeg({ quality: 84, mozjpeg: true }).toFile(out);
  }
  // How much of each word lies over the thing it names; under half, its area may need rethinking.
  const fits = def.words.map((w) => ({ text: w.text, share: fit(w.path, def.cols, w.at!) }));
  const mean = fits.reduce((s, w) => s + w.share, 0) / fits.length;
  const poor = fits.filter((w) => w.share < 0.5).map((w) => `${w.text} ${Math.round(w.share * 100)}%`);
  console.log(`✓ ${file} (${ms} ms) over their things: ${Math.round(mean * 100)}%${poor.length ? `; poor: ${poor.join(', ')}` : ''}`);
}
process.exit(failed ? 1 : 0);
