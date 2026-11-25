const assert = require('assert');
const WebSocket = require('ws');
const { score, isValid } = require('./game');
const { server } = require('./server');

assert.deepStrictEqual(score('1234', '1234'), { picas: 0, fijas: 4 });
assert.deepStrictEqual(score('1234', '4321'), { picas: 4, fijas: 0 });
assert.deepStrictEqual(score('1234', '1567'), { picas: 0, fijas: 1 });
assert.deepStrictEqual(score('1234', '2178'), { picas: 2, fijas: 0 });
assert(isValid('1234') && !isValid('1123') && !isValid('123') && !isValid('12a4'));

function client(port) {
  const ws = new WebSocket(`ws://localhost:${port}`);
  const c = { ws, state: null, waiters: [] };
  ws.on('message', (d) => {
    const m = JSON.parse(d);
    if (m.t === 'state') c.state = m;
    c.waiters = c.waiters.filter((w) => !(w.pred(m) && (w.res(m), true)));
  });
  c.send = (m) => ws.send(JSON.stringify(m));
  c.wait = (pred) => new Promise((res) => { if (c.state && pred(c.state)) return res(c.state); c.waiters.push({ pred, res }); });
  c.open = new Promise((r) => ws.on('open', r));
  return c;
}

server.listen(0, async () => {
  const port = server.address().port;
  const a = client(port), b = client(port);
  await Promise.all([a.open, b.open]);
  a.send({ t: 'create' });
  const j = await a.wait((m) => m.t === 'joined');
  b.send({ t: 'join', code: j.code });
  await a.wait((m) => m.t === 'state' && m.phase === 'secrets');
  a.send({ t: 'secret', secret: '1234' });
  b.send({ t: 'secret', secret: '5678' });
  await a.wait((m) => m.t === 'state' && m.phase === 'playing');
  await b.wait((m) => m.t === 'state' && m.phase === 'playing');
  const first = a.state.yourTurn ? a : b, second = first === a ? b : a;
  const secretOf = (c) => (c === a ? '1234' : '5678');
  // el rival fuera de turno no puede jugar
  second.send({ t: 'guess', guess: '0123' });
  first.send({ t: 'guess', guess: secretOf(second) === '1234' ? '2134' : '5687' });
  await first.wait((m) => m.t === 'state' && m.myGuesses.length === 1);
  assert.strictEqual(first.state.myGuesses[0].fijas, 2);
  assert.strictEqual(first.state.myGuesses[0].picas, 2);
  await second.wait((m) => m.t === 'state' && m.oppGuesses.length === 1);
  assert(second.state.oppGuesses.length === 1 && second.state.myGuesses.length === 0);
  assert.strictEqual(first.state.oppSecret, null); // el secreto no se filtra
  second.send({ t: 'guess', guess: '9087' });
  await second.wait((m) => m.t === 'state' && m.myGuesses.length === 1);
  first.send({ t: 'guess', guess: secretOf(second) });
  await first.wait((m) => m.t === 'state' && m.phase === 'over');
  assert.strictEqual(first.state.winner, first.state.you);
  assert.strictEqual(first.state.oppSecret, secretOf(second));
  first.send({ t: 'rematch' }); second.send({ t: 'rematch' });
  await a.wait((m) => m.t === 'state' && m.phase === 'secrets');
  console.log('OK: todas las pruebas pasaron');
  process.exit(0);
});
