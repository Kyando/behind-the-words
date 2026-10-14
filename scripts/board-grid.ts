/**
 * Draws a painting exactly as a board of rows × cols crops it, with the cells outlined and numbered
 * (row, column), so each word's place on the board can be read off the picture.
 *   node scripts/board-grid.ts <slug>:<rows>x<cols>[:<left>,<top>,<right>,<bottom>] …
 *   node scripts/board-grid.ts --specs [id,id…]     every level in scripts/level-specs.ts, each word's area marked
 *   node scripts/board-grid.ts --levels [id,id…]    every generated level, each word's piece drawn where it landed
 * Writes docs/palettes/grids/.
 */
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import type { LevelDef } from '../src/core/types.ts';
import { SPECS } from './level-specs.ts';

const root = join(import.meta.dirname, '..');
const out = join(root, 'docs', 'palettes', 'grids');
mkdirSync(out, { recursive: true });

type Area = { text: string; at: readonly [number, number, number, number] };
type Job = { name: string; slug: string; rows: number; cols: number; crop?: readonly number[]; areas?: Area[]; paths?: { text: string; path: number[] }[] };

const args = process.argv.slice(2);
const levelsDir = join(root, 'src', 'levels');
const jobs: Job[] =
  args[0] === '--levels'
    ? readdirSync(levelsDir)
        .filter((f) => f.endsWith('.json'))
        .map((f) => JSON.parse(readFileSync(join(levelsDir, f), 'utf8')) as LevelDef)
        .filter((l) => !args[1] || args[1].split(',').includes(l.id))
        .map((l) => ({ name: `${l.id}-board`, slug: l.art.slug, rows: l.rows, cols: l.cols, crop: l.art.crop, paths: l.words }))
    : args[0] === '--specs'
    ? SPECS.filter((s) => !args[1] || args[1].split(',').includes(s.id)).map((s) => ({
        name: s.id,
        slug: s.art.slug,
        rows: s.rows,
        cols: s.cols,
        crop: s.art.crop,
        areas: s.words.map((w) => ({ text: w.text, at: w.at })),
      }))
    : args.map((a) => {
        const [slug, size, crop] = a.split(':');
        const [rows, cols] = size.split('x').map(Number);
        return { name: `${slug}-${rows}x${cols}`, slug, rows, cols, crop: crop?.split(',').map(Number) };
      });

const CELL = 110;
const COLOURS = ['#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#42d4f4', '#f032e6', '#bfef45', '#469990', '#9a6324'];

for (const job of jobs) {
  const { rows, cols } = job;
  const W = cols * CELL;
  const H = rows * CELL;
  let img = sharp(join(root, 'art', 'images', `${job.slug}.jpg`));
  if (job.crop) {
    const meta = await img.metadata();
    const [l, t, r, b] = job.crop;
    img = sharp(join(root, 'art', 'images', `${job.slug}.jpg`)).extract({
      left: Math.round(l * meta.width!),
      top: Math.round(t * meta.height!),
      width: Math.round((r - l) * meta.width!),
      height: Math.round((b - t) * meta.height!),
    });
  }
  // As the board shows it: centred, scaled to cover (preserveAspectRatio xMidYMid slice).
  const base = await img.resize(W, H, { fit: 'cover', position: 'centre' }).toBuffer();
  const lines: string[] = [];
  for (let r = 0; r <= rows; r++) lines.push(`<line x1="0" y1="${r * CELL}" x2="${W}" y2="${r * CELL}" stroke="#fff" stroke-width="2" opacity="0.8"/>`);
  for (let c = 0; c <= cols; c++) lines.push(`<line x1="${c * CELL}" y1="0" x2="${c * CELL}" y2="${H}" stroke="#fff" stroke-width="2" opacity="0.8"/>`);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      lines.push(`<text x="${c * CELL + 6}" y="${r * CELL + 22}" font-family="Segoe UI" font-weight="700" font-size="20" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke">${r},${c}</text>`);
  (job.areas ?? []).forEach(({ text, at: [r0, c0, r1, c1] }, i) => {
    const colour = COLOURS[i % COLOURS.length];
    const x = c0 * CELL + 4 + (i % 3) * 3;
    const y = r0 * CELL + 4 + (i % 3) * 3;
    lines.push(`<rect x="${x}" y="${y}" width="${(c1 - c0 + 1) * CELL - 8}" height="${(r1 - r0 + 1) * CELL - 8}" fill="${colour}" fill-opacity="0.12" stroke="${colour}" stroke-width="5"/>`);
    lines.push(`<text x="${x + 8}" y="${y + (r1 - r0 + 1) * CELL - 20}" font-family="Segoe UI" font-weight="800" font-size="24" fill="${colour}" stroke="#fff" stroke-width="5" paint-order="stroke">${text}</text>`);
  });
  // Each word's piece: its cells tinted and joined, its letters on them, its name at its first cell.
  (job.paths ?? []).forEach(({ text, path }, i) => {
    const colour = COLOURS[i % COLOURS.length];
    path.forEach((cell, k) => {
      const r = Math.floor(cell / cols);
      const c = cell % cols;
      lines.push(`<rect x="${c * CELL + 3}" y="${r * CELL + 3}" width="${CELL - 6}" height="${CELL - 6}" fill="${colour}" fill-opacity="0.22" stroke="${colour}" stroke-width="4"/>`);
      lines.push(`<text x="${c * CELL + CELL / 2}" y="${r * CELL + CELL / 2 + 14}" text-anchor="middle" font-family="Segoe UI" font-weight="800" font-size="40" fill="#fff" stroke="${colour}" stroke-width="6" paint-order="stroke">${text[k]}</text>`);
    });
    const r = Math.floor(path[0] / cols);
    const c = path[0] % cols;
    lines.push(`<text x="${c * CELL + 8}" y="${r * CELL + CELL - 10}" font-family="Segoe UI" font-weight="800" font-size="17" fill="#fff" stroke="#000" stroke-width="4" paint-order="stroke">${text}</text>`);
  });
  await sharp(base)
    .composite([{ input: Buffer.from(`<svg width="${W}" height="${H}">${lines.join('')}</svg>`) }])
    .png()
    .toFile(join(out, `${job.name}.png`));
  console.log(`grids/${job.name}.png`);
}
