// Draws one 1200×630 share card per indexable page into dist/og/.
//
// Runs after `astro build`. The card text comes from each built page's own
// og:title, so a card can't drift from its page. Cards are cached in .og-cache/
// by a hash of their text, so the daily rebuild only redraws cards that changed.
// Needs ImageMagick (`convert`) and the DejaVu fonts.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const cacheDir = path.join(root, '.og-cache');
const icon = path.join(root, 'public', 'icon-1024.png');
const SITE = 'https://lagsmith.com';
const TEMPLATE_VERSION = 1; // bump to redraw every card after changing the design

const decode = (s) =>
  s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

async function htmlFiles(dir) {
  const out = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await htmlFiles(p)));
    else if (entry.name.endsWith('.html')) out.push(p);
  }
  return out;
}

function draw(title, out) {
  execFileSync('convert', [
    '-size', '1200x630', 'gradient:#1B2638-#0B111A',
    '(', icon, '-resize', '220x220', ')', '-geometry', '+90+205', '-composite',
    '-font', 'DejaVu-Sans-Bold', '-fill', '#5CE6FF', '-pointsize', '30', '-annotate', '+380+150', 'Lagsmith',
    '(', '-size', '720x300', '-background', 'none', '-fill', 'white', '-font', 'DejaVu-Sans-Bold',
    '-pointsize', '56', '-interline-spacing', '6', '-gravity', 'West', `caption:${title}`, ')',
    '-gravity', 'NorthWest', '-geometry', '+380+175', '-composite',
    '-font', 'DejaVu-Sans', '-fill', '#9FB0C6', '-pointsize', '24', '-annotate', '+380+540', 'lagsmith.com',
    '-depth', '8', '-strip', out,
  ]);
}

await fs.mkdir(cacheDir, { recursive: true });
let drawn = 0;
let cached = 0;

for (const file of await htmlFiles(dist)) {
  const html = await fs.readFile(file, 'utf8');
  const image = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1];
  const ogTitle = html.match(/<meta property="og:title" content="([^"]+)"/)?.[1];
  if (!image?.startsWith(`${SITE}/og/`) || !ogTitle) continue;

  const isHome = image === `${SITE}/og/home.png`;
  const title = isHome ? 'Slow down one app, not your whole Mac' : decode(ogTitle).replace(/ \| Lagsmith$/, '');
  const out = path.join(dist, new URL(image).pathname);
  const key = createHash('sha1').update(`${TEMPLATE_VERSION}\n${title}`).digest('hex');
  const cachePath = path.join(cacheDir, `${key}.png`);

  await fs.mkdir(path.dirname(out), { recursive: true });
  try {
    await fs.copyFile(cachePath, out);
    cached++;
  } catch {
    draw(title, cachePath);
    await fs.copyFile(cachePath, out);
    drawn++;
  }
}

console.log(`og-images: ${drawn} drawn, ${cached} from cache`);
