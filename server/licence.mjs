// Lagsmith licence service: Paddle webhooks in, signed licence keys out.
//
// Runs as the lagsmith-licence systemd service on 127.0.0.1:8787; Apache forwards /api/ to it.
// No dependencies beyond Node's standard library.
//
//   POST /api/paddle/webhook   Paddle notifications (transaction.completed, adjustment.*)
//   GET  /api/licence?txn=…    licence key for a completed checkout (thank-you page)
//   POST /api/lost-key         {email}: re-send keys for an address
//
// Configuration comes from the environment (systemd EnvironmentFile=/etc/lagsmith/*.env):
//   PADDLE_ENV, PADDLE_API_KEY, PADDLE_PRICE_ID, PADDLE_WEBHOOK_SECRET
//   POSTMARK_TOKEN, MAIL_FROM            (optional until email is set up)
//   LICENCE_SIGNING_KEY_FILE             (default /etc/lagsmith/license-signing-key)
//   DATA_DIR                             (default /var/lib/lagsmith)
//
// Orders are recorded as soon as Paddle reports them, even if signing or email isn't set up
// yet; anything not yet emailed is retried on startup and every 10 minutes.

import { createHmac, createPrivateKey, sign, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';

const env = process.env;
const PORT = Number(env.PORT ?? 8787);
const DATA_DIR = env.DATA_DIR ?? '/var/lib/lagsmith';
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const PADDLE_API = env.PADDLE_ENV === 'production' ? 'https://api.paddle.com' : 'https://sandbox-api.paddle.com';
const SIGNATURE_TOLERANCE_S = 300;
const SITE = 'https://lagsmith.com';
const SUPPORT = 'support@lagsmith.com';

const log = (...args) => console.log(new Date().toISOString(), ...args);

// ---------- Licence keys ----------
//
// LAGSMITH-<base64url(payload)>.<base64url(signature)>, no padding. The payload is JSON
// ({"email","issued","updatesUntil"}, seconds since 1970) and the signature is Ed25519 over
// those exact bytes. The app checks it offline with the matching public key.

const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function loadSigningKey() {
  const file = env.LICENCE_SIGNING_KEY_FILE ?? '/etc/lagsmith/license-signing-key';
  try {
    const seed = Buffer.from(readFileSync(file, 'utf8').trim(), 'base64');
    if (seed.length !== 32) throw new Error(`expected a 32-byte seed, got ${seed.length} bytes`);
    // PKCS#8 wrapper for a raw Ed25519 seed.
    const der = Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), seed]);
    return createPrivateKey({ key: der, format: 'der', type: 'pkcs8' });
  } catch (err) {
    log(`licence signing key unavailable (${file}): ${err.message}`);
    return null;
  }
}
const signingKey = loadSigningKey();

function makeLicence(order) {
  if (!signingKey) return null;
  const issued = Math.floor(new Date(order.paidAt).getTime() / 1000);
  const until = new Date(order.paidAt);
  until.setUTCFullYear(until.getUTCFullYear() + 1);
  const payload = Buffer.from(JSON.stringify({ email: order.email, issued, updatesUntil: Math.floor(until.getTime() / 1000) }));
  return `LAGSMITH-${b64url(payload)}.${b64url(sign(null, payload, signingKey))}`;
}

// ---------- Orders (a JSON file; volumes are small) ----------

let orders = {};
let writing = Promise.resolve();

