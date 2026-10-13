// Numbered thumbnail mosaics for eyeballing matches: node scripts/review-mosaic.mjs <outDir> [slug,slug]
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
const root = new URL('../art/', import.meta.url).pathname.slice(1);
const out = process.argv[2];
const S = Object.values(JSON.parse(readFileSync(root + 'sources.json', 'utf8')));
const only = process.argv[3] ? process.argv[3].split(',') : null;
const list = S.map((s, i) => ({ s, i: i + 1 })).filter(({ s }) => !only || only.includes(s.slug));
const T = 230, COLS = 8, PER = 48;
for (let p = 0; p * PER < list.length; p++) {
  const page = list.slice(p * PER, (p + 1) * PER);
  const rows = Math.ceil(page.length / COLS);
  const comps = [];
  for (const [k, { s, i }] of page.entries()) {
    const x = (k % COLS) * T, y = Math.floor(k / COLS) * (T + 34);
    const img = await sharp(root + 'thumbs/' + s.slug + '.jpg').resize(T - 6, T - 6, { fit: 'contain', background: '#e9e2d6' }).toBuffer();
    comps.push({ input: img, left: x + 3, top: y + 3 });
    const label = `${i} ${s.title}`.replace(/&/g, '&amp;').replace(/</g, '&lt;').slice(0, 34);
    comps.push({ input: Buffer.from(`<svg width="${T}" height="34"><text x="4" y="22" font-family="Arial" font-size="15" fill="#222">${label}</text></svg>`), left: x, top: y + T });
  }
  await sharp({ create: { width: COLS * T, height: rows * (T + 34), channels: 3, background: '#fffaf1' } }).composite(comps).png().toFile(`${out}/mosaic-${p + 1}.png`);
}
console.log('pages', Math.ceil(list.length / PER));
