/**
 * Screenshots every palette preview (?theme=…) on a phone-sized screen and lays them out as sheets.
 *   node scripts/capture-themes.ts [palettes|woodblock] [id,id…]
 * Drives the locally installed Microsoft Edge through playwright-core. Writes docs/palettes/.
 */
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Page } from 'playwright-core';
import sharp from 'sharp';
import { createServer } from 'vite';
import type { LevelDef } from '../src/core/types.ts';

const root = join(import.meta.dirname, '..');
const outDir = join(root, 'docs/palettes');
const PORT = 5197;

type Shot = { id: string; name: string; note: string; query?: string };
const SETS: Record<string, Shot[]> = {
  palettes: [
  { id: 'gallery', name: '1 · Gallery wall', note: 'Sage museum wall · cream tiles · gold trace · gallery-red buttons' },
  { id: 'starry', name: '2 · Starry night', note: 'Cobalt sky · chrome-yellow trace · orange buttons' },
  { id: 'lilies', name: '3 · Water lilies', note: 'Pond green · rose trace · periwinkle buttons' },
  { id: 'woodblock', name: '4 · Woodblock paper', note: 'Washi paper · indigo ink · vermilion trace · Prussian blue' },
  { id: 'terracotta', name: '5 · Terracotta studio', note: 'Clay wall · ochre trace · teal buttons' },
  { id: 'mix', name: '6 · Mix: a wall per room', note: 'Icons on sage, Impressionists on pond green, Golden Age on clay, Japan on washi' },
  ],
  // Woodblock with surface effects, each step adding to the last.
  woodblock: [
    { id: 'wb-a', name: 'A · Mounted', note: 'Board on an indigo mount in a wood frame', query: 'theme=woodblock&fx=mount' },
    { id: 'wb-b', name: 'B · + Washi grain', note: 'Paper fibres and grain over everything', query: 'theme=woodblock&fx=mount,grain' },
    { id: 'wb-c', name: 'C · + Wave pattern', note: 'Seigaiha waves on the wall and banners', query: 'theme=woodblock&fx=mount,grain,pattern' },
    { id: 'wb-d', name: 'D · + Painting backdrop', note: 'Each level washed in its painting colours', query: 'theme=woodblock&fx=mount,grain,pattern,backdrop' },
    { id: 'wb-e', name: 'E · + Woodcut print', note: 'Ink outlines, offset letters, red seals', query: 'theme=woodblock&fx=mount,grain,pattern,backdrop,print' },
  ],
  // After A Little to the Left: on cream paper, and on a sage desk.
  lttl: [
    { id: 'lttl', name: 'Tidy desk · paper', note: 'Cream paper, pastel pieces, wobbly ink outlines, tape', query: 'theme=lttl' },
    { id: 'lttl-desk', name: 'Tidy desk · sage desk', note: 'The same pieces on a muted green desk', query: 'theme=lttl-desk' },
  ],
};
const set = process.argv[2] ?? 'palettes';
const THEMES = SETS[set];

