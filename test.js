const assert = require('assert');
const { score, isValid } = require('./public/game');
const { Room } = require('./public/room');

assert.deepStrictEqual(score('1234', '1234'), { picas: 0, fijas: 4 });
assert.deepStrictEqual(score('1234', '4321'), { picas: 4, fijas: 0 });
assert.deepStrictEqual(score('1234', '1567'), { picas: 0, fijas: 1 });
assert.deepStrictEqual(score('1234', '2178'), { picas: 2, fijas: 0 });
assert.deepStrictEqual(score('1234', '5678'), { picas: 0, fijas: 0 });
assert(isValid('1234') && !isValid('1123') && !isValid('123') && !isValid('12a4'));

const r = new Room('ABCD');
assert.strictEqual(r.addPlayer(), 0); assert.strictEqual(r.phase, 'waiting');
assert.strictEqual(r.addPlayer(), 1); assert.strictEqual(r.phase, 'secrets');
assert.strictEqual(r.addPlayer(), -1);
assert(r.handle(0, { t: 'secret', secret: '1123' }));       // inválido
r.handle(0, { t: 'secret', secret: '1234' });
r.handle(1, { t: 'secret', secret: '5678' });
assert.strictEqual(r.phase, 'playing');
const a = r.turn, b = 1 - a;
r.handle(b, { t: 'guess', guess: '0123' });                   // fuera de turno: se ignora
assert.strictEqual(r.pending, null);
r.handle(a, { t: 'guess', guess: '2134' });
assert.strictEqual(r.stateFor(b).toAnswer, true);
assert.strictEqual(r.stateFor(a).waitingAnswer, true);
r.handle(a, { t: 'guess', guess: '9876' });                   // no puede adivinar de nuevo sin respuesta
assert.strictEqual(r.pending.guess, '2134');
assert(r.handle(a, { t: 'answer', picas: 0, fijas: 0 }) === undefined && r.pending);   // el mismo no se responde
assert(r.handle(b, { t: 'answer', picas: 1, fijas: 3 }));     // imposible (3 fijas + 1 pica)
assert(r.handle(b, { t: 'answer', picas: 3, fijas: 2 }));     // suma > 4
r.handle(b, { t: 'answer', picas: 2, fijas: 1 });
assert.deepStrictEqual(r.players[a].guesses[0], { guess: '2134', picas: 2, fijas: 1 });
assert.strictEqual(r.turn, b); assert.strictEqual(r.pending, null);
r.handle(b, { t: 'guess', guess: '9087' }); r.handle(a, { t: 'answer', picas: 0, fijas: 0 });
r.handle(a, { t: 'guess', guess: '1234' }); r.handle(b, { t: 'answer', picas: 0, fijas: 4 });
assert.strictEqual(r.phase, 'over'); assert.strictEqual(r.winner, a);
r.handle(0, { t: 'rematch' }); r.handle(1, { t: 'rematch' });
assert.strictEqual(r.phase, 'secrets');
console.log('OK: todas las pruebas pasaron');
