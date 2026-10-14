// Open decisions from the website brief live here so they can be changed in one place.
export const SITE = {
  name: 'Lagsmith',
  url: 'https://lagsmith.com',
  tagline: 'Slow down one app, not your whole Mac.',
  description:
    'Lagsmith slows down and breaks the network for one app at a time on your Mac, including apps in the iOS Simulator, while everything else stays at full speed.',

  // TBD: support address. Make sure mail for this address is set up before launch.
  supportEmail: 'support@lagsmith.com',

  // Signed and notarized .dmg. null shows "coming soon".
  downloadUrl: 'https://downloads.lagsmith.com/Lagsmith.dmg' as string | null,

  // Which payment provider /buy uses. Both are wired up in the licence service; the Terms,
  // Privacy and Refunds pages name whichever one is chosen here.
  checkout: 'paddle' as 'stripe' | 'paddle',

  // Stripe Managed Payments (Stripe is the merchant of record). The licence service creates the
  // Checkout Session, so nothing secret is here. While `enabled` is false, visitors see
  // "coming soon" and checkout only opens at /buy?test=1.
  stripe: {
    enabled: false,
  },

  // Paddle checkout on /buy. While `enabled` is false, visitors see "coming soon" and the
  // checkout only opens at /buy?sandbox=1 for testing. The client token is public by design.
  paddle: {
    enabled: false,
    environment: 'sandbox' as 'sandbox' | 'production',
    clientToken: 'test_1e9a9d73ece13ea840a0f6e75b5',
    priceId: 'pri_01m4vs8pez19rahekb0d7y9sfm',
    launchDiscountId: 'dsc_01m4vs8pj79w08xhb40jvwdamg',
  },

  // Pro is a one-time purchase that includes a year of updates.
  // Launch pricing: set regularAmount and launchEnds (YYYY-MM-DD, last day of the offer) to show
  // "$59 $39 launch price". After launchEnds the regular price is shown automatically on the next build.
  price: {
    amount: 39,
    currency: 'USD',
    regularAmount: 59 as number | null,
    launchEnds: '2026-11-30' as string | null,
    launchReason: 'Launch price for early supporters.',
  },

  // Seller details used in the Terms and Privacy pages.
  legal: {
    name: 'ShabzCo LLC',
    location: 'California, United States',
    governingLaw: 'the State of California',
    refundDays: 30,
  },

  minMacOS: 'macOS 13 Ventura or later',
};

const fmt = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;

// The price to show today, taking the launch offer into account.
export function currentPrice(today = new Date()) {
  const p = SITE.price;
  const launchActive =
    p.regularAmount !== null &&
    p.launchEnds !== null &&
    today <= new Date(`${p.launchEnds}T23:59:59-08:00`);
  const amount = launchActive || p.regularAmount === null ? p.amount : p.regularAmount;
  return {
    amount,
    label: fmt(amount),
    regularLabel: launchActive ? fmt(p.regularAmount!) : null,
    launchEnds: launchActive ? p.launchEnds : null,
    launchEndsLabel: launchActive
      ? new Date(`${p.launchEnds}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' })
      : null,
    launchReason: launchActive ? p.launchReason : null,
  };
}

/** Whether visitors can buy Pro on /buy right now (with the chosen provider). */
export const checkoutEnabled = () => (SITE.checkout === 'stripe' ? SITE.stripe.enabled : SITE.paddle.enabled);

// The company that sells to the buyer on our behalf (merchant of record), for the legal pages.
export function reseller() {
  return SITE.checkout === 'stripe'
    ? {
        name: 'Stripe',
        intro: 'Our orders are processed by Stripe through its Managed Payments service. Stripe, through Link, is the merchant of record for all our orders: your purchase is “Sold through Link”, and Link’s terms apply to the payment.',
        handles: 'Stripe calculates and collects any sales tax or VAT, and handles payment questions and refund requests for your order.',
        termsUrl: 'https://link.com/terms',
        privacyUrl: 'https://link.com/privacy',
        refundSite: { label: 'Link support', url: 'https://support.link.com/topics/sold-through-link' },
        statement: 'LINK.COM* LAGSMITH',
      }
    : {
        name: 'Paddle',
        intro: 'Our order process is conducted by our online reseller Paddle.com. Paddle.com is the Merchant of Record for all our orders, and Paddle’s buyer terms apply to your purchase.',
        handles: 'Paddle calculates and collects any sales tax or VAT, provides all customer service inquiries and handles returns.',
        termsUrl: 'https://www.paddle.com/legal/checkout-buyer-terms',
        privacyUrl: 'https://www.paddle.com/legal/privacy',
        refundSite: { label: 'paddle.net', url: 'https://paddle.net' },
        statement: 'PADDLE.NET* LAGSMITH',
      };
}
