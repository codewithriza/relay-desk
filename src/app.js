import { createReadStream } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { DiscordError, createDiscordClient, snowflake } from './discord.js';

const PUBLIC = fileURLToPath(new URL('../public/', import.meta.url));
const SESSION_AGE = 2 * 60 * 60 * 1000;
const MAX_SESSIONS = 1000;
const files = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/favicon.svg', ['favicon.svg', 'image/svg+xml']]
]);

function json(response, status, value, cookie) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...(cookie ? { 'Set-Cookie': cookie } : {})
  });
  response.end(JSON.stringify(value));
}

function body(request) {
  if (request.headers['content-type']?.split(';')[0] !== 'application/json') {
    throw new DiscordError('Send JSON with Content-Type: application/json.', 415);
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    let bytes = 0;
    let tooLarge = false;
    request.on('data', chunk => {
      if (tooLarge) return;
      bytes += chunk.length;
      if (bytes > 16_384) {
        tooLarge = true;
        chunks.length = 0;
      } else {
        chunks.push(chunk);
      }
    });
    request.on('end', () => {
      if (tooLarge) return reject(new DiscordError('Request is too large.', 413));
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch { reject(new DiscordError('Invalid JSON.')); }
    });
    request.on('error', reject);
  });
}

function cookieId(request) {
  const match = (request.headers.cookie || '').match(/(?:^|;\s*)relay_session=([a-f0-9]{64})(?:;|$)/);
  return match?.[1] || '';
}

function cookie(value, secure) {
  return `relay_session=${value}; Path=/; Max-Age=${value ? SESSION_AGE / 1000 : 0}; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}`;
}

function safeSession(session) {
  if (!session) return { connected: false };
  return {
    connected: true,
    mode: session.mode,
    label: session.label,
    chatLabel: session.chatLabel || '',
    activeType: session.activeType || session.mode,
    activeChannelId: session.channelId || '',
    canSend: Boolean(session.mode === 'webhook' || session.channelId),
    dmUser: session.dmUser || null
  };
}

function verifyOrigin(request, publicOrigin) {
  const supplied = request.headers.origin;
  if (!supplied) throw new DiscordError('Missing request origin.', 403);
  let origin;
  try { origin = new URL(supplied); }
  catch { throw new DiscordError('Invalid request origin.', 403); }
  if (publicOrigin) {
    if (origin.origin !== publicOrigin) throw new DiscordError('Request origin does not match this site.', 403);
    return;
  }
  const host = request.headers.host || '';
  const local = /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host);
  if (origin.host !== host || (origin.protocol !== 'https:' && !(local && origin.protocol === 'http:'))) {
    throw new DiscordError('Request origin does not match this site.', 403);
  }
}

function content(value) {
  const message = String(value || '').trim();
  if (!message || message.length > 2000) throw new DiscordError('Message must be 1–2000 characters.');
  return message;
}

