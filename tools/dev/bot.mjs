// A pretend player for testing the online town: joins the world with the dev
// login and walks back and forth near the town spawn, so you can see another
// player without opening a second browser.
//
// Usage (with `npm run dev` running):
//   node tools/dev/bot.mjs [name] [x] [y] [server]
//   node tools/dev/bot.mjs Bo 200 348 http://localhost:5173
//
// Ctrl+C to leave. Development only: it uses the name-only dev login.
import { Client } from '@colyseus/sdk';

const [name = 'Bot', x0 = '200', y0 = '348', url = 'http://localhost:5173'] = process.argv.slice(2);
const client = new Client(url);
client.auth.token = `dev:${name}`;
const room = await client.joinOrCreate('world');
room.send('look', JSON.stringify({}));
console.log(`${name} joined as ${room.sessionId}`);

let x = Number(x0);
const y = Number(y0);
let dir = 1;
const tick = setInterval(() => {
  x += dir * 6;
  if (Math.abs(x - Number(x0)) > 80) dir = -dir;
  room.send('move', { place: 'town', x, y, face: dir > 0 ? 'right' : 'left', moving: true });
}, 100);

process.on('SIGINT', async () => {
  clearInterval(tick);
  await room.leave();
  process.exit(0);
});