const pick = process.argv[3]?.split(',');
const themes = pick ? THEMES.filter((t) => pick.includes(t.id)) : THEMES;
const levelFile = readdirSync(join(root, 'src/levels')).find((f) => f.includes('pearl-earring'))!;
const level = JSON.parse(readFileSync(join(root, 'src/levels', levelFile), 'utf8')) as LevelDef;
const save = { version: 1, levels: { 'starry-night': { done: true }, 'great-wave': { done: true } }, settings: { sound: false } };

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function centre(page: Page, cell: number): Promise<{ x: number; y: number }> {
  return page.evaluate((c) => {
    const r = document.querySelectorAll('.board .tile')[c].getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, cell);
}

/** Drags across the cells, leaving the finger down at the end when hold is set. */
async function trace(page: Page, path: number[], hold = false): Promise<void> {
  const first = await centre(page, path[0]);
  await page.mouse.move(first.x, first.y);
  await page.mouse.down();
  for (const cell of path.slice(1)) {
    const p = await centre(page, cell);
    await page.mouse.move(p.x, p.y, { steps: 8 });
  }
  if (!hold) await page.mouse.up();
}

async function main(): Promise<void> {
  mkdirSync(outDir, { recursive: true });
  const server = await createServer({ root, server: { port: PORT, strictPort: true }, logLevel: 'error' });
  await server.listen();
  const browser = await chromium.launch({ channel: process.env.CAPTURE_CHANNEL ?? 'msedge' });
  try {
    for (const t of themes) {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: false });
      await ctx.addInitScript((s) => localStorage.setItem('behind-the-words:v1', s), JSON.stringify(save));
      const page = await ctx.newPage();
      const shot = (name: string) => page.screenshot({ path: join(outDir, `${t.id}-${name}.png`) });
      await page.goto(`http://localhost:${PORT}/?${t.query ?? `theme=${t.id}`}`);
      await page.waitForSelector('.node.is-next');
      await wait(900);
      // The mix shows where one room's wall gives way to the next.
      if (t.id === 'mix') {
        // The whole trail at once, every room on its own wall.
        const full = await page.evaluate(() => document.querySelector('.trail-scroll')!.scrollHeight + 70);
        await page.setViewportSize({ width: 390, height: full });
        await wait(500);
        await page.screenshot({ path: join(outDir, 'mix-full-trail.png') });
        await page.setViewportSize({ width: 390, height: 844 });
        await wait(300);
        await page.evaluate(() => document.querySelector('[data-room="light"] .room-banner')?.scrollIntoView({ block: 'start' }));
        await page.evaluate(() => document.querySelector('.trail-scroll')!.scrollBy(0, -110));
        await wait(400);
      }
      await shot('1-trail');

      // A level mid-play: three words restored, a fourth being traced.
      await page.click('.node.is-next');
      await page.waitForSelector('.board .tile');
      await wait(4200);
      const words = level.words;
      for (const w of words.slice(0, 3)) {
        await trace(page, w.path);
        await wait(1500);
      }
      const held = words[3];
      await trace(page, held.path.slice(0, Math.ceil(held.path.length / 2) + 1), true);
      await wait(300);
      await shot('2-level');
      // Finish it: let go of the half word (a miss), then trace the rest.
      await page.mouse.up();
      await wait(1400);
      for (const w of words.slice(3)) {
        await trace(page, w.path);
        await wait(1300);
      }
      await page.waitForSelector('.result-banner');
      await wait(1800);
      await shot('3-restored');
      await page.click('.result-banner .btn');
      await wait(1600);
      await shot('4-story');
      await ctx.close();
      console.log(`captured ${t.id}`);
    }
  } finally {
    await browser.close();
    await server.close();
  }
  await sheets();
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

/** Per palette: its four screens side by side under a title. Plus one sheet of every palette's level. */
async function sheets(): Promise<void> {
  const W = 390, H = 844, gap = 28, pad = 40, head = 110;
  const phone = async (file: string) =>
    sharp(file)
      .resize(W, H)
      .composite([{ input: Buffer.from(`<svg width="${W}" height="${H}"><rect width="${W}" height="${H}" rx="34" fill="#fff"/></svg>`), blend: 'dest-in' }])
      .png()
      .toBuffer();
  const label = (w: number, title: string, note: string) =>
    Buffer.from(
      `<svg width="${w}" height="${head}"><text x="${pad}" y="58" font-family="Segoe UI, sans-serif" font-size="38" font-weight="700" fill="#222">${esc(title)}</text><text x="${pad}" y="94" font-family="Segoe UI, sans-serif" font-size="22" fill="#666">${esc(note)}</text></svg>`,
    );

  const screens = ['1-trail', '2-level', '3-restored', '4-story'];
  for (const t of THEMES) {
    const files = screens.map((s) => join(outDir, `${t.id}-${s}.png`));
    const w = pad * 2 + screens.length * W + (screens.length - 1) * gap;
    const h = head + H + pad;
    const parts = await Promise.all(files.map(phone));
    await sharp({ create: { width: w, height: h, channels: 3, background: '#ecebe8' } })
      .composite([{ input: label(w, t.name, t.note), left: 0, top: 0 }, ...parts.map((input, i) => ({ input, left: pad + i * (W + gap), top: head }))])
      .png()
      .toFile(join(outDir, `sheet-${t.id}.png`));
  }

  // Every palette's level side by side (scaled to fit one image).
  const w = pad * 2 + THEMES.length * W + (THEMES.length - 1) * gap;
  const tag = (s: string) => Buffer.from(`<svg width="${W}" height="60"><text x="${W / 2}" y="40" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="26" font-weight="700" fill="#222">${esc(s)}</text></svg>`);
  const levels = await Promise.all(THEMES.map((t) => phone(join(outDir, `${t.id}-2-level.png`))));
  const trails = await Promise.all(THEMES.map((t) => phone(join(outDir, `${t.id}-1-trail.png`))));
  await sharp({ create: { width: w, height: 60 + H * 2 + gap + pad, channels: 3, background: '#ecebe8' } })
    .composite([
      ...THEMES.map((t, i) => ({ input: tag(t.name), left: pad + i * (W + gap), top: 0 })),
      ...levels.map((input, i) => ({ input, left: pad + i * (W + gap), top: 60 })),
      ...trails.map((input, i) => ({ input, left: pad + i * (W + gap), top: 60 + H + gap })),
    ])
    .png()
    .toFile(join(outDir, set === 'palettes' ? 'overview.png' : `overview-${set}.png`));
  console.log(`sheets in ${outDir}`);
}

await main();
