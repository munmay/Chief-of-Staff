/**
 * Tiny Slack relay example for Node / Vercel-style serverless runtimes.
 *
 * Environment variables:
 * - SLACK_SIGNING_SECRET
 * - APPS_SCRIPT_WEBHOOK_URL
 * - COS_RELAY_SECRET
 *
 * Optional:
 * - PORT (for local testing)
 *
 * This file exports a standard request handler and also starts a tiny local
 * HTTP server when run directly with Node.
 */

import crypto from 'node:crypto';
import http from 'node:http';

export async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 200, { ok: true, service: 'chief-of-staff-slack-relay-node' });
  }

  const rawBody = await readRawBody(req);
  const isValid = verifySlackSignature({
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    rawBody,
    timestamp: req.headers['x-slack-request-timestamp'],
    signature: req.headers['x-slack-signature'],
  });

  if (!isValid) {
    return sendJson(res, 401, { ok: false, error: 'invalid_signature' });
  }

  const contentType = req.headers['content-type'] || '';
  const payload = parseSlackPayload(rawBody, contentType);

  if (payload.type === 'url_verification') {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end(payload.challenge);
    return;
  }

  const event = extractSlackMessage(payload);
  if (!event) {
    return sendJson(res, 200, { ok: true, ignored: true });
  }

  const relayPayload = {
    type: 'slack_message',
    relaySecret: process.env.COS_RELAY_SECRET,
    channelId: event.channelId,
    userId: event.userId,
    userName: event.userName,
    text: event.text,
    messageTs: event.messageTs,
    threadTs: event.threadTs,
    ingestMessageAsSignal: shouldIngestAsSignal(event.text),
    files: event.files,
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

function verifySlackSignature({ signingSecret, rawBody, timestamp, signature }) {
  if (!signingSecret || !timestamp || !signature) return false;

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - Number(timestamp)) > 60 * 5) return false;

  const baseString = `v0:${timestamp}:${rawBody}`;
  const digest = crypto
    .createHmac('sha256', signingSecret)
    .update(baseString)
    .digest('hex');
  const expected = `v0=${digest}`;

  const left = Buffer.from(expected);
  const right = Buffer.from(String(signature));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function parseSlackPayload(rawBody, contentType) {
  if (String(contentType).includes('application/json')) {
    return JSON.parse(rawBody || '{}');
  }

  const params = new URLSearchParams(rawBody);
  if (params.has('payload')) {
    return JSON.parse(params.get('payload'));
  }

  return Object.fromEntries(params.entries());
}

function extractSlackMessage(payload) {
  if (payload.event && payload.event.type === 'message' && !payload.event.bot_id) {
    return {
      channelId: payload.event.channel,
      userId: payload.event.user,
      userName: payload.event.user_profile ? payload.event.user_profile.name : payload.event.user,
      text: payload.event.text || '',
      messageTs: payload.event.ts,
      threadTs: payload.event.thread_ts || '',
      files: normalizeSlackFiles(payload.event.files || []),
    };
  }

  if (payload.command || payload.text) {
    return {
      channelId: payload.channel_id || '',
      userId: payload.user_id || '',
      userName: payload.user_name || payload.user_id || '',
      text: payload.text || '',
      messageTs: '',
      threadTs: '',
      files: [],
    };
  }

  return null;
}

function normalizeSlackFiles(files) {
  return files.map(file => ({
    id: file.id,
    name: file.name,
    title: file.title,
    mimetype: file.mimetype,
    url_private: file.url_private,
    url_private_download: file.url_private_download,
    initial_comment: file.initial_comment || null,
  }));
}

function shouldIngestAsSignal(text) {
  const normalized = String(text || '').toLowerCase();
  return normalized.startsWith('decision:')
    || normalized.startsWith('constraint:')
    || normalized.startsWith('learning:')
    || normalized.startsWith('signal:')
    || normalized.startsWith('context:');
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
  const port = Number(process.env.PORT || 8787);
  const server = http.createServer((req, res) => {
    handler(req, res).catch(error => {
      sendJson(res, 500, { ok: false, error: error.message });
    });
  });

  server.listen(port, () => {
    console.log(`Chief of Staff Slack relay listening on http://localhost:${port}`);
  });
}
