// llms.txt: a plain-language map of the site for AI assistants (https://llmstxt.org).
// Links point at the Markdown copies written by scripts/markdown.mjs.
import type { APIRoute } from 'astro';
import { SITE, currentPrice } from '../config';

const md = (path: string) => `${SITE.url}${path === '/' ? '/index' : path}.md`;

const sections: [string, [string, string, string][]][] = [
  ['Product', [
    ['/', 'Home', 'What Lagsmith does, the comparison with Network Link Conditioner, AI agent support and FAQ.'],
    ['/pricing', 'Pricing', 'Free version, 14-day Pro trial, and Pro as a one-time purchase with a year of updates.'],
    ['/download', 'Download', 'Requirements and install steps, including allowing the network extension.'],
  ]],
  ['Compared with other tools', [
    ['/network-link-conditioner-alternative', 'Network Link Conditioner alternative', 'Lagsmith vs. Apple’s Network Link Conditioner: per-app vs. whole-Mac, failures, monitoring, automation; when NLC is enough.'],
    ['/network-link-conditioner', 'Network Link Conditioner guide', 'How to download, install and use Apple’s Network Link Conditioner on macOS and iPhone, its presets in numbers, and its limits.'],
    ['/vs/charles-proxy', 'Lagsmith vs. Charles Proxy', 'Per-app throttling without a proxy or certificates, compared with Charles Proxy’s throttling.'],
    ['/vs/proxyman', 'Lagsmith vs. Proxyman', 'Per-app throttling without a proxy or certificates, compared with Proxyman.'],
  ]],
  ['Use cases', [
    ['/throttle-ios-simulator', 'Throttle the iOS Simulator', 'Slow down one simulator app, or one app on one simulator device.'],
    ['/simulate-airplane-mode-ios-simulator', 'Airplane Mode in the iOS Simulator', 'Offline for one simulator app, with NWPathMonitor and SCNetworkReachability reporting no network.'],
    ['/throttle-app-bandwidth-mac', 'Throttle one Mac app', 'Per-app bandwidth, latency and packet loss on macOS.'],
    ['/simulate-slow-network', 'Simulate a slow network', '3G, Edge, high latency, jitter and packet loss for one app.'],
    ['/mock-api-ios-simulator', 'Mock or fail an API endpoint', 'Fail, delay or mock one endpoint in a simulator app without a proxy.'],
    ['/ai-agents-network-testing', 'AI agents and MCP', 'Claude Code, Cursor and Codex control the app under test’s network through Lagsmith’s MCP server, without slowing down the agent.'],
  ]],
  ['Docs', [
    ['/docs/getting-started', 'Getting started', 'Install, allow the network extension, slow down the first app.'],
    ['/docs/conditions', 'Presets and custom conditions', 'Presets, custom bandwidth/latency/jitter/loss, profiles and host rules.'],
    ['/docs/failures', 'Failure modes', 'Airplane Mode, refused connections, time-outs, dropped connections, outages, failing one endpoint.'],
    ['/docs/monitoring', 'Request monitoring', 'Requests, search filters, HAR export, mini monitor.'],
    ['/docs/automation', 'Automation', 'XCTest helper, ivar command line tool, lagsmith:// URL scheme, local HTTP API.'],
    ['/docs/mcp', 'MCP for AI agents', 'Setup for Claude Code, Cursor, Codex, Claude Desktop and Windsurf, and the 10 MCP tools.'],
    ['/docs/faq', 'FAQ', 'Common questions.'],
    ['/docs/troubleshooting', 'Troubleshooting', 'Network extension approval, apps not slowing down, missing simulator requests.'],
  ]],
  ['Policies', [
    ['/terms', 'Terms', `Licence terms. Sold by ${SITE.legal.name} through Paddle as Merchant of Record.`],
    ['/refunds', 'Refund policy', `${SITE.legal.refundDays}-day refunds, no questions asked.`],
    ['/privacy', 'Privacy', 'No account or analytics in the app; what is collected when buying Pro.'],
  ]],
];

export const GET: APIRoute = () => {
  const p = currentPrice();
  const price = p.regularLabel
    ? `${p.label} launch price until ${p.launchEndsLabel}, then ${p.regularLabel}`
    : p.label;
  const body = `# Lagsmith

> Lagsmith is a Mac app that slows down and breaks the network for one app at a time,
> including apps in the iOS Simulator, while everything else on the Mac stays at full speed.
> It is a per-app alternative to Apple's Network Link Conditioner for iOS and macOS developers,
> QA engineers, and AI coding agents running end-to-end tests.

- Presets: Edge, 3G, DSL, LTE, WiFi, Very Bad Network, 100% Loss, plus custom bandwidth, latency, jitter and packet loss.
- Failures: Airplane Mode for one app, refused connections, time-outs, dropped connections, intermittent outages, and failing or mocking a single endpoint.
- Request monitoring for iOS Simulator apps with no certificates or proxy settings; HAR export.
- Automation: XCTest UI test helper, \`ivar\` command line tool, \`lagsmith://\` URL scheme, local HTTP API, and a built-in MCP server for AI agents.
- Requires ${SITE.minMacOS}, Apple silicon or Intel. Runs locally; no account, no analytics.
- Pricing: free version; 14-day Pro trial; Pro is ${price}, a one-time purchase with a year of updates.

Every page is also available as Markdown, linked below, or by requesting any page with an
\`Accept: text/markdown\` header.

${sections.map(([name, links]) => `## ${name}\n\n${links.map(([path, title, desc]) => `- [${title}](${md(path)}): ${desc}`).join('\n')}`).join('\n\n')}
`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
