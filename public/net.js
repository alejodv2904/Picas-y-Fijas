// Conexión directa entre los dos celulares (WebRTC vía PeerJS).
// El que crea la partida es el anfitrión: su navegador guarda la sala y hace de árbitro.
(function () {
  const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const q = new URLSearchParams(location.search);
  // Servidor de señalización: el público de PeerJS por defecto (solo se usa para el apretón de manos).
  const PEER_OPTS = q.get('peerhost')
    ? { host: q.get('peerhost'), port: +q.get('peerport') || 9000, path: '/', secure: false }
    : {};
  const pid = (code) => 'pyf-' + code.toLowerCase();

  let peer = null, room = null, conns = [null, null], guestConn = null;
  let isHost = false, onMsg = () => {}, onStatus = () => {}, joinCode = null, retries = 0, left = false;

  const randCode = () => Array.from({ length: 4 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('');

  // ---- Anfitrión ----
  function deliver(i, msg) {
    if (i === 0) setTimeout(() => onMsg(msg), 0);
    else if (conns[i] && conns[i].open) conns[i].send(msg);
  }
  function broadcast() { room.players.forEach((_, i) => deliver(i, room.stateFor(i))); }
  function handle(i, m) {
    const e = room.handle(i, m);
    if (e) deliver(i, { t: 'error', message: e });
    broadcast();
  }

  function create(onMessage, onSt) {
    reset(); onMsg = onMessage; onStatus = onSt; isHost = true;
    const code = randCode();
    peer = new Peer(pid(code), PEER_OPTS);
    peer.on('error', (err) => {
      if (err.type === 'unavailable-id') { create(onMessage, onSt); return; }
      onMsg({ t: 'error', message: 'No se pudo conectar. Revisa tu internet.' });
    });
    peer.on('open', () => {
      room = new Room(code); room.addPlayer();
      onMsg({ t: 'joined', code }); broadcast();
    });
    peer.on('connection', (conn) => {
      conn.on('open', () => {
        let i = -1;
        if (room.players.length < 2) i = room.addPlayer();
        else if (!room.players[1].connected) { i = 1; room.setConnected(1, true); }
        if (i < 0) { conn.send({ t: 'error', message: 'La sala está llena' }); setTimeout(() => conn.close(), 300); return; }
        if (conns[i] && conns[i] !== conn) conns[i].close();
        conns[i] = conn;
        conn.on('data', (m) => handle(i, m));
        conn.on('close', () => { if (conns[i] === conn) { room.setConnected(i, false); broadcast(); } });
        conn.send({ t: 'joined', code });
        broadcast();
      });
    });
  }

  // ---- Invitado ----
  function join(code, onMessage, onSt) {
    reset(); onMsg = onMessage; onStatus = onSt; isHost = false; joinCode = code.toUpperCase();
    peer = new Peer(undefined, PEER_OPTS);
    peer.on('error', (err) => {
      if (err.type === 'peer-unavailable') return fail('Sala no encontrada');
      if (err.type !== 'disconnected') onMsg({ t: 'error', message: 'No se pudo conectar. Revisa tu internet.' });
    });
    peer.on('open', dial);
  }
  function dial() {
    if (left) return;
    const conn = peer.connect(pid(joinCode), { reliable: true });
    guestConn = conn;
    conn.on('open', () => { retries = 0; onStatus('ok'); });
    conn.on('data', (m) => {
      if (m.t === 'closed') return fail('El anfitrión cerró la sala');
      if (m.t === 'error' && m.message === 'La sala está llena') { left = true; return fail(m.message); }
      onMsg(m);
    });
    conn.on('close', () => {
      if (left) return;
      onStatus('reconnecting');
      if (++retries > 6) return fail('Se perdió la conexión con el anfitrión');
      setTimeout(() => peer && !peer.destroyed && dial(), 1500);
    });
  }
  function fail(message) { onMsg({ t: 'gone', message }); reset(); }

  function send(m) {
    if (isHost) { if (room) handle(0, m); }
    else if (guestConn && guestConn.open) guestConn.send(m);
  }
  function reset() {
    left = true;
    try { if (isHost) conns.forEach((c) => c && c.open && c.send({ t: 'closed' })); } catch (e) {}
    try { peer && peer.destroy(); } catch (e) {}
    peer = null; room = null; conns = [null, null]; guestConn = null; retries = 0; left = false;
  }
  window.Net = { create, join, send, leave: reset };
})();
