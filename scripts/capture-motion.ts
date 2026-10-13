/**
 * Records the idle motion of each screen as GIFs, so it can be reviewed without a phone.
 *   node scripts/capture-motion.ts [query]      (default query: none, the game's own look)
 * Drives the locally installed Microsoft Edge through playwright-core. Writes docs/palettes/motion-*.gif.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import gifenc from 'gifenc';
import pngjs from 'pngjs';
import { chromium, type Page } from 'playwright-core';
import { createServer } from 'vite';
import type { LevelDef } from '../src/core/types.ts';

const { GIFEncoder, quantize, applyPalette } = gifenc;
const { PNG } = pngjs;

const root = join(import.meta.dirname, '..');
const outDir = join(root, 'docs/palettes');
const PORT = 5199;
const query = process.argv[2] ? `?${process.argv[2]}` : '';
const levelFile = readdirSync(join(root, 'src/levels')).find((f) => f.includes('pearl-earring'))!;
const level = JSON.parse(readFileSync(join(root, 'src/levels', levelFile), 'utf8')) as LevelDef;
const save = { version: 1, levels: { 'starry-night': { done: true }, 'great-wave': { done: true } }, settings: { sound: false } };

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Screenshots for ms milliseconds, as fast as the browser allows, and writes them as one GIF. */
async function record(page: Page, name: string, ms: number): Promise<void> {
  const frames: { png: Buffer; at: number }[] = [];
  const start = Date.now();
  while (Date.now() - start < ms) frames.push({ png: await page.screenshot(), at: Date.now() });
  const images = frames.map((f) => PNG.sync.read(f.png));
  const { width, height } = images[0];
  const pool = new Uint8Array(images.length * width * height * 4 / 8);
  // A shared palette from every 8th pixel of every frame keeps colours steady between frames.
  let k = 0;
  for (const img of images) for (let p = 0; p < img.data.length && k < pool.length; p += 32) pool.set(img.data.subarray(p, p + 4), k), (k += 4);
  const palette = quantize(pool, 256);
  const gif = GIFEncoder();
  images.forEach((img, i) => {
    const delay = i + 1 < frames.length ? frames[i + 1].at - frames[i].at : 80;
    gif.writeFrame(applyPalette(img.data, palette), width, height, { palette: i === 0 ? palette : undefined, delay });
  });
  gif.finish();
  writeFileSync(join(outDir, `motion-${name}.gif`), gif.bytes());
  console.log(`motion-${name}.gif: ${frames.length} frames`);
}

async function centre(page: Page, cell: number): Promise<{ x: number; y: number }> {
  return page.evaluate((c) => {
    const r = document.querySelectorAll('.board .tile')[c].getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, cell);
}

async function trace(page: Page, path: number[]): Promise<void> {
  const first = await centre(page, path[0]);
  await page.mouse.move(first.x, first.y);
  await page.mouse.down();
  for (const cell of path.slice(1)) {
    const p = await centre(page, cell);
    await page.mouse.move(p.x, p.y, { steps: 6 });
  }
  await page.mouse.up();
}

async function main(): Promise<void> {
  mkdirSync(outDir, { recursive: true });
  const server = await createServer({ root, server: { port: PORT, strictPort: true }, logLevel: 'error' });
  await server.listen();
  const browser = await chromium.launch({ channel: process.env.CAPTURE_CHANNEL ?? 'msedge' });
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: Number(process.env.SCALE ?? 1) });
    await ctx.addInitScript((s) => localStorage.setItem('behind-the-words:v1', s), JSON.stringify(save));
    const page = await ctx.newPage();
    await page.goto(`http://localhost:${PORT}/${query}`);
    await page.waitForSelector('.node');
    await record(page, 'trail', 4500);

    await page.click('.node.is-next');
    await page.waitForSelector('.board .tile');
    await record(page, 'level-deal', 4000);
    for (const w of level.words.slice(0, 3)) {
      await trace(page, w.path);
      await wait(1300);
    }
    await record(page, 'level-idle', 5000);
    for (const w of level.words.slice(3)) {
      await trace(page, w.path);
      await wait(1200);
    }
    await page.waitForSelector('.result-banner');
    await wait(1200);
    await record(page, 'restored', 3500);
    // The button breathes, so it never holds still for Playwright's stability check.
    await page.click('.result-banner .btn', { force: true });
    await wait(300);
    await record(page, 'story', 4000);
  } finally {
    await browser.close();
    await server.close();
  }
}

await main();
