// IndexNow: tell Bing (and Yandex, Seznam, Naver) which pages changed, right after a build.
// Google doesn't take part; the point is ChatGPT search and Copilot, which use Bing's index.
// Adapted from timestamp-it-refresh/scripts/indexnow.mjs.
//
// Only pages whose sitemap <lastmod> changed since the last successful submission are sent.
// <lastmod> comes from git history (astro.config.mjs), so a rebuild with no committed content
// changes announces nothing. Re-announcing the whole site on every build gets a host ignored.
//
// The key is public/<key>.txt, live at https://lagsmith.com/<key>.txt.
// What has been announced is kept in .indexnow-state.json (not in git; this server is the
// only place the site is built). Never fails the build.
//
//   node scripts/indexnow.mjs --dry-run

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE_URL = 'https://lagsmith.com';
const HOST = new URL(SITE_URL).host;
const ENDPOINT = 'https://api.indexnow.org/indexnow';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sitemapPath = path.join(root, 'dist', 'sitemap-0.xml');
const statePath = path.join(root, '.indexnow-state.json');
const dryRun = process.argv.includes('--dry-run');

const STATUS_REASON = {
  200: 'accepted',
  202: 'accepted, key not yet validated',
  400: 'bad request',
  403: 'forbidden (key file unreadable)',
  422: 'unprocessable (URL not on host, or key mismatch)',
  429: 'rate limited',
};

const keyFile = (await fs.readdir(path.join(root, 'public'))).find((f) => /^[a-f0-9]{32}\.txt$/.test(f));
if (!keyFile) {
  console.log('indexnow: no key file in public/, skipping');
  process.exit(0);
}
const key = keyFile.replace(/\.txt$/, '');
const keyLocation = `${SITE_URL}/${keyFile}`;

let xml;
try {
  xml = await fs.readFile(sitemapPath, 'utf8');
} catch (err) {
  console.log(`indexnow: cannot read sitemap (${err.message}), skipping`);
  process.exit(0);
}

const entries = (xml.match(/<url>[\s\S]*?<\/url>/g) ?? [])
  .map((block) => ({
    loc: block.match(/<loc>([^<]+)<\/loc>/)?.[1]?.trim(),
    lastmod: block.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1]?.trim() ?? null,
  }))
  .filter((e) => e.loc && new URL(e.loc).host === HOST);

let state = {};
try {
  state = JSON.parse(await fs.readFile(statePath, 'utf8'));
} catch {
  // First run, or unreadable: nothing is known to have been announced.
}

// Pages without <lastmod> have nothing to compare against, so they count as unchanged.
const changed = entries.filter((e) => e.lastmod && state[e.loc] !== e.lastmod);

if (dryRun) {
  console.log(`indexnow: ${changed.length} changed of ${entries.length} (dry run, key ${keyLocation})`);
  for (const e of changed) console.log(`  ${state[e.loc] ? 'changed' : 'new    '} ${e.loc} (${e.lastmod})`);
  process.exit(0);
}

if (changed.length === 0) {
  console.log(`indexnow: 0 changed of ${entries.length}, nothing to submit`);
  process.exit(0);
}

let result;
try {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: HOST, key, keyLocation, urlList: changed.map((e) => e.loc) }),
    signal: AbortSignal.timeout(15000),
  });
  result = { status: response.status, body: (await response.text().catch(() => '')).trim() };
} catch (err) {
  console.log(`indexnow: request failed (${err.message}); these URLs go out again next build`);
  process.exit(0);
}

console.log(
  `indexnow: ${changed.length} URL(s) -> HTTP ${result.status} ${STATUS_REASON[result.status] ?? 'unexpected status'}` +
    (result.body ? ` ${result.body.slice(0, 200)}` : ''),
);

if (result.status === 200 || result.status === 202) {
  // Keep only URLs still in the sitemap, so the state stays the size of the site.
  const next = {};
  for (const e of entries) {
    const done = changed.includes(e) ? e.lastmod : state[e.loc];
    if (done) next[e.loc] = done;
  }
  await fs.writeFile(statePath, `${JSON.stringify(next, null, 2)}\n`);
} else {
  console.log('indexnow: state not advanced; these URLs go out again next build');
}
