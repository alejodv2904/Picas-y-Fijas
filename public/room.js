// Estado y reglas de una sala de 2 jugadores. Lo ejecuta el celular del anfitrión.
(function (root) {
  const G = typeof require !== 'undefined' ? require('./game') : root.Game;

  class Room {
    constructor(code) {
      this.code = code; this.players = []; this.phase = 'waiting';
      this.turn = 0; this.pending = null; this.winner = null; this.rematch = [false, false];
    }
    addPlayer() {
      if (this.players.length >= 2) return -1;
      this.players.push({ secret: null, guesses: [], connected: true });
      if (this.players.length === 2) this.phase = 'secrets';
      return this.players.length - 1;
    }
    setConnected(i, v) { if (this.players[i]) this.players[i].connected = v; }

    stateFor(i) {
      const me = this.players[i], opp = this.players[1 - i];
      return {
        t: 'state', code: this.code, phase: this.phase, you: i,
        oppConnected: !!(opp && opp.connected),
        youReady: !!me.secret, oppReady: !!(opp && opp.secret),
        yourTurn: this.phase === 'playing' && this.turn === i && !this.pending,
        toAnswer: !!(this.pending && this.pending.by !== i),
        waitingAnswer: !!(this.pending && this.pending.by === i),
        pending: this.pending,
        myGuesses: me.guesses, oppGuesses: opp ? opp.guesses : [],
        winner: this.winner, mySecret: me.secret,
        oppSecret: this.phase === 'over' && opp ? opp.secret : null,
        rematchMe: this.rematch[i], rematchOpp: this.rematch[1 - i],
      };
    }

    // Devuelve un mensaje de error (string) o undefined si todo bien.
    handle(i, m) {
      const me = this.players[i], opp = this.players[1 - i];
      if (m.t === 'secret') {
        if (this.phase !== 'secrets' || me.secret) return;
        if (!G.isValid(m.secret)) return 'Usa 4 dígitos distintos';
        me.secret = m.secret;
        if (this.players.length === 2 && this.players.every((p) => p.secret)) {
          this.phase = 'playing'; this.turn = Math.random() < 0.5 ? 0 : 1;
        }
      } else if (m.t === 'guess') {
        // El que adivina propone un número; el rival le dice cuántas picas y fijas tiene.
        if (this.phase !== 'playing' || this.turn !== i || this.pending) return;
        if (!G.isValid(m.guess)) return 'Usa 4 dígitos distintos';
        if (me.guesses.some((g) => g.guess === m.guess)) return 'Ya probaste ese número';
        this.pending = { by: i, guess: m.guess };
      } else if (m.t === 'answer') {
        if (this.phase !== 'playing' || !this.pending || this.pending.by === i) return;
        const { picas, fijas } = m;
        const ok = Number.isInteger(picas) && Number.isInteger(fijas) && picas >= 0 && fijas >= 0
          && picas + fijas <= G.LEN && !(fijas === G.LEN - 1 && picas === 1);
        if (!ok) return 'Respuesta imposible: revisa las picas y fijas';
        const by = this.pending.by;
        this.players[by].guesses.push({ guess: this.pending.guess, picas, fijas });
        this.pending = null;
        if (fijas === G.LEN) { this.phase = 'over'; this.winner = by; } else this.turn = i;
      } else if (m.t === 'rematch') {
        if (this.phase !== 'over') return;
        this.rematch[i] = true;
        if (this.rematch[0] && this.rematch[1]) {
          this.players.forEach((p) => { p.secret = null; p.guesses = []; });
          this.rematch = [false, false]; this.winner = null; this.pending = null; this.phase = 'secrets';
        }
      }
    }
  }

  if (typeof module !== 'undefined') module.exports = { Room }; else root.Room = Room;
})(typeof self !== 'undefined' ? self : this);