async function loadOrders() {
  await fs.mkdir(DATA_DIR, { recursive: true, mode: 0o700 });
  try {
    orders = JSON.parse(await fs.readFile(ORDERS_FILE, 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}

function saveOrders() {
  writing = writing.then(async () => {
    const tmp = `${ORDERS_FILE}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(orders, null, 2), { mode: 0o600 });
    await fs.rename(tmp, ORDERS_FILE);
  });
  return writing;
}

/** Records a paid order once, issuing its key if signing is available. */
async function recordOrder({ txn, customerId, email, paidAt }) {
  const existing = orders[txn];
  if (existing) return existing;
  const order = { txn, customerId, email, paidAt, status: 'paid', licence: null, emailedAt: null };
  order.licence = makeLicence(order);
  orders[txn] = order;
  await saveOrders();
  log(`order ${txn} recorded for ${email}`);
  return order;
}

// ---------- Paddle ----------

async function paddle(pathname) {
  const res = await fetch(`${PADDLE_API}${pathname}`, {
    headers: { Authorization: `Bearer ${env.PADDLE_API_KEY}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Paddle ${pathname}: HTTP ${res.status}`);
  return (await res.json()).data;
}

const includesPro = (txn) => txn.items?.some((i) => (i.price?.id ?? i.price_id) === env.PADDLE_PRICE_ID);

/** Records an order from a Paddle transaction object, if it's a completed Lagsmith Pro purchase. */
async function orderFromTransaction(txn) {
  if (!['completed', 'paid'].includes(txn.status) || !includesPro(txn)) return null;
  const customer = await paddle(`/customers/${txn.customer_id}`);
  return recordOrder({
    txn: txn.id,
    customerId: txn.customer_id,
    email: customer.email,
    paidAt: txn.billed_at ?? txn.updated_at ?? new Date().toISOString(),
  });
}

function verifyPaddleSignature(header, rawBody) {
  const secret = env.PADDLE_WEBHOOK_SECRET;
  if (!secret || !header) return false;
  const parts = header.split(';').map((p) => p.split('='));
  const ts = parts.find(([k]) => k === 'ts')?.[1];
  const signatures = parts.filter(([k]) => k === 'h1').map(([, v]) => v);
  if (!ts || !signatures.length || Math.abs(Date.now() / 1000 - Number(ts)) > SIGNATURE_TOLERANCE_S) return false;
  const expected = Buffer.from(createHmac('sha256', secret).update(`${ts}:${rawBody}`, 'utf8').digest('hex'));
  return signatures.some((s) => s.length === expected.length && timingSafeEqual(Buffer.from(s), expected));
}

async function handleEvent(event) {
  const data = event.data;
  if (event.event_type === 'transaction.completed') {
    const order = await orderFromTransaction(data);
    if (order) await deliver(order);
  } else if ((event.event_type === 'adjustment.created' || event.event_type === 'adjustment.updated')
      && data.action === 'refund' && data.status === 'approved' && data.type === 'full') {
    const order = orders[data.transaction_id];
    if (order && order.status !== 'refunded') {
      order.status = 'refunded';
      order.refundedAt = new Date().toISOString();
      await saveOrders();
      log(`order ${order.txn} refunded`);
    }
  }
}

// ---------- Email ----------

const activateUrl = (key) => `lagsmith://activate?key=${encodeURIComponent(key)}`;
const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function licenceEmail(email, licences) {
  const many = licences.length > 1;
  const text = [
    `Thank you for buying Lagsmith Pro.`,
    ``,
    ...licences.flatMap((key) => [
      `Activate: ${activateUrl(key)}`,
      ``,
      `Licence key${many ? '' : ' for ' + email}:`,
      key,
      ``,
    ]),
    `To activate by hand: open Lagsmith, click the menu bar icon › Lagsmith Pro… › Enter Licence Key…, paste the key and click Activate.`,
    ``,
    `Don't have Lagsmith yet? Download it at ${SITE}/download`,
    ``,
    `Your purchase includes a year of updates. Questions or refunds: ${SUPPORT}`,
  ].join('\n');

  const html = `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#0f1a2b;max-width:560px;margin:0 auto;padding:24px">
<p><img src="${SITE}/icon-256.png" width="56" height="56" alt="Lagsmith"></p>
<h1 style="font-size:22px">Thank you for buying Lagsmith Pro</h1>
${licences.map((key) => `
<p><a href="${escape(activateUrl(key))}" style="display:inline-block;background:#5ce6ff;color:#0f1a2b;font-weight:600;text-decoration:none;padding:12px 20px;border-radius:10px">Activate Lagsmith</a></p>
<p style="color:#4d5b70;font-size:14px">This opens Lagsmith with your key filled in. Click Activate in Lagsmith to unlock Pro.</p>
<p style="font-size:14px">Licence key${many ? '' : ' for ' + escape(email)}:</p>
<p style="font-family:ui-monospace,Menlo,monospace;font-size:13px;background:#eef2f7;padding:12px;border-radius:8px;word-break:break-all">${escape(key)}</p>`).join('')}
<p style="font-size:14px">If the button doesn’t open Lagsmith, open Lagsmith, click the menu bar icon › <b>Lagsmith Pro…</b> › <b>Enter Licence Key…</b>, paste the key and click <b>Activate</b>.</p>
<p style="font-size:14px">Don’t have Lagsmith yet? <a href="${SITE}/download">Download it</a>.</p>
<p style="color:#4d5b70;font-size:13px">Your purchase includes a year of updates. Questions or refunds: <a href="mailto:${SUPPORT}">${SUPPORT}</a></p>
</body></html>`;
  return { subject: 'Your Lagsmith Pro licence', text, html };
}

async function sendMail(to, { subject, text, html }) {
  if (!env.POSTMARK_TOKEN) {
    log(`email to ${to} not sent: no email provider configured`);
    return false;
  }
  const res = await fetch('https://api.postmarkapp.com/email', {
    method: 'POST',
    headers: { 'X-Postmark-Server-Token': env.POSTMARK_TOKEN, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ From: env.MAIL_FROM ?? `Lagsmith <${SUPPORT}>`, To: to, ReplyTo: SUPPORT, Subject: subject, TextBody: text, HtmlBody: html, MessageStream: 'outbound' }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    log(`email to ${to} failed: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    return false;
  }
  return true;
}

/** Issues the key if it's missing and emails it once. Safe to call repeatedly. */
async function deliver(order) {
  if (order.status !== 'paid') return;
  if (!order.licence) {
    order.licence = makeLicence(order);
    if (!order.licence) return;
    await saveOrders();
  }
  if (order.emailedAt) return;
  if (await sendMail(order.email, licenceEmail(order.email, [order.licence]))) {
    order.emailedAt = new Date().toISOString();
    await saveOrders();
    log(`licence emailed for ${order.txn}`);
  }
}

async function deliverPending() {
  for (const order of Object.values(orders)) {
    try {
      await deliver(order);
    } catch (err) {
      log(`delivery for ${order.txn} failed: ${err.message}`);
    }
  }
}

// ---------- Rate limiting for lost-key requests ----------

const hits = new Map();
function limited(key, max, windowMs) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > max;
}

// ---------- HTTP ----------

const json = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
};

async function readBody(req, limit = 1_000_000) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error('body too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

const clientIp = (req) => (req.headers['x-forwarded-for'] ?? '').split(',').pop().trim() || req.socket.remoteAddress;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (req.method === 'POST' && url.pathname === '/api/paddle/webhook') {
      const raw = await readBody(req);
      if (!verifyPaddleSignature(req.headers['paddle-signature'], raw)) {
        log('webhook rejected: bad signature');
        return json(res, 401, { error: 'invalid signature' });
      }
      const event = JSON.parse(raw);
      // Answer within Paddle's 5-second window, then do the work. A failure here is
      // caught by the periodic retry (orders) or the thank-you page's lookup.
      json(res, 200, { ok: true });
      handleEvent(event).catch((err) => log(`event ${event.event_id} (${event.event_type}) failed: ${err.message}`));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/licence') {
      const txn = url.searchParams.get('txn') ?? '';
      if (!/^txn_[a-z0-9]{26}$/.test(txn)) return json(res, 400, { error: 'invalid transaction' });
      let order = orders[txn];
      if (!order) {
        // The webhook may not have arrived yet; ask Paddle directly.
        let transaction;
        try {
          transaction = await paddle(`/transactions/${txn}`);
        } catch {
          return json(res, 404, { error: 'not found' });
        }
        order = await orderFromTransaction(transaction);
        if (!order) return json(res, 200, { status: 'pending' });
        deliver(order).catch((err) => log(`delivery for ${txn} failed: ${err.message}`));
      }
      if (order.status === 'refunded') return json(res, 200, { status: 'refunded' });
      if (!order.licence) return json(res, 200, { status: 'processing', email: order.email });
      return json(res, 200, { status: 'ready', email: order.email, licence: order.licence });
    }

    if (req.method === 'POST' && url.pathname === '/api/lost-key') {
      const { email } = JSON.parse((await readBody(req, 10_000)) || '{}');
      const address = String(email ?? '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) return json(res, 400, { error: 'invalid email' });
      if (limited(`ip:${clientIp(req)}`, 5, 3600_000) || limited(`email:${address}`, 3, 3600_000)) {
        return json(res, 429, { error: 'too many requests' });
      }
      const licences = Object.values(orders)
        .filter((o) => o.status === 'paid' && o.licence && o.email.toLowerCase() === address)
        .map((o) => o.licence);
      if (licences.length) {
        sendMail(address, licenceEmail(address, licences)).catch((err) => log(`lost-key email failed: ${err.message}`));
        log(`lost-key: re-sent ${licences.length} licence(s)`);
      }
      // Same answer either way, so the form can't be used to find out who has bought.
      return json(res, 200, { ok: true });
    }

    json(res, 404, { error: 'not found' });
  } catch (err) {
    log(`${req.method} ${url.pathname} failed: ${err.message}`);
    if (!res.headersSent) json(res, 500, { error: 'server error' });
  }
});

await loadOrders();
server.listen(PORT, '127.0.0.1', () => log(`licence service on 127.0.0.1:${PORT} (${env.PADDLE_ENV ?? 'sandbox'})`));
deliverPending();
setInterval(deliverPending, 10 * 60_000);
