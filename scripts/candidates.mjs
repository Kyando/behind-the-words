// Lists source candidates for hand-picking: node scripts/candidates.mjs met|commons "<query>"
const [kind, q] = process.argv.slice(2);
const UA = 'BehindTheWords-collector/0.1 (https://github.com/Kyando)';
const get = async (u) => (await fetch(u, { headers: { 'User-Agent': UA } })).json();
if (kind === 'met') {
  const s = await get(`https://collectionapi.metmuseum.org/public/collection/v1.1/search?q=${encodeURIComponent(q)}&hasImages=true&limit=10`);
  for (const id of s.objectIDs || []) {
    const o = await get(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`).catch(() => null);
    if (o?.objectID) console.log(id, o.isPublicDomain ? 'PD' : '--', o.classification, '|', o.title.slice(0, 80), '|', o.artistDisplayName);
    await new Promise((r) => setTimeout(r, 250));
  }
} else {
  const s = await get('https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=10&prop=imageinfo&iiprop=size|extmetadata&iiextmetadatafilter=LicenseShortName&gsrsearch=' + encodeURIComponent(q + ' filetype:bitmap'));
  for (const p of Object.values(s.query?.pages || {}).sort((a, b) => a.index - b.index)) {
    const ii = p.imageinfo?.[0] || {};
    console.log(`${ii.width}x${ii.height}`, '|', ii.extmetadata?.LicenseShortName?.value, '|', p.title);
  }
}
