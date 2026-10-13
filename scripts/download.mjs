// Downloads every resolved piece (art/sources.json) and stores:
//   art/images/<slug>.jpg  long edge 2400 px (git-ignored, regenerate with this script)
//   art/thumbs/<slug>.jpg  long edge 360 px (kept in git, for review sheets)
// then writes art/pieces.json (ship-safe metadata) and art/CREDITS.md.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import sharp from 'sharp';

const ART = new URL('../art/', import.meta.url);
const UA = 'BehindTheWords-collector/0.1 (https://github.com/Kyando)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sources = JSON.parse(readFileSync(new URL('sources.json', ART), 'utf8'));
for (const d of ['images', 'thumbs']) mkdirSync(new URL(d, ART), { recursive: true });

async function fetchBuf(url) {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, 'AIC-User-Agent': UA } });
      if (r.ok) return Buffer.from(await r.arrayBuffer());
      if (r.status === 404 || r.status === 403) break;
    } catch {}
    await sleep(2000 * (i + 1));
  }
  return null;
}

let n = 0;
for (const s of Object.values(sources)) {
  n++;
  if (!s.image) continue;
  const img = new URL(`images/${s.slug}.jpg`, ART);
  const th = new URL(`thumbs/${s.slug}.jpg`, ART);
  if (!existsSync(img)) {
    let buf = await fetchBuf(s.image);
    if (!buf && s.source === 'aic') buf = await fetchBuf(s.image.replace('/full/2400,/', '/full/1686,/'));
    if (!buf) { console.log('FAIL', s.slug); continue; }
    await sharp(buf, { limitInputPixels: false }).rotate()
      .resize(2400, 2400, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 86, mozjpeg: true }).toFile(img.pathname.slice(1));
    await sleep(s.source === 'commons' ? 500 : 250);
  }
  if (!existsSync(th)) await sharp(img.pathname.slice(1)).resize(360, 360, { fit: 'inside' }).jpeg({ quality: 78 }).toFile(th.pathname.slice(1));
  const m = await sharp(img.pathname.slice(1)).metadata();
  s.file = { width: m.width, height: m.height };
  console.log(`[${n}] ${s.slug} ${m.width}x${m.height}`);
}

// Ship-safe metadata: no Wikipedia/AIC reference text (those licences are reference-only).
const pieces = Object.values(sources).filter((s) => s.file).map((s) => ({
  slug: s.slug, title: s.title, artist: s.artist, year: s.year, period: s.period, holder: s.holder,
  source: s.source, sourceId: s.sourceId, sourcePage: s.page, licence: s.licence,
  medium: s.medium, dimensions: s.dimensions, credit: s.credit, tags: s.tags,
  width: s.file.width, height: s.file.height,
}));
writeFileSync(new URL('pieces.json', ART), JSON.stringify(pieces, null, 1));
writeFileSync(new URL('sources.json', ART), JSON.stringify(sources, null, 1));
const credits = ['# Image credits', '', 'All artworks are in the public domain. Image files come from the sources below.', '',
  ...pieces.map((p) => `- **${p.title}**, ${p.artist} (${p.year}). ${p.holder}. ${p.licence}. ${p.sourcePage}`)];
writeFileSync(new URL('CREDITS.md', ART), credits.join('\n') + '\n');
console.log(`downloaded ${pieces.length} pieces`);
