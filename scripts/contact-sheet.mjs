// Builds art/contact-sheet.html: every piece's thumbnail with what was requested vs. found,
// so wrong matches (a detail, a copy, another painting) are easy to spot by eye.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const ART = new URL('../art/', import.meta.url);
const sources = Object.values(JSON.parse(readFileSync(new URL('sources.json', ART), 'utf8')));
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const cards = sources.map((s) => {
  const has = existsSync(new URL(`thumbs/${s.slug}.jpg`, ART));
  const flags = [];
  if (!s.source) flags.push('not found');
  if (s.file && Math.max(s.file.width, s.file.height) < 1600) flags.push(`low res ${s.file.width}×${s.file.height}`);
  if (s.source && !has) flags.push('no image');
  return `<figure class="${flags.length ? 'flag' : ''}" id="${s.slug}">
  ${has ? `<img loading="lazy" src="thumbs/${s.slug}.jpg" alt="">` : '<div class="none">—</div>'}
  <figcaption><b>${esc(s.title)}</b><span>${esc(s.artist)} · ${esc(s.year)}</span>
  <small>found: ${esc((s.foundTitle || '').slice(0, 90))}${s.foundArtist ? ' — ' + esc(s.foundArtist.slice(0, 40)) : ''}</small>
  <small>${esc(s.source || '')} · ${esc(s.licence || '')}${s.file ? ` · ${s.file.width}×${s.file.height}` : ''}</small>
  <small class="slug">${s.slug}</small>
  ${flags.map((f) => `<em>${esc(f)}</em>`).join('')}</figcaption></figure>`;
}).join('\n');

writeFileSync(new URL('contact-sheet.html', ART), `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Art contact sheet</title>
<style>
body{margin:0;padding:16px;background:#f4efe6;font:13px/1.35 system-ui,sans-serif;color:#2b2620}
h1{font:600 20px Georgia,serif;margin:0 0 12px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:12px}
figure{margin:0;background:#fffaf1;border:1px solid #d9cfbf;border-radius:8px;overflow:hidden}
figure.flag{border:2px solid #b4462f}
img,.none{width:100%;height:170px;object-fit:contain;background:#e9e2d6;display:grid;place-items:center}
figcaption{padding:8px;display:grid;gap:2px}
figcaption span{color:#5d564c}small{color:#8a8174;font-size:11px;word-break:break-word}
.slug{font-family:monospace}em{color:#b4462f;font-style:normal;font-weight:600;font-size:11px}
</style></head><body><h1>Behind the Words · art contact sheet (${sources.length} pieces)</h1>
<div class="grid">${cards}</div></body></html>`);
console.log('wrote art/contact-sheet.html');
