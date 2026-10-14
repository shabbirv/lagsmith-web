# lagsmith.com

Static Astro site. Apache serves the build output in `dist/` (vhosts: `/etc/apache2/sites-available/lagsmith.com.conf` and `lagsmith.com-le-ssl.conf`).

```sh
npm run build       # rebuild dist/ (live immediately), then announce changed pages to IndexNow
npm run build:site  # rebuild without announcing
npm run dev         # local preview
```

Commit before building: each page's sitemap `<lastmod>` is its source file's last commit date, and IndexNow only announces pages whose `<lastmod>` changed. A cron job (`/etc/cron.d/lagsmith-build`) runs `npm run build` daily just after midnight Pacific so date-based content, like the launch price ending, updates on time.

The build has three steps after `astro build`:
- `scripts/og-images.mjs` draws a share card per page into `dist/og/` (needs ImageMagick; cached in `.og-cache/`).
- `scripts/markdown.mjs` writes a Markdown copy of each page (`dist/pricing.md`). `.htaccess` serves it to clients that send `Accept: text/markdown`; `/llms.txt` links to them.
- `scripts/indexnow.mjs` submits changed pages to Bing via IndexNow. The key is `public/<key>.txt`; what's been announced is in `.indexnow-state.json`.

- Open decisions (support email, download URL, price, checkout) are in `src/config.ts`. `checkout` picks the payment provider, Stripe Managed Payments or Paddle; the legal pages name whichever is chosen. `stripe.enabled` / `paddle.enabled` turn on checkout at `/buy` (until then it only opens at `/buy?test=1` for Stripe, `/buy?sandbox=1` for Paddle).
- `server/licence.mjs` is the licence service (systemd `lagsmith-licence`, Apache forwards `/api/` to 127.0.0.1:8787). It creates Stripe Checkout Sessions (`POST /api/checkout`, with the launch coupon while it's valid), verifies Stripe and Paddle webhooks, signs licence keys with `/etc/lagsmith/license-signing-key`, stores orders in `/var/lib/lagsmith/orders.json` and emails keys through Postmark. Secrets live in `/etc/lagsmith/*.env`, never in git. Restart it after changing those: `systemctl restart lagsmith-licence`.
- Analytics: Umami (`Base.astro`), with URL fragments never sent and query strings dropped on noindex pages, because `/thanks#key=` holds a licence key. Events: `Download`, `Buy click`, `Checkout opened`, `Payment started`, `Checkout closed`, `Purchase` (with revenue), `Copy command`, `Activate click`, `Copy licence key`, `Lost key request`.
- Clean URLs, www → apex and caching rules are in `public/.htaccess`.
- `/thanks#key=LAGSMITH-...` shows the licence key and the `lagsmith://activate?key=` button. The key goes in the URL fragment so it never reaches server logs.
- `brand/lagsmith-icon-1024.webp` is the source app icon; `public/icon-*.png`, `favicon.*`, `apple-touch-icon.png` and `og.png` are generated from it.
