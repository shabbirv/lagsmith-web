// Writes a Markdown copy of every page next to its HTML (dist/pricing.html -> dist/pricing.md,
// the home page -> dist/index.md).
//
// AI tools that send `Accept: text/markdown` get these instead of HTML (see public/.htaccess),
// and llms.txt links to them directly. Only the page's <main> content is kept: no header,
// footer, navigation, scripts or decorative markup.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');

const decode = (s) =>
  s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-' });
td.use(gfm);
td.remove(['script', 'style', 'svg', 'button', 'noscript']);
// Breadcrumbs and the docs sidebar repeat on every page.
td.addRule('skip-nav', { filter: 'nav', replacement: () => '' });
td.addRule('skip-hidden', {
  filter: (node) => node.getAttribute?.('aria-hidden') === 'true',
  replacement: () => '',
});
// Drawn illustrations (the app window) carry their description in aria-label.
td.addRule('described-images', {
  filter: (node) => node.getAttribute?.('role') === 'img' && node.getAttribute('aria-label'),
  replacement: (_content, node) => `\n\n*${node.getAttribute('aria-label')}*\n\n`,
});
// FAQ answers live in <details>; keep the question as a heading.
td.addRule('faq', {
  filter: 'summary',
  replacement: (content) => `\n\n### ${content.trim()}\n\n`,
});
// The terminal transcript is a run of rows; keep it as one code block.
td.addRule('terminal', {
  filter: (node) => node.classList?.contains('term-body'),
  replacement: (_content, node) => {
    const rows = Array.from(node.querySelectorAll('.tb')).map((tb) => {
      const kind = tb.getAttribute('data-kind');
      if (kind === 'prompt') return `> ${tb.textContent.replace(/^\s*>\s*/, '').trim()}`;
      if (kind === 'out') {
        const lines = Array.from(tb.querySelectorAll('.ol')).map((l) => l.textContent);
        return lines.map((l, i) => `${i === 0 ? '  ⎿  ' : '     '}${l}`).join('\n');
      }
      return `⏺ ${tb.textContent.trim()}`;
    });
    return `\n\n\`\`\`\n${rows.join('\n\n')}\n\`\`\`\n\n`;
  },
});

async function htmlFiles(dir) {
  const out = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await htmlFiles(p)));
    else if (entry.name.endsWith('.html')) out.push(p);
  }
  return out;
}

let written = 0;
for (const file of await htmlFiles(dist)) {
  const html = await fs.readFile(file, 'utf8');
  if (/<meta name="robots" content="noindex"/.test(html)) continue;
  const main = html.match(/<main[^>]*>([\s\S]*?)<\/main>/)?.[1];
  if (!main) continue;

  const title = decode(html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '');
  const description = decode(html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? '');
  const canonical = html.match(/<link rel="canonical" href="([^"]*)"/)?.[1] ?? '';

  const body = td
    .turndown(main)
    .replace(/\]\(\//g, '](https://lagsmith.com/')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const md = `# ${title}\n\n> ${description}\n\nSource: ${canonical}\n\n${body}\n`;

  await fs.writeFile(file.replace(/\.html$/, '.md'), md);
  written++;
}

console.log(`markdown: ${written} pages`);
