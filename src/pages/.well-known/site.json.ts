// Machine-readable description of the site and app, linked from every response's
// Link header (see public/.htaccess).
import type { APIRoute } from 'astro';
import { appSchema, siteSchemas } from '../../lib';

export const GET: APIRoute = () =>
  new Response(
    JSON.stringify({ '@context': 'https://schema.org', '@graph': [...siteSchemas(), appSchema()].map(({ '@context': _, ...rest }) => rest) }, null, 2),
    { headers: { 'Content-Type': 'application/ld+json' } },
  );
