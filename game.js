// Lógica pura del juego (sin red) para poder probarla.
const LEN = 4;

function isValid(n) {
  return typeof n === 'string' && /^\d{4}$/.test(n) && new Set(n).size === LEN;
}

// fijas: dígito correcto en posición correcta. picas: dígito correcto en otra posición.
function score(secret, guess) {
  let fijas = 0, picas = 0;
  for (let i = 0; i < LEN; i++) {
    if (guess[i] === secret[i]) fijas++;
    else if (secret.includes(guess[i])) picas++;
  }
  return { picas, fijas };
}

module.exports = { LEN, isValid, score };
