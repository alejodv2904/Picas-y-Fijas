const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const { isValid, score, LEN } = require('./game');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.webmanifest': 'application/manifest+json', '.json': 'application/json',
};

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(PUBLIC, p));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('No encontrado'); }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': p === '/sw.js' ? 'no-cache' : 'public, max-age=300',
    });
    res.end(data);
  });
});

// ---------- Salas ----------
const rooms = new Map();
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function newCode() {
  let c;
  do { c = Array.from({ length: 4 }, () => CODE_CHARS[crypto.randomInt(CODE_CHARS.length)]).join(''); }
  while (rooms.has(c));
  return c;
}

function newRoom() {
  const code = newCode();
  const room = { code, players: [], phase: 'waiting', turn: 0, winner: null, rematch: [false, false], last: Date.now() };
  rooms.set(code, room);
  return room;
}

function newPlayer(room, ws) {
  const p = { token: crypto.randomBytes(12).toString('hex'), ws, secret: null, guesses: [] };
  room.players.push(p);
  return p;
}

function send(ws, msg) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg)); }

function stateFor(room, i) {
  const me = room.players[i], opp = room.players[1 - i];
  return {
    t: 'state', code: room.code, phase: room.phase, you: i,
    oppConnected: !!(opp && opp.ws),
    youReady: !!me.secret, oppReady: !!(opp && opp.secret),
    yourTurn: room.phase === 'playing' && room.turn === i,
    myGuesses: me.guesses,
    oppGuesses: opp ? opp.guesses : [],
    winner: room.winner,          // índice del ganador o null
    oppSecret: room.phase === 'over' && opp ? opp.secret : null,
    mySecret: me.secret,
    rematchMe: room.rematch[i], rematchOpp: room.rematch[1 - i],
  };
}

function broadcast(room) {
  room.last = Date.now();
  room.players.forEach((p, i) => send(p.ws, stateFor(room, i)));
}

function err(ws, message) { send(ws, { t: 'error', message }); }

// ---------- WebSocket ----------
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.ctx = null; // { room, idx }

  ws.on('message', (raw) => {
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    const { room, idx } = ws.ctx || {};

    switch (m.t) {
      case 'create': {
        if (ws.ctx) return;
        const r = newRoom();
        const p = newPlayer(r, ws);
        ws.ctx = { room: r, idx: 0 };
        send(ws, { t: 'joined', code: r.code, token: p.token });
        broadcast(r);
        break;
      }
      case 'join': {
        if (ws.ctx) return;
        const r = rooms.get(String(m.code || '').toUpperCase().trim());
        if (!r) return err(ws, 'Sala no encontrada');
        if (r.players.length >= 2) return err(ws, 'La sala está llena');
        const p = newPlayer(r, ws);
        ws.ctx = { room: r, idx: 1 };
        r.phase = 'secrets';
        send(ws, { t: 'joined', code: r.code, token: p.token });
        broadcast(r);
        break;
      }
      case 'resume': {
        if (ws.ctx) return;
        const r = rooms.get(String(m.code || '').toUpperCase());
        const i = r ? r.players.findIndex((p) => p.token === m.token) : -1;
        if (i < 0) return send(ws, { t: 'resume_failed' });
        const old = r.players[i].ws;
        r.players[i].ws = ws;
        if (old && old !== ws) { old.ctx = null; old.close(); }
        ws.ctx = { room: r, idx: i };
        send(ws, { t: 'joined', code: r.code, token: r.players[i].token });
        broadcast(r);
        break;
      }
      case 'secret': {
        if (!room || room.phase !== 'secrets') return;
        if (!isValid(m.secret)) return err(ws, `Usa ${LEN} dígitos distintos`);
        const me = room.players[idx];
        if (me.secret) return;
        me.secret = m.secret;
        if (room.players.length === 2 && room.players.every((p) => p.secret)) {
          room.phase = 'playing';
          room.turn = crypto.randomInt(2);
        }
        broadcast(room);
        break;
      }
      case 'guess': {
        if (!room || room.phase !== 'playing' || room.turn !== idx) return;
        if (!isValid(m.guess)) return err(ws, `Usa ${LEN} dígitos distintos`);
        const me = room.players[idx], opp = room.players[1 - idx];
        if (me.guesses.some((g) => g.guess === m.guess)) return err(ws, 'Ya probaste ese número');
        const r = score(opp.secret, m.guess);
        me.guesses.push({ guess: m.guess, ...r });
        if (r.fijas === LEN) { room.phase = 'over'; room.winner = idx; }
        else room.turn = 1 - idx;
        broadcast(room);
        break;
      }
      case 'rematch': {
        if (!room || room.phase !== 'over') return;
        room.rematch[idx] = true;
        if (room.rematch[0] && room.rematch[1]) {
          room.players.forEach((p) => { p.secret = null; p.guesses = []; });
          room.rematch = [false, false];
          room.winner = null;
          room.phase = 'secrets';
        }
        broadcast(room);
        break;
      }
      case 'leave': {
        if (!room) return;
        room.players[idx].ws = null;
        ws.ctx = null;
        room.players.forEach((p, i) => send(p.ws, stateFor(room, i)));
        if (room.players.every((p) => !p.ws)) rooms.delete(room.code);
        break;
      }
    }
  });

  ws.on('close', () => {
    if (!ws.ctx) return;
    const { room, idx } = ws.ctx;
    if (room.players[idx] && room.players[idx].ws === ws) {
      room.players[idx].ws = null;
      room.players.forEach((p, i) => send(p.ws, stateFor(room, i)));
    }
  });
});

// Latido para detectar conexiones muertas + limpieza de salas viejas
setInterval(() => {
  wss.clients.forEach((ws) => { if (!ws.isAlive) return ws.terminate(); ws.isAlive = false; ws.ping(); });
  const now = Date.now();
  for (const [code, r] of rooms) {
    if (now - r.last > 3 * 3600 * 1000) rooms.delete(code);
  }
}, 25000);

if (require.main === module) {
  server.listen(PORT, () => console.log(`Picas y Fijas en http://localhost:${PORT}`));
}
module.exports = { server };
