// Current Pro price for the app's Pro window. The app should hide the launch offer once
// launchEnds has passed, even if it has an older copy of this file.
import type { APIRoute } from 'astro';
import { SITE, currentPrice } from '../config';

export const GET: APIRoute = () => {
  const p = currentPrice();
  return new Response(
    JSON.stringify({
      currency: SITE.price.currency,
      price: p.amount,
      priceLabel: p.label,
      regularPrice: p.regularLabel ? SITE.price.regularAmount : null,
      regularPriceLabel: p.regularLabel,
      launchEnds: p.launchEnds,
      launchReason: p.launchReason,
      buyUrl: `${SITE.url}/buy`,
    }, null, 2),
    { headers: { 'Content-Type': 'application/json' } },
  );
};
