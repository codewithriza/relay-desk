import { createServer } from 'node:http';
import { createApp } from './app.js';

const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be 1–65535.');
if (process.env.NODE_ENV === 'production' && !process.env.PUBLIC_ORIGIN?.startsWith('https://')) {
  throw new Error('Set PUBLIC_ORIGIN to the public HTTPS origin in production.');
}

createServer(createApp()).listen(port, () => {
  console.log(`Relay Desk listening on http://localhost:${port}`);
});