export function createApp({ discord = createDiscordClient(), publicOrigin = process.env.PUBLIC_ORIGIN || '' } = {}) {
  const sessions = new Map();

  function current(request) {
    const id = cookieId(request);
    const session = sessions.get(id);
    if (!session) return null;
    if (Date.now() > session.expiresAt) {
      sessions.delete(id);
      return null;
    }
    return session;
  }

  function requireSession(request) {
    const session = current(request);
    if (!session) throw new DiscordError('Session expired. Connect again.', 401);
    return session;
  }

  async function handleApi(request, response, path, searchParams, secure) {
    if (request.method === 'POST') verifyOrigin(request, publicOrigin);
    const existing = current(request);

    if (path === '/api/session' && request.method === 'GET') {
      return json(response, 200, { ok: true, session: safeSession(existing) });
    }

    if (path === '/api/connect' && request.method === 'POST') {
      const input = await body(request);
      let session;
      let chats = [];
      let messages = [];
      let chatLoadError = '';
      if (input.mode === 'bot') {
        const account = await discord.bot(input.token);
        session = {
          mode: 'bot', token: account.token,
          label: account.user.global_name || account.user.username || 'Bot',
          activeType: 'bot', channelId: '', chatLabel: '', dmUser: null
        };
        try { chats = await discord.chats(session.token); }
        catch (error) { chatLoadError = `${error.message} Paste a channel ID to continue.`; }
        const first = input.channelId ? snowflake(input.channelId, 'channel ID') : chats[0]?.channels[0]?.id;
        if (first) {
          messages = await discord.messages(session.token, first);
          session.channelId = first;
          session.activeType = 'channel';
          session.chatLabel = chats.flatMap(g => g.channels).find(c => c.id === first)?.name || `#${first}`;
        }
      } else if (input.mode === 'webhook') {
        const info = await discord.inspectWebhook(input.webhookUrl);
        session = {
          mode: 'webhook', webhookUrl: String(input.webhookUrl).trim(),
          label: info?.name || 'Webhook', activeType: 'webhook',
          chatLabel: info?.channel_id ? `#${info.channel_id}` : 'Webhook',
          channelId: '', dmUser: null
        };
      } else {
        throw new DiscordError('Choose bot token or webhook mode.');
      }
      session.expiresAt = Date.now() + SESSION_AGE;
      session.chats = chats;
      session.chatsLoadedAt = Date.now();
      if (existing) sessions.delete(cookieId(request));
      for (const [id, value] of sessions) {
        if (Date.now() > value.expiresAt) sessions.delete(id);
      }
      if (sessions.size >= MAX_SESSIONS) throw new DiscordError('Server is busy. Try again later.', 503);
      const id = randomBytes(32).toString('hex');
      sessions.set(id, session);
      return json(response, 200, { ok: true, session: safeSession(session), chats, messages, chatLoadError }, cookie(id, secure));
    }

    if (path === '/api/disconnect' && request.method === 'POST') {
      sessions.delete(cookieId(request));
      return json(response, 200, { ok: true, session: safeSession(null) }, cookie('', secure));
    }

    if (path === '/api/chats' && request.method === 'GET') {
      const session = requireSession(request);
      if (session.mode !== 'bot') throw new DiscordError('Connect a bot to browse channels.');
      if (searchParams.get('reload') === '1' || Date.now() - session.chatsLoadedAt > 60_000) {
        session.chats = await discord.chats(session.token);
        session.chatsLoadedAt = Date.now();
      }
      return json(response, 200, { ok: true, chats: session.chats });
    }

    if (path === '/api/channel' && request.method === 'POST') {
      const session = requireSession(request);
      if (session.mode !== 'bot') throw new DiscordError('Connect a bot to open channels.');
      const input = await body(request);
      const channelId = snowflake(input.channelId, 'channel ID');
      const messages = await discord.messages(session.token, channelId);
      session.channelId = channelId;
      session.activeType = 'channel';
      session.chatLabel = session.chats?.flatMap(g => g.channels).find(c => c.id === channelId)?.name || `#${channelId}`;
      session.dmUser = null;
      return json(response, 200, { ok: true, session: safeSession(session), messages });
    }

    if (path === '/api/dm' && request.method === 'POST') {
      const session = requireSession(request);
      if (session.mode !== 'bot') throw new DiscordError('Connect a bot to open DMs.');
      const input = await body(request);
      const userId = snowflake(input.userId, 'user ID');
      const channel = await discord.openDm(session.token, userId);
      const messages = await discord.messages(session.token, channel.id);
      const user = await discord.user(session.token, userId);
      session.channelId = channel.id;
      session.activeType = 'dm';
      session.chatLabel = `@${user.globalName || user.username}`;
      session.dmUser = user;
      return json(response, 200, { ok: true, session: safeSession(session), messages });
    }

    if (path === '/api/people' && request.method === 'GET') {
      const session = requireSession(request);
      if (session.mode !== 'bot' || !session.channelId) return json(response, 200, { ok: true, people: [] });
      const rows = await discord.messages(session.token, session.channelId);
      const people = [...new Map(rows.filter(m => m.author.id && !m.author.bot).map(m => [m.author.id, {
        id: m.author.id, name: m.author.name, username: m.author.username, avatar: m.author.avatar
      }])).values()].slice(0, 30);
      return json(response, 200, { ok: true, people });
    }

    if (path === '/api/messages' && request.method === 'GET') {
      const session = requireSession(request);
      const messages = session.mode === 'bot' && session.channelId
        ? await discord.messages(session.token, session.channelId) : [];
      return json(response, 200, { ok: true, messages });
    }

    if (path === '/api/messages' && request.method === 'POST') {
      const session = requireSession(request);
      const input = await body(request);
      const text = content(input.content);
      const message = session.mode === 'bot'
        ? await discord.send(session.token, session.channelId, text)
        : await discord.sendWebhook(session.webhookUrl, text);
      return json(response, 200, { ok: true, message });
    }

    return json(response, 404, { ok: false, error: 'Endpoint not found.' });
  }

  return async function app(request, response) {
    const secure = publicOrigin?.startsWith('https://') || request.socket.encrypted || request.headers['x-forwarded-proto'] === 'https';
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https://cdn.discordapp.com https://media.discordapp.net; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
    try {
      const url = new URL(request.url, 'http://localhost');
      if (url.pathname.startsWith('/api/')) {
        return await handleApi(request, response, url.pathname, url.searchParams, secure);
      }
      const item = files.get(url.pathname);
      if (!item || !['GET', 'HEAD'].includes(request.method)) {
        response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        return response.end('Not found');
      }
      response.writeHead(200, {
        'Content-Type': item[1],
        'Cache-Control': item[0] === 'index.html' ? 'no-store' : 'public, max-age=3600'
      });
      if (request.method === 'HEAD') return response.end();
      createReadStream(join(PUBLIC, item[0])).pipe(response);
    } catch (error) {
      const status = error instanceof DiscordError ? error.status : 500;
      if (status === 500) console.error('Unexpected request failure:', error);
      if (!response.headersSent) json(response, status, { ok: false, error: status === 500 ? 'Something went wrong.' : error.message });
      else response.end();
    }
  };
}
