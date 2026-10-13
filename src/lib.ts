import { SITE, currentPrice } from './config';

export interface QA { q: string; a: string }

export const faqSchema = (items: QA[]) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: items.map((i) => ({
    '@type': 'Question',
    name: i.q,
    acceptedAnswer: { '@type': 'Answer', text: i.a },
  })),
});

export const appSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Lagsmith',
  operatingSystem: 'macOS 13 or later',
  applicationCategory: 'DeveloperApplication',
  description: SITE.description,
  url: SITE.url,
  image: `${SITE.url}/icon-512.png`,
  publisher: { '@id': `${SITE.url}/#organization` },
  offers: [
    { '@type': 'Offer', name: 'Free', price: '0', priceCurrency: SITE.price.currency, description: 'Free version with a 14-day Pro trial' },
    { '@type': 'Offer', name: 'Lagsmith Pro', price: String(currentPrice().amount), priceCurrency: SITE.price.currency, description: 'One-time purchase with a year of updates' },
  ],
});

export const siteSchemas = () => [
  {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE.url}/#organization`,
    name: 'Lagsmith',
    legalName: SITE.legal.name,
    url: SITE.url,
    logo: `${SITE.url}/icon-512.png`,
    email: SITE.supportEmail,
    contactPoint: { '@type': 'ContactPoint', contactType: 'customer support', email: SITE.supportEmail },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE.url}/#website`,
    name: 'Lagsmith',
    url: SITE.url,
    description: SITE.description,
    publisher: { '@id': `${SITE.url}/#organization` },
    inLanguage: 'en',
  },
];

export const howToSchema = (name: string, description: string, steps: { name: string; text: string }[]) => ({
  '@context': 'https://schema.org',
  '@type': 'HowTo',
  name,
  description,
  step: steps.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, name: s.name, text: s.text })),
});
