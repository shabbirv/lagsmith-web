import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

// <lastmod> is the date of the last commit to the page's source file, so it only
// changes when the page does. IndexNow (scripts/indexnow.mjs) relies on that.
// Pages without git history get no <lastmod> rather than a made-up one.
function lastModified(url) {
  const route = new URL(url).pathname.replace(/\/$/, '') || '/index';
  const file = [`src/pages${route}.astro`, `src/pages${route}/index.astro`].find((f) => existsSync(f));
  if (!file) return undefined;
  try {
    const date = execFileSync('git', ['log', '-1', '--format=%cI', '--', file], { encoding: 'utf8' }).trim();
    return date || undefined;
  } catch {
    return undefined;
  }
}

export default defineConfig({
  site: 'https://lagsmith.com',
  trailingSlash: 'never',
  build: { format: 'file' },
  integrations: [
    sitemap({
      filter: (page) => !/\/(thanks|buy|404)$/.test(page.replace(/\/$/, '')),
      serialize: (item) => ({ ...item, lastmod: lastModified(item.url) }),
    }),
  ],
});
