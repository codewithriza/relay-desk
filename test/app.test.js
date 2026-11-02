import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.js';
import { createDiscordClient, webhookUrl, messageView } from '../src/discord.js';

const fakeMessage = {
  id: '123456789012345678', content: 'hello', timestamp: '2026-10-14T00:00:00.000Z',
  author: { id: '223456789012345678', username: 'Ada', bot: false }
};
const calls = [];
const discord = {
  async bot(token) {
    calls.push(['bot', token]);
    if (token !== 'test-bot-token') throw new Error('Invalid token');
    return { token, user: { id: '323456789012345678', username: 'Helper', bot: true } };
  },
  async chats() {
    return [{ guild: { id: '423456789012345678', name: 'Test', icon: '' }, channels: [
      { id: '523456789012345678', name: 'general' }
    ] }];
  },
  async messages(token, channelId) {
    calls.push(['messages', token, channelId]);
    return [messageView(fakeMessage)];
  },
  async send(token, channelId, content) {
    calls.push(['send', token, channelId, content]);
    return messageView({ ...fakeMessage, content });
  },
  async openDm() { return { id: '623456789012345678' }; },
  async user() { return { id: '723456789012345678', username: 'Ada', globalName: 'Ada', avatar: '', bot: false }; },
  async inspectWebhook() { return { name: 'Announcements', channel_id: '523456789012345678' }; },
  async sendWebhook(url, content) {
    calls.push(['webhook', url, content]);
    return messageView({ ...fakeMessage, content });
  }
};
let server;
let origin;

before(async () => {
  server = createServer(createApp({ discord }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise(resolve => server.close(resolve)));

async function api(path, { method = 'GET', payload, cookie, requestOrigin = origin } = {}) {
  const response = await fetch(origin + path, {
    method,
    headers: {
      ...(method === 'POST' ? { Origin: requestOrigin, 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {})
    },
    ...(payload ? { body: JSON.stringify(payload) } : {})
  });
  return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie') };
}

test('a bot session reads and sends without exposing its token', async () => {
  const connected = await api('/api/connect', {
    method: 'POST', payload: { mode: 'bot', token: 'test-bot-token' }
  });
  assert.equal(connected.status, 200);
  assert.equal(connected.body.session.chatLabel, 'general');
  assert.equal(connected.body.messages[0].content, 'hello');
  assert.ok(!JSON.stringify(connected.body).includes('test-bot-token'));
  assert.match(connected.cookie, /HttpOnly; SameSite=Strict/);
  const sessionCookie = connected.cookie.split(';')[0];
  const loaded = await api('/api/messages', { cookie: sessionCookie });
  assert.equal(loaded.body.messages[0].author.name, 'Ada');
  const sent = await api('/api/messages', {
    method: 'POST', cookie: sessionCookie, payload: { content: 'hello back' }
  });
  assert.equal(sent.body.message.content, 'hello back');
  assert.deepEqual(calls.at(-1), ['send', 'test-bot-token', '523456789012345678', 'hello back']);
  const anonymous = await api('/api/messages');
  assert.equal(anonymous.status, 401);
  const disconnected = await api('/api/disconnect', { method: 'POST', cookie: sessionCookie });
  assert.equal(disconnected.body.session.connected, false);
  assert.equal((await api('/api/session', { cookie: sessionCookie })).body.session.connected, false);
});

test('cross-origin writes and oversized messages are refused', async () => {
  const blocked = await api('/api/connect', {
    method: 'POST', requestOrigin: 'https://other.example', payload: { mode: 'bot', token: 'test-bot-token' }
  });
  assert.equal(blocked.status, 403);
  const connected = await api('/api/connect', {
    method: 'POST', payload: { mode: 'bot', token: 'test-bot-token' }
  });
  const rejected = await api('/api/messages', {
    method: 'POST', cookie: connected.cookie.split(';')[0], payload: { content: 'a'.repeat(2001) }
  });
  assert.equal(rejected.status, 400);
});

test('webhook URLs cannot target another host', () => {
  assert.throws(() => webhookUrl('https://evil.example/api/webhooks/123456789012345678/abcdefghijklmnopqrst'));
  assert.equal(webhookUrl('https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrst'),
    'https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrst');
});

test('Discord requests disable mentions when sending', async () => {
  const requests = [];
  const client = createDiscordClient({ fetchImpl: async (url, options) => {
    requests.push({ url, options });
    return { ok: true, status: 200, json: async () => fakeMessage };
  } });
  await client.send('token', '523456789012345678', '@everyone hi');
  assert.deepEqual(JSON.parse(requests[0].options.body).allowed_mentions, { parse: [] });
  assert.equal(requests[0].options.headers.Authorization, 'Bot token');
});

test('Discord client lists text channels and returns messages in chat order', async () => {
  const fetchImpl = async (url, options) => {
    assert.equal(options.headers.Authorization, 'Bot test-bot-token');
    const path = new URL(url).pathname;
    const data = path.endsWith('/users/@me/guilds')
      ? [{ id: '423456789012345678', name: 'Test server', icon: null }]
      : path.endsWith('/guilds/423456789012345678/channels')
        ? [{ id: '523456789012345678', name: 'general', type: 0 },
          { id: '723456789012345678', name: 'voice', type: 2 }]
        : [{ ...fakeMessage, id: '823456789012345678', content: 'newer' }, fakeMessage];
    return { ok: true, status: 200, json: async () => data };
  };
  const client = createDiscordClient({ fetchImpl });
  const chats = await client.chats('test-bot-token');
  assert.deepEqual(chats[0].channels, [{ id: '523456789012345678', name: 'general' }]);
  const messages = await client.messages('test-bot-token', '523456789012345678');
  assert.deepEqual(messages.map(message => message.content), ['hello', 'newer']);
});
