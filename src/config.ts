// Open decisions from the website brief live here so they can be changed in one place.
export const SITE = {
  name: 'Lagsmith',
  url: 'https://lagsmith.com',
  tagline: 'Slow down one app, not your whole Mac.',
  description:
    'Lagsmith slows down and breaks the network for one app at a time on your Mac, including apps in the iOS Simulator, while everything else stays at full speed.',

  // TBD: support address. Make sure mail for this address is set up before launch.
  supportEmail: 'support@lagsmith.com',

  // TBD: hosted download (signed and notarized .dmg). null shows "coming soon".
  downloadUrl: null as string | null,

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
