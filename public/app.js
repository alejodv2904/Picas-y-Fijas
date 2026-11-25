(() => {
  const $ = (s) => document.querySelector(s);
  const screens = ['home', 'wait', 'secret', 'play', 'over'];
  let ws, st = null, input = '', session = load(), retry = 0, wantOpen = true;

  function load() { try { return JSON.parse(localStorage.getItem('pyf') || 'null'); } catch { return null; } }
  function save(s) { session = s; try { s ? localStorage.setItem('pyf', JSON.stringify(s)) : localStorage.removeItem('pyf'); } catch {} }

  // ---------- Red ----------
  function connect(onOpen) {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}`);
    ws.onopen = () => { retry = 0; $('#conn').classList.add('hidden'); onOpen && onOpen(); };
    ws.onmessage = (e) => onMsg(JSON.parse(e.data));
    ws.onclose = () => {
      if (!wantOpen) return;
      if (session) $('#conn').classList.remove('hidden');
      setTimeout(() => connect(() => session && send({ t: 'resume', ...session })), Math.min(1000 * 2 ** retry++, 8000));
    };
  }
  function send(m) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); }

  function onMsg(m) {
    if (m.t === 'joined') { save({ code: m.code, token: m.token }); }
    else if (m.t === 'resume_failed') { save(null); st = null; show('home'); }
    else if (m.t === 'error') { toast(m.message); }
    else if (m.t === 'state') { const prev = st; st = m; render(prev); }
  }

  // ---------- UI ----------
  function show(name) {
    screens.forEach((s) => $('#s-' + s).classList.toggle('hidden', s !== name));
    const pad = name === 'secret' || (name === 'play');
    $('#pad').classList.toggle('hidden', !pad);
    // los slots viven dentro de la pantalla activa
    document.querySelectorAll('[data-slots]').forEach((el) => el.dataset.on = el.closest('.screen').id === 's-' + name ? '1' : '');
    drawSlots();
  }

  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden');
    document.querySelectorAll('[data-slots]').forEach((s) => { s.classList.remove('shake'); void s.offsetWidth; s.classList.add('shake'); });
    navigator.vibrate && navigator.vibrate(120);
    clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.add('hidden'), 1800);
  }

  function drawSlots() {
    document.querySelectorAll('[data-slots]').forEach((el) => {
      el.innerHTML = '';
      for (let i = 0; i < 4; i++) {
        const d = document.createElement('div');
        d.className = 'slot' + (el.dataset.on && i === input.length ? ' on' : '');
        d.textContent = el.dataset.on ? (input[i] || '') : '';
        el.appendChild(d);
      }
    });
    $('#pad').querySelectorAll('[data-d]').forEach((b) => b.disabled = input.includes(b.dataset.d));
  }

  // Texto natural: "2 picas y 1 fija", "3 fijas", "1 pica", "Nada"
  function resultado(g) {
    const parts = [];
    if (g.picas) parts.push(`<span class="p">${g.picas} ${g.picas === 1 ? 'pica' : 'picas'}</span>`);
    if (g.fijas) parts.push(`<span class="f">${g.fijas} ${g.fijas === 1 ? 'fija' : 'fijas'}</span>`);
    return parts.length ? parts.join(' y ') : '<span class="x">Nada</span>';
  }
  function guessRow(g, i) {
    const li = document.createElement('li');
    li.innerHTML = `<span class="i">${i + 1}.</span><span class="n">${g.guess}</span><span class="r">${resultado(g)}</span>`;
    return li;
  }
  function fill(ol, arr) {
    ol.innerHTML = '';
    if (!arr.length) { ol.innerHTML = '<li class="empty">Sin intentos aún</li>'; return; }
    arr.forEach((g, i) => ol.appendChild(guessRow(g, i)));
    ol.scrollTop = ol.scrollHeight;
  }

  function render(prev) {
    if (!st) return;
    const phaseChanged = !prev || prev.phase !== st.phase || prev.youReady !== st.youReady;
    if (phaseChanged) input = '';
    if (st.phase === 'waiting') { $('#room-code').textContent = st.code; show('wait'); }
    else if (st.phase === 'secrets') {
      if (st.youReady) {
        $('#s-secret h2').textContent = 'Número guardado ✔';
        $('#secret-status').textContent = st.oppReady ? '' : 'Esperando que tu rival elija el suyo…';
        $('#s-secret .slots').style.display = 'none'; show('secret'); $('#pad').classList.add('hidden');
      } else {
        $('#s-secret h2').textContent = 'Elige tu número secreto';
        $('#secret-status').textContent = st.oppConnected ? '' : 'Tu rival se desconectó, esperando…';
        $('#s-secret .slots').style.display = ''; show('secret');
      }
    } else if (st.phase === 'playing') {
      const turn = $('#turn');
      turn.className = 'turn' + (st.yourTurn ? ' mine' : '');
      turn.textContent = !st.oppConnected ? 'Rival desconectado… esperando' : st.yourTurn ? '¡Tu turno!' : 'Turno del rival…';
      fill($('#list-mine'), st.myGuesses); fill($('#list-opp'), st.oppGuesses);
      if (prev && prev.yourTurn !== st.yourTurn && st.yourTurn) navigator.vibrate && navigator.vibrate(60);
      show('play');
    } else if (st.phase === 'over') {
      const won = st.winner === st.you;
      $('#over-title').textContent = won ? '🎉 ¡Ganaste!' : '😬 Perdiste';
      $('#over-mine').textContent = st.mySecret; $('#over-opp').textContent = st.oppSecret;
      $('#btn-rematch').disabled = st.rematchMe;
      $('#rematch-status').textContent = st.rematchOpp && !st.rematchMe ? 'Tu rival quiere revancha' : st.rematchMe ? 'Esperando al rival…' : '';
      show('over');
    }
  }

  // ---------- Eventos ----------
  $('#btn-create').onclick = () => send({ t: 'create' });
  $('#btn-join').onclick = joinFromInput;
  $('#inp-code').addEventListener('keydown', (e) => e.key === 'Enter' && joinFromInput());
  function joinFromInput() { const c = $('#inp-code').value.trim(); if (c.length === 4) send({ t: 'join', code: c }); else toast('Código de 4 caracteres'); }

  $('#btn-share').onclick = async () => {
    const url = `${location.origin}/?sala=${st.code}`;
    const text = `¡Juega Picas y Fijas conmigo! Código: ${st.code}`;
    try { if (navigator.share) return await navigator.share({ title: 'Picas y Fijas', text, url }); } catch { return; }
    try { await navigator.clipboard.writeText(`${text} ${url}`); toast('Enlace copiado'); } catch { prompt('Copia el enlace:', url); }
  };
  document.querySelectorAll('[data-leave]').forEach((b) => b.onclick = () => { send({ t: 'leave' }); save(null); st = null; input = ''; show('home'); });
  $('#btn-rematch').onclick = () => send({ t: 'rematch' });
  document.querySelectorAll('.tab').forEach((b) => b.onclick = () => {
    document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === b));
    $('#list-mine').classList.toggle('hidden', b.dataset.tab !== 'mine');
    $('#list-opp').classList.toggle('hidden', b.dataset.tab !== 'opp');
  });

  $('#pad').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b || !st) return;
    if (b.dataset.d && input.length < 4 && !input.includes(b.dataset.d)) input += b.dataset.d;
    else if (b.dataset.act === 'back') input = input.slice(0, -1);
    else if (b.dataset.act === 'ok') submit();
    drawSlots();
  });
  document.addEventListener('keydown', (e) => {
    if (document.activeElement === $('#inp-code') || !st) return;
    if (/^\d$/.test(e.key) && input.length < 4 && !input.includes(e.key)) input += e.key;
    else if (e.key === 'Backspace') input = input.slice(0, -1);
    else if (e.key === 'Enter') submit();
    drawSlots();
  });

  function submit() {
    if (input.length < 4) return toast('Faltan dígitos');
    if (st.phase === 'secrets' && !st.youReady) send({ t: 'secret', secret: input });
    else if (st.phase === 'playing') {
      if (!st.yourTurn) return toast('No es tu turno');
      send({ t: 'guess', guess: input }); input = '';
    }
  }

  // ---------- Arranque ----------
  const sala = new URLSearchParams(location.search).get('sala');
  if (sala) { $('#inp-code').value = sala.toUpperCase(); history.replaceState(null, '', '/'); }
  connect(() => {
    if (session) send({ t: 'resume', ...session });
    else if (sala && sala.length === 4) send({ t: 'join', code: sala });
  });
  show('home');
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && (!ws || ws.readyState > 1)) connect(() => session && send({ t: 'resume', ...session }));
  });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
