// Timing attacks: an early-exit string compare takes longer the more of the secret you guessed right, and an attacker
// who can time it recovers the secret one character at a time. Costs are in character comparisons. No DOM.

/** early: stop at the first difference, like a === b. constant: always look at every character, like crypto.timingSafeEqual. */
export function cost(kind, secret, guess) {
  if (kind === "constant") return secret.length;
  let i = 0; while (i < secret.length && secret[i] === guess[i]) i++;
  return Math.min(i + 1, secret.length);
}

const HEX = "0123456789abcdef";
const gauss = rnd => { let u = 0; while (!u) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd()); };

/**
 * Guess a hex secret one position at a time: try all 16 characters there, time each `samples` times (each timing is
 * the true cost plus network noise), keep the slowest. The last character is found by trying all 16 logins. Returns the guess, request count, and each position's averages.
 */
export function attack({ secret, kind, noise = 2, samples = 100, rnd }) {
  let known = ""; const rounds = [];
  for (let pos = 0; pos < secret.length; pos++) {
    const avg = [...HEX].map(c => { const g = (known + c).padEnd(secret.length, "0"); let s = 0; for (let k = 0; k < samples; k++) s += cost(kind, secret, g) + noise * gauss(rnd); return s / samples; });
    // The last character costs the same right or wrong, but the right one is the guess the server accepts.
    const last = pos === secret.length - 1, best = last ? [...HEX].findIndex(c => known + c === secret) : avg.indexOf(Math.max(...avg));
    known += HEX[best] ?? "?"; rounds.push({ avg, pick: HEX[best] ?? "?", right: secret[pos], byLogin: last });
  }
  return { recovered: known, requests: secret.length * 16 * samples, rounds };
}
