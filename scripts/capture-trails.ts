/**
 * Screenshots the trail (the gallery wall) on a phone: where it opens, and one screen further down.
 *   node scripts/capture-trails.ts Writes docs/palettes/.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import sharp from 'sharp';
import { createServer } from 'vite';

const root = join(import.meta.dirname, '..');
const outDir = join(root, 'docs/palettes');
const PORT = 5198;
const [W, H] = (process.env.VIEW ?? '412x800').split('x').map(Number);
const LAYOUTS = [
  { id: 'wall', name: 'B · Gallery wall', note: 'A salon hang: each room a wall of framed paintings, rows of three and two' },
];
const pick = process.argv[2]?.split(',');
const layouts = pick ? LAYOUTS.filter((l) => pick.includes(l.id)) : LAYOUTS;
const save = { version: 1, levels: { 'starry-night': { done: true }, 'great-wave': { done: true } }, settings: { sound: false } };
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main(): Promise<void> {
  mkdirSync(outDir, { recursive: true });
  const server = await createServer({ root, server: { port: PORT, strictPort: true }, logLevel: 'error' });
  await server.listen();
  const browser = await chromium.launch({ channel: process.env.CAPTURE_CHANNEL ?? 'msedge' });
  try {
    for (const l of layouts) {
      const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
      await ctx.addInitScript((s) => localStorage.setItem('behind-the-words:v1', s), JSON.stringify(save));
      const page = await ctx.newPage();
      await page.goto(`http://localhost:${PORT}/`);
      await page.waitForSelector('.node.is-next');
      await wait(1400);
      await page.screenshot({ path: join(outDir, `trail-${l.id}-1.png`) });
      // One screen further down the walls.
      await page.evaluate((h) => document.querySelector('.trail-scroll')!.scrollBy({ top: h * 0.85, behavior: 'instant' }), H);
      await wait(700);
      await page.screenshot({ path: join(outDir, `trail-${l.id}-2.png`) });
      await ctx.close();
      console.log(`captured ${l.id}`);
    }
  } finally {
    await browser.close();
    await server.close();
  }
  await sheet();
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

async function sheet(): Promise<void> {
  const gap = 24, pad = 40, head = 96, pairGap = 64;
  const colW = W * 2 + gap;
  const width = pad * 2 + colW * layouts.length + pairGap * (layouts.length - 1);
  const height = pad + head + H + pad;
  const phone = async (file: string) => {
    const img = await sharp(file).resize(W, H).png().toBuffer();
    return sharp(img).composite([{ input: Buffer.from(`<svg width="${W}" height="${H}"><rect width="${W}" height="${H}" rx="30" fill="#fff"/></svg>`), blend: 'dest-in' }]).png().toBuffer();
  };
  const parts: { input: Buffer; left: number; top: number }[] = [];
  for (const [i, l] of layouts.entries()) {
    const x = pad + i * (colW + pairGap);
    parts.push({
      input: Buffer.from(`<svg width="${colW}" height="${head}"><text x="0" y="36" font-family="Segoe UI" font-weight="700" font-size="30" fill="#4b3a35">${esc(l.name)}</text><text x="0" y="70" font-family="Segoe UI" font-size="17" fill="#8a776c">${esc(l.note)}</text></svg>`),
      left: x,
      top: pad,
    });
    parts.push({ input: await phone(join(outDir, `trail-${l.id}-1.png`)), left: x, top: pad + head });
    parts.push({ input: await phone(join(outDir, `trail-${l.id}-2.png`)), left: x + W + gap, top: pad + head });
  }
  await sharp({ create: { width, height, channels: 4, background: '#e9dfcf' } }).composite(parts).png().toFile(join(outDir, 'sheet-trails.png'));
  console.log('sheet written');
}

await main();
