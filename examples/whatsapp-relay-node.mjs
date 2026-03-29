/**
 * Tiny WhatsApp relay example for Node / Vercel-style runtimes.
 *
 * Environment variables:
 * - APPS_SCRIPT_WEBHOOK_URL
 * - COS_RELAY_SECRET
 * - WHATSAPP_VERIFY_TOKEN
 *
 * Notes:
 * - Meta will call GET for webhook verification
 * - Meta will call POST for inbound messages
 * - Outbound replies are sent by Apps Script via WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID
 */

import http from 'node:http';

export async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');

  if (req.method === 'GET') {
    return handleVerification(url, res);
  }

  if (req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
  }

  const rawBody = await readRawBody(req);
  const payload = JSON.parse(rawBody || '{}');
  const message = extractWhatsAppMessage(payload);

  if (!message) {
    return sendJson(res, 200, { ok: true, ignored: true });
  }

  const relayPayload = {
    type: 'whatsapp_message',
    relaySecret: process.env.COS_RELAY_SECRET,
    senderId: message.senderId,
    userName: message.profileName,
    text: message.text,
    messageId: message.messageId,
    image: message.image,
    document: message.document,
    audio: message.audio,
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

function handleVerification(url, res) {
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end(challenge || '');
    return;
  }

  res.writeHead(403, { 'content-type': 'text/plain' });
  res.end('forbidden');
}

function extractWhatsAppMessage(payload) {
  const entry = payload.entry && payload.entry[0];
  const change = entry && entry.changes && entry.changes[0];
  const value = change && change.value;
  const message = value && value.messages && value.messages[0];

  if (!message) return null;

  const contact = value.contacts && value.contacts[0];

  return {
    senderId: message.from || '',
    profileName: contact && contact.profile ? contact.profile.name : message.from || '',
    messageId: message.id || '',
    text: message.text ? message.text.body : '',
    image: message.image || null,
    document: message.document || null,
    audio: message.audio || null,
  };
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
  const port = Number(process.env.PORT || 8789);
  const server = http.createServer((req, res) => {
    handler(req, res).catch(error => {
      sendJson(res, 500, { ok: false, error: error.message });
    });
  });

  server.listen(port, () => {
    console.log(`Chief of Staff WhatsApp relay listening on http://localhost:${port}`);
  });
}
