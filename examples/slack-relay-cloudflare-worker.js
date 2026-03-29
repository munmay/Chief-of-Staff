/**
 * Tiny Slack relay example for the Chief of Staff Context Engine.
 *
 * What it does:
 * - receives Slack events
 * - verifies Slack request signatures
 * - normalizes the payload
 * - forwards trusted messages to your Apps Script web app
 *
 * Deploy this as a Cloudflare Worker and set these secrets:
 * - SLACK_SIGNING_SECRET
 * - APPS_SCRIPT_WEBHOOK_URL
 * - COS_RELAY_SECRET
 */

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return json({ ok: true, service: 'chief-of-staff-slack-relay' });
    }

    const rawBody = await request.text();
    const isValid = await verifySlackSignature(request, rawBody, env.SLACK_SIGNING_SECRET);
    if (!isValid) {
      return json({ ok: false, error: 'invalid_signature' }, 401);
    }

    const contentType = request.headers.get('content-type') || '';
    const payload = parseSlackPayload(rawBody, contentType);

    if (payload.type === 'url_verification') {
      return new Response(payload.challenge, {
        status: 200,
        headers: { 'content-type': 'text/plain' },
      });
    }

    const event = extractSlackMessage(payload);
    if (!event) {
      return json({ ok: true, ignored: true });
    }

    const relayPayload = {
      type: 'slack_message',
      relaySecret: env.COS_RELAY_SECRET,
      channelId: event.channelId,
      userId: event.userId,
      userName: event.userName,
      text: event.text,
      messageTs: event.messageTs,
      threadTs: event.threadTs,
      ingestMessageAsSignal: shouldIngestAsSignal(event.text),
      files: event.files,
    };

    const response = await fetch(env.APPS_SCRIPT_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(relayPayload),
    });

    const body = await response.text();
    return new Response(body, {
      status: response.status,
      headers: { 'content-type': 'application/json' },
    });
  },
};

async function verifySlackSignature(request, rawBody, signingSecret) {
  const timestamp = request.headers.get('x-slack-request-timestamp');
  const signature = request.headers.get('x-slack-signature');

  if (!timestamp || !signature || !signingSecret) return false;

  const fiveMinutes = 60 * 5;
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - Number(timestamp)) > fiveMinutes) return false;

  const baseString = `v0:${timestamp}:${rawBody}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(signingSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(baseString));
  const hash = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  const expected = `v0=${hash}`;

  return timingSafeEqual(expected, signature);
}

function parseSlackPayload(rawBody, contentType) {
  if (contentType.includes('application/json')) {
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

function timingSafeEqual(left, right) {
  if (left.length !== right.length) return false;

  let mismatch = 0;
  for (let i = 0; i < left.length; i++) {
    mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return mismatch === 0;
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
