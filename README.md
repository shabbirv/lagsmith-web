# lagsmith.com

Static Astro site. Apache serves the build output in `dist/` (vhosts: `/etc/apache2/sites-available/lagsmith.com.conf` and `lagsmith.com-le-ssl.conf`).

```sh
npm run build   # rebuilds dist/, which is live immediately
npm run dev     # local preview
```

- Open decisions (support email, download URL, checkout URL, price) are in `src/config.ts`. Setting `checkoutUrl` turns `/buy` into a redirect to checkout; setting `downloadUrl` enables every download button.
- Clean URLs, www → apex and caching rules are in `public/.htaccess`.
- `/thanks#key=LAGSMITH-...` shows the licence key and the `lagsmith://activate?key=` button. The key goes in the URL fragment so it never reaches server logs.
- `brand/lagsmith-icon-1024.webp` is the source app icon; `public/icon-*.png`, `favicon.*`, `apple-touch-icon.png` and `og.png` are generated from it.
