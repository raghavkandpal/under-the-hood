// Password storage schemes and a dictionary attack, using the real Web Crypto API (browser and Node 20+). No DOM.

const enc = new TextEncoder();
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
const subtle = globalThis.crypto.subtle;

export async function sha256(s) { return hex(await subtle.digest("SHA-256", enc.encode(s))); }
export async function pbkdf2(pw, salt, iterations) {
  const key = await subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveBits"]);
  return hex(await subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc.encode(salt), iterations }, key, 256));
}

export const SCHEMES = {
  plain: { label: "Plaintext", about: "The password itself. Anyone who reads the database reads every password." },
  sha: { label: "SHA-256, no salt", about: "A one-way hash. But the same password always gives the same hash, and SHA-256 is built to be fast." },
  salted: { label: "SHA-256 + unique salt", about: "A random salt per user is mixed in, so equal passwords look different and precomputed tables are useless." },
  pbkdf2: { label: "PBKDF2 (slow, salted)", about: "Salted, and deliberately slow: the hash is repeated thousands of times, so each guess costs the attacker too." },
};

export async function store(scheme, pw, salt, iterations = 10000) {
  switch (scheme) {
    case "plain": return pw;
    case "sha": return sha256(pw);
    case "salted": return sha256(salt + pw);
    case "pbkdf2": return pbkdf2(pw, salt, iterations);
  }
}

export function randomSalt(bytes = 8) { const b = new Uint8Array(bytes); globalThis.crypto.getRandomValues(b); return hex(b); }

/** Try every dictionary word against every user. Reports guesses (hash computations) spent and who fell. */
export async function attack(scheme, users, dictionary, { iterations = 10000, onProgress, shouldStop } = {}) {
  const cracked = new Map(); let guesses = 0; const t0 = performance.now();
  if (scheme === "plain") { for (const u of users) if (dictionary.includes(u.stored)) cracked.set(u.name, u.stored); return { cracked, guesses: 0, ms: performance.now() - t0 }; }
  if (scheme === "sha") {
    // one table for everybody: hash each word once, then look users up
    const table = new Map();
    for (const w of dictionary) { table.set(await sha256(w), w); guesses++; }
    for (const u of users) if (table.has(u.stored)) cracked.set(u.name, table.get(u.stored));
    return { cracked, guesses, ms: performance.now() - t0 };
  }
  for (const u of users) {
    for (const w of dictionary) {
      if (shouldStop?.()) return { cracked, guesses, ms: performance.now() - t0, stopped: true };
      guesses++;
      if ((await store(scheme, w, u.salt, iterations)) === u.stored) { cracked.set(u.name, w); break; }
      if (guesses % 25 === 0) onProgress?.(guesses, cracked);
    }
  }
  return { cracked, guesses, ms: performance.now() - t0 };
}

// A short list of notoriously common passwords (the kind every attacker tries first), plus simple variants.
const BASE = ["123456", "password", "123456789", "12345678", "qwerty", "abc123", "111111", "letmein", "monkey", "dragon",
  "sunshine", "iloveyou", "princess", "football", "baseball", "welcome", "shadow", "superman", "master", "hello",
  "freedom", "whatever", "trustno1", "starwars", "passw0rd", "qwerty123", "admin", "login", "charlie", "donald",
  "michael", "jessica", "ashley", "bailey", "flower", "hottie", "loveme", "zaq1zaq1", "batman", "summer"];
export const DICTIONARY = [...BASE, ...BASE.slice(0, 20).map(w => w + "1"), ...BASE.slice(0, 20).map(w => w + "!"), ...BASE.slice(0, 20).map(w => w[0].toUpperCase() + w.slice(1))];
