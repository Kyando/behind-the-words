// Tiny static server for reviewing art/ (contact sheet, images): node scripts/serve.mjs [port]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const port = +(process.argv[2] || 5190);
const types = { '.html': 'text/html; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png', '.json': 'application/json', '.md': 'text/plain; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript' };
createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = normalize(join(root, p));
  if (!file.startsWith(normalize(root))) { res.writeHead(403); return res.end(); }
  let body;
  try { body = await readFile(file); } catch { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
  res.end(body);
}).listen(port, () => console.log(`serving ${root} on http://localhost:${port}`));
