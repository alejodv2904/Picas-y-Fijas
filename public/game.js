// Lógica pura del juego (sin red). Funciona en el navegador y en Node (pruebas).
(function (root) {
  const LEN = 4;
  const isValid = (n) => typeof n === 'string' && /^\d{4}$/.test(n) && new Set(n).size === LEN;
  // fijas: dígito correcto en su posición. picas: dígito correcto en otra posición.
  function score(secret, guess) {
    let fijas = 0, picas = 0;
    for (let i = 0; i < LEN; i++) {
      if (guess[i] === secret[i]) fijas++;
      else if (secret.includes(guess[i])) picas++;
    }
    return { picas, fijas };
  }
  const api = { LEN, isValid, score };
  if (typeof module !== 'undefined') module.exports = api; else root.Game = api;
})(typeof self !== 'undefined' ? self : this);
