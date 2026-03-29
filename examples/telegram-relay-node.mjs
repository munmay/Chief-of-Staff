/**
 * Tiny Telegram relay example for Node / Vercel-style runtimes.
 *
 * Environment variables:
 * - APPS_SCRIPT_WEBHOOK_URL
 * - COS_RELAY_SECRET
 * - TELEGRAM_WEBHOOK_SECRET
 *
 * Set your Telegram bot webhook to:
 *   https://your-relay.example.com/api/telegram/<TELEGRAM_WEBHOOK_SECRET>
 */

import http from 'node:http';

export async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const expectedPath = `/api/telegram/${process.env.TELEGRAM_WEBHOOK_SECRET}`;

  if (req.method !== 'POST' || url.pathname !== expectedPath) {
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'not_found' }));
    return;
  }

  const rawBody = await readRawBody(req);
  const update = JSON.parse(rawBody || '{}');
  const message = update.message || update.edited_message;

  if (!message) {
    return sendJson(res, 200, { ok: true, ignored: true });
  }

  const relayPayload = {
    type: 'telegram_message',
    relaySecret: process.env.COS_RELAY_SECRET,
    chatId: message.chat ? String(message.chat.id) : '',
    userId: message.from ? String(message.from.id) : '',
    userName: message.from ? [message.from.first_name, message.from.last_name].filter(Boolean).join(' ') : '',
    text: message.text || message.caption || '',
    messageTs: message.date ? String(message.date) : '',
    photo: message.photo || [],
    document: message.document || null,
    voice: message.voice || null,
    caption: message.caption || '',
  };

  const response = await fetch(process.env.APPS_SCRIPT_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(relayPayload),
  });

  const body = await response.text();
  res.writeHead(response.status, { 'content-type': 'application/json' });
  res.end(body);
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(payload));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT || 8788);
  const server = http.createServer((req, res) => {
    handler(req, res).catch(error => {
      sendJson(res, 500, { ok: false, error: error.message });
    });
  });

  server.listen(port, () => {
    console.log(`Chief of Staff Telegram relay listening on http://localhost:${port}`);
  });
}
