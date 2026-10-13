// Finds the source image and licence data for every piece in art/manifest.mjs.
// Writes art/sources.json (cached: rerun only resolves pieces still missing;
// pass --redo <slug,...> to force some again).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { PIECES, PERIODS } from '../art/manifest.mjs';

const OUT = new URL('../art/sources.json', import.meta.url);
const UA = 'BehindTheWords-collector/0.1 (https://github.com/Kyando)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const slugify = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

async function get(url, tries = 5) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, 'AIC-User-Agent': UA } });
      if (r.ok) return r.json();
      if (r.status === 404) return null;
    } catch {}
    await sleep(1500 * (i + 1));
  }
  return null;
}

const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const words = (s) => norm(s).split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w));
const STOP = new Set(['the', 'and', 'with', 'from', 'for', 'von', 'van', 'der', 'den', 'des', 'les', 'del', 'art', 'project', 'google', 'high', 'res', 'resolution', 'full', 'large']);

async function met(q, artistKey) {
  if (/^\d+$/.test(q)) return metObject(await get(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${q}`));
  const s = await get(`https://collectionapi.metmuseum.org/public/collection/v1.1/search?q=${encodeURIComponent(q)}&hasImages=true&limit=20`);
  const qw = words(q);
  let best = null;
  for (const id of (s?.objectIDs ?? []).slice(0, 12)) {
    const o = await get(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`);
    await sleep(200);
    if (!o || !o.primaryImage || !o.isPublicDomain) continue;
    if (artistKey && !norm(o.artistDisplayName + ' ' + o.culture).includes(norm(artistKey))) continue;
    const tw = words(o.title);
    const score = qw.filter((w) => tw.includes(w)).length;
    if (!best || score > best.score) best = { score, o };
    if (score >= Math.min(qw.length, 3)) break;
  }
  if (!best) return null;
  return metObject(best.o);
}

function metObject(o) {
  if (!o?.isPublicDomain || !o.primaryImage) return null;
  return {
    source: 'met', sourceId: o.objectID, licence: 'CC0 (The Met Open Access)',
    foundTitle: o.title, foundArtist: o.artistDisplayName, date: o.objectDate, medium: o.medium,
    dimensions: o.dimensions, credit: o.creditLine, page: o.objectURL, image: o.primaryImage,
    thumb: o.primaryImageSmall, tags: (o.tags || []).map((t) => t.term), additional: o.additionalImages?.length || 0,
  };
}

async function aic(q) {
  const f = 'id,title,artist_title,artist_display,is_public_domain,image_id,date_display,medium_display,dimensions,credit_line,subject_titles,term_titles,description,thumbnail';
  const s = await get(`https://api.artic.edu/api/v1/artworks/search?q=${encodeURIComponent(q)}&fields=${f}&limit=5`);
  const o = (s?.data || []).find((d) => d.is_public_domain && d.image_id);
  if (!o) return null;
  return {
    source: 'aic', sourceId: o.id, licence: 'CC0 (Art Institute of Chicago)',
    foundTitle: o.title, foundArtist: o.artist_title, date: o.date_display, medium: o.medium_display,
    dimensions: o.dimensions, credit: o.credit_line, page: `https://www.artic.edu/artworks/${o.id}`,
    image: `https://www.artic.edu/iiif/2/${o.image_id}/full/2400,/0/default.jpg`,
    thumb: `https://www.artic.edu/iiif/2/${o.image_id}/full/400,/0/default.jpg`,
    width: o.thumbnail?.width, height: o.thumbnail?.height,
    tags: [...(o.subject_titles || []), ...(o.term_titles || [])],
    referenceText: o.description ? o.description.replace(/<[^>]+>/g, '') : undefined,
    referenceLicence: o.description ? 'AIC description, CC BY 4.0: reference only' : undefined,
  };
}

const BAD = ['detail', 'frame', 'framed', 'museum', 'gallery room', 'exhibition', 'copy', 'replica', 'reproduction', 'sketch', 'study', 'cropped', 'crop', 'x-ray', 'infrared', 'back', 'reverse', 'stamp', 'postage', 'photo', 'installation', 'visitors', 'restoration'];

async function commons(q, title, artist, exactFile) {
  const api = 'https://commons.wikimedia.org/w/api.php?action=query&format=json'
    + (exactFile ? `&titles=${encodeURIComponent(exactFile)}` : '&generator=search&gsrnamespace=6&gsrlimit=12')
    + '&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=2400'
    + '&iiextmetadatafilter=LicenseShortName|Copyrighted|Artist|ObjectName|DateTimeOriginal|Credit|AttributionRequired|UsageTerms'
    + (exactFile ? '' : `&gsrsearch=${encodeURIComponent(q + ' filetype:bitmap')}`);
  const s = await get(api);
  const pages = Object.values(s?.query?.pages || {});
  const qw = words((q || '') + ' ' + title);
  const aw = words(artist).slice(-1); // surname
  const cands = [];
  for (const p of pages) {
    const ii = p.imageinfo?.[0];
    if (!ii || !/jpeg|png|tiff/.test(ii.mime)) continue;
    const em = ii.extmetadata || {};
    const lic = em.LicenseShortName?.value || '';
    const free = /cc0/i.test(lic) || (/public domain|^pd|no restrictions/i.test(lic) && em.Copyrighted?.value !== 'True');
    if (!free) continue;
    const name = norm(p.title + ' ' + (em.ObjectName?.value || '').slice(0, 200));
    const nw = words(p.title);
    let score = qw.filter((w) => nw.includes(w)).length * 2;
    if (aw.length && name.includes(aw[0])) score += 3;
    if (/google art project|google cultural institute/.test(name)) score += 3;
    for (const b of BAD) if (name.includes(b) && !norm(q).includes(b)) score -= 5;
    const px = ii.width * ii.height;
    if (Math.max(ii.width, ii.height) < 1200) score -= 6;
    score += Math.min(4, Math.log2(px / 1e6 + 1));
    score -= (p.index || 0) * 0.3;
    cands.push({ score, p, ii, em, lic });
  }
  cands.sort((a, b) => b.score - a.score);
  const c = cands[0];
  if (!c) return null;
  const strip = (v) => (v || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  return {
    source: 'commons', sourceId: c.p.title, licence: `${c.lic} (Wikimedia Commons)`,
    foundTitle: strip(c.em.ObjectName?.value) || c.p.title, foundArtist: strip(c.em.Artist?.value),
    date: strip(c.em.DateTimeOriginal?.value), credit: strip(c.em.Credit?.value),
    page: c.ii.descriptionurl, image: c.ii.thumburl || c.ii.url, original: c.ii.url,
    thumb: c.ii.thumburl?.replace(/\/\d+px-/, '/400px-'), width: c.ii.width, height: c.ii.height,
    score: +c.score.toFixed(1), runnerUp: cands[1]?.p.title,
  };
}

async function wikipedia(title, artist) {
  const s = await get(`https://en.wikipedia.org/w/api.php?action=query&format=json&list=search&srlimit=1&srsearch=${encodeURIComponent(`${title} ${artist}`)}`);
  const hit = s?.query?.search?.[0];
  if (!hit) return null;
  const sum = await get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(hit.title.replace(/ /g, '_'))}`);
  if (!sum?.extract) return null;
  return { article: hit.title, url: sum.content_urls?.desktop?.page, extract: sum.extract, licence: 'Wikipedia, CC BY-SA 4.0: reference only, never ship' };
}

const cache = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {};
const redo = new Set((process.argv[process.argv.indexOf('--redo') + 1] || '').split(',').filter(Boolean));
let done = 0;
for (const [title, artist, year, period, holder, src] of PIECES) {
  const slug = slugify(`${title}-${artist.split(' ').slice(-1)[0]}`);
  if (cache[slug]?.source && !redo.has(slug)) { done++; continue; }
  const [kind, rest] = [src.slice(0, src.indexOf(':')), src.slice(src.indexOf(':') + 1)];
  let r = null;
  try {
    if (kind === 'met') { const [q, key] = rest.split('|'); r = await met(q, key); }
    else if (kind === 'aic') r = await aic(rest);
    else if (kind === 'file') r = await commons(null, title, artist, rest);
    else r = await commons(rest, title, artist);
  } catch (e) { console.log('ERR', slug, e.message); }
  const ref = await wikipedia(title, artist).catch(() => null);
  cache[slug] = { slug, title, artist, year, period: PERIODS[period], holder, request: src, ...(r || { source: null }), wikipedia: ref };
  writeFileSync(OUT, JSON.stringify(cache, null, 1));
  done++;
  console.log(`${r ? 'ok ' : 'MISS'} [${done}/${PIECES.length}] ${slug}  <-  ${r ? (r.foundTitle || '').slice(0, 70) : src}`);
  await sleep(kind === 'commons' ? 400 : 300);
}
const keep = new Set(PIECES.map(([t, a]) => slugify(`${t}-${a.split(' ').slice(-1)[0]}`)));
for (const k of Object.keys(cache)) if (!keep.has(k)) { delete cache[k]; console.log('dropped', k); }
writeFileSync(OUT, JSON.stringify(cache, null, 1));
const vals = Object.values(cache);
console.log(`resolved ${vals.filter((v) => v.source).length}/${vals.length}`);
