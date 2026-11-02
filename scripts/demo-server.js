// Local-only demo: fictional messages, no Discord connection or real credentials.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
const avatar = name => 'data:image/svg+xml;base64,' + readFileSync(new URL(`./demo-avatars/${name}.svg`, import.meta.url)).toString('base64');
import { createApp } from '../src/app.js';

const bot = { id: '100000000000000001', name: 'truck-kun', username: 'truck_kun', bot: true, avatar: avatar('truck-kun') };
const yuki = { id: '100000000000000002', name: 'yuki', username: 'yuki', bot: false, avatar: avatar('yuki') };
const ren = { id: '100000000000000003', name: 'ren', username: 'ren', bot: false, avatar: avatar('ren') };
const mio = { id: '100000000000000004', name: 'mio', username: 'mio', bot: false, avatar: avatar('mio') };
const channel = '200000000000000001';
const dm = '200000000000000099';
let nextId = 400000000000000000n;
const message = (author, content, minute) => ({ id: String(nextId++), author, content, timestamp: `2026-11-03T18:${String(minute).padStart(2, '0')}:00Z` });
const conversations = new Map([
  [channel, [
    message(yuki, 'who renamed the study group to filler arc survivors', 41),
    message(ren, 'we have a deadline tomorrow and 0 character development', 42),
    message(mio, 'truck-kun can you isekai me before the presentation', 42),
    message(bot, 'best i can do is a 25 minute pomodoro', 43),
    message(yuki, 'wait is this the bot talking or riza', 44),
    message(bot, 'riza. borrowed the bot account. the truck has a manual transmission', 44),
    message(ren, 'bro is piloting the bot like an eva', 45)
  ]],
  [dm, [
    message(yuki, 'wait can the bot owner actually read what i send you', 46),
    message(bot, 'yeah. riza here. i can read the messages you send this bot and type back myself', 46),
    message(yuki, 'so a human in a bot costume', 47),
    message(bot, 'exactly. still the bot account, just me at the keyboard', 47),
    message(yuki, 'ok tell ren the study arc starts in 5', 48)
  ]]
]);
const chats = [{ guild: { id: '300000000000000001', name: 'filler arc survivors · demo', icon: avatar('truck-kun') }, channels: [
  { id: channel, name: 'general' }, { id: '200000000000000002', name: 'anime-spoilers' }, { id: '200000000000000003', name: 'study-arc' }
] }];
const discord = {
  async bot(token) {
    if (token !== 'demo') throw new Error('This is a local demo. Enter demo, not a real token.');
    return { token: 'demo', user: { ...bot, global_name: bot.name } };
  },
  async chats() { return chats; },
  async messages(_token, id) { return [...(conversations.get(id) || [])]; },
  async send(_token, id, content) {
    const row = message(bot, content, 49);
    const rows = conversations.get(id) || [];
    rows.push(row);
    conversations.set(id, rows.slice(-50));
    return row;
  },
  async openDm(_token, id) {
    if (id !== yuki.id) throw new Error('The demo DM is available for yuki.');
    return { id: dm };
  },
  async user() { return { ...yuki, globalName: yuki.name, accentColor: 0x8b5cf6 }; },
  async inspectWebhook() { throw new Error('Webhook mode is disabled in the local demo.'); }
};
createServer(createApp({ discord, publicOrigin: 'http://localhost:3001' })).listen(3001, '127.0.0.1', () => {
  console.log('Demo: http://localhost:3001 — enter demo as the bot token. Fictional chat; nothing is sent to Discord.');
});
