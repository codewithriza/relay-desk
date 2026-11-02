const API_BASE = 'https://discord.com/api/v10';
const SNOWFLAKE = /^\d{17,20}$/;
const WEBHOOK = /^https:\/\/(?:discord\.com|discordapp\.com)\/api(?:\/v\d+)?\/webhooks\/(\d{17,20})\/([A-Za-z0-9_-]{20,})\/?$/;

export class DiscordError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export function snowflake(value, label = 'ID') {
  const id = String(value || '').trim();
  if (!SNOWFLAKE.test(id)) throw new DiscordError(`Enter a valid ${label}.`);
  return id;
}

export function webhookUrl(value) {
  const raw = String(value || '').trim();
  if (!WEBHOOK.test(raw)) throw new DiscordError('Enter a Discord webhook URL.');
  return raw.replace(/\/$/, '');
}

export function avatarUrl(user) {
  if (!user?.id || !user.avatar) return '';
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`;
}

export function profile(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username || 'unknown',
    globalName: user.global_name || user.globalName || user.username || 'Unknown',
    avatar: avatarUrl(user),
    accentColor: user.accent_color || null,
    bot: Boolean(user.bot)
  };
}

export function messageView(message) {
  const user = message.author || {};
  return {
    id: message.id,
    content: message.content || '',
    timestamp: message.timestamp || new Date().toISOString(),
    author: {
      id: user.id || '',
      name: user.global_name || user.username || 'Unknown',
      username: user.username || 'unknown',
      avatar: avatarUrl(user),
      bot: Boolean(user.bot)
    }
  };
}

export function createDiscordClient({ fetchImpl = fetch, apiBase = API_BASE } = {}) {
  async function request(path, { token, method = 'GET', body, webhook = false } = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      const url = webhook ? path : `${apiBase}${path}`;
      const response = await fetchImpl(url, {
        method,
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'RelayDesk/1.0 (+https://github.com/codewithriza/relay-desk)',
          ...(token ? { Authorization: `Bot ${token}` } : {}),
          ...(body ? { 'Content-Type': 'application/json' } : {})
        },
        ...(body ? { body: JSON.stringify(body) } : {})
      });
      const data = response.status === 204 ? null : await response.json().catch(() => null);
      if (!response.ok) {
        const message = response.status === 401 ? 'Discord rejected this bot token.'
          : response.status === 403 ? 'This bot does not have access to that channel or action.'
          : response.status === 404 ? 'That Discord resource was not found.'
          : response.status === 429 ? 'Discord is rate limiting this bot. Try again shortly.'
          : data?.message || 'Discord request failed.';
        throw new DiscordError(message, response.status === 429 ? 429 : response.status >= 500 ? 502 : 400);
      }
      return data;
    } catch (error) {
      if (error.name === 'AbortError') throw new DiscordError('Discord took too long to respond.', 504);
      if (error instanceof DiscordError) throw error;
      throw new DiscordError('Could not reach Discord. Try again.', 502);
    } finally {
      clearTimeout(timeout);
    }
  }

  async function bot(token) {
    const raw = String(token || '').trim();
    if (!raw || raw.length > 512 || /\s/.test(raw)) throw new DiscordError('Enter a valid bot token.');
    const user = await request('/users/@me', { token: raw });
    if (!user?.bot) throw new DiscordError('Use a bot token, never a personal account token.');
    return { token: raw, user };
  }

  async function chats(token) {
    const guilds = await request('/users/@me/guilds?limit=100', { token });
    if (!Array.isArray(guilds)) return [];
    const results = [];
    for (const guild of guilds.slice(0, 100)) {
      try {
        const channels = await request(`/guilds/${snowflake(guild.id)}/channels`, { token });
        const readable = (Array.isArray(channels) ? channels : [])
          .filter(channel => channel.type === 0 || channel.type === 5)
          .map(channel => ({ id: channel.id, name: channel.name || 'channel' }));
        if (readable.length) results.push({
          guild: {
            id: guild.id,
            name: guild.name || 'Server',
            icon: guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128` : ''
          },
          channels: readable
        });
      } catch (error) {
        if (error.status === 429) throw error;
      }
    }
    return results;
  }

  async function messages(token, channelId) {
    const id = snowflake(channelId, 'channel ID');
    const rows = await request(`/channels/${id}/messages?limit=50`, { token });
    return Array.isArray(rows) ? rows.reverse().map(messageView) : [];
  }

  async function send(token, channelId, content) {
    const id = snowflake(channelId, 'channel ID');
    const message = await request(`/channels/${id}/messages`, {
      token,
      method: 'POST',
      body: { content, allowed_mentions: { parse: [] } }
    });
    return messageView(message);
  }

  async function openDm(token, userId) {
    const id = snowflake(userId, 'user ID');
    return request('/users/@me/channels', { token, method: 'POST', body: { recipient_id: id } });
  }

  async function user(token, userId) {
    const id = snowflake(userId, 'user ID');
    return profile(await request(`/users/${id}`, { token }));
  }

  async function inspectWebhook(url) {
    return request(webhookUrl(url), { webhook: true });
  }

  async function sendWebhook(url, content) {
    const data = await request(`${webhookUrl(url)}?wait=true`, {
      webhook: true,
      method: 'POST',
      body: { content, allowed_mentions: { parse: [] } }
    });
    return messageView(data);
  }

  return { bot, chats, messages, send, openDm, user, inspectWebhook, sendWebhook };
}
