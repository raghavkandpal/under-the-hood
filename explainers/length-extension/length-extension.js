// Length extension attacks on sha1(secret || message), with no DOM so it can be tested in Node.
import { sha1 } from "../../shared/git.js";
import { hmacSha1, textBytes } from "../../shared/totp.js";

export const SECRET = textBytes("k3y-9fQ2vL7xPm4Z"); // 16 bytes, self-made
export const MESSAGE = "user=alice&role=user";
export const SUFFIX = "&role=admin";

const hex = b => Array.from(b, x => x.toString(16).padStart(2, "0")).join("");
const unhex = h => Uint8Array.from(h.match(/../g), x => parseInt(x, 16));
const cat = (...parts) => { const o = new Uint8Array(parts.reduce((s, p) => s + p.length, 0)); let i = 0; for (const p of parts) { o.set(p, i); i += p.length; } return o; };
export { hex };

/** SHA-1 padding for a message of `len` bytes: 0x80, zeros, then the 64-bit bit length. */
export function pad(len) {
  const total = ((len + 9 + 63) >> 6) << 6, p = new Uint8Array(total - len);
  p[0] = 0x80;
  new DataView(p.buffer).setUint32(p.length - 4, len * 8); // lengths here stay under 2^32 bits
  return p;
}

/** The five 32-bit words a SHA-1 hex digest stands for: the state after the last block. */
export const stateOf = digest => digest.match(/.{8}/g).map(w => parseInt(w, 16));

/** The vulnerable MAC: sha1(secret || message), as hex. */
export const mac = (secret, message) => sha1(cat(secret, message));
/** The fix: HMAC-SHA1, as hex. */
export const hmac = (secret, message) => hex(hmacSha1(secret, message));

/** Resume sha1(m) over x: gives sha1(m || pad(m) || x), given only sha1(m) and len(m). */
export const resume = (digest, len, x) => sha1(x, { state: stateOf(digest), count: len + pad(len).length });

/** The role a naive server reads: the last `role=` in the query, with bytes read as Latin-1. */
export function roleOf(bytes) {
  const parts = Array.from(bytes, b => String.fromCharCode(b)).join("").split("&").filter(p => p.startsWith("role="));
  return parts.length ? parts[parts.length - 1].slice(5) : null;
}

/** A server that holds a secret and counts the checks it answers. */
export function makeServer(secret, macFn = mac) {
  const s = { queries: 0, check(message, tag) { s.queries++; return macFn(secret, message) === tag; } };
  return s;
}

/** The attacker's move: only message, its MAC, a guessed key length and a suffix go in. */
export function forge(message, tag, keyLen, suffix) {
  const m = typeof message === "string" ? textBytes(message) : message, x = typeof suffix === "string" ? textBytes(suffix) : suffix;
  const glue = pad(keyLen + m.length);
  return { message: cat(m, glue, x), mac: sha1(x, { state: stateOf(tag), count: keyLen + m.length + glue.length }), glue };
}

/** Try key lengths 1, 2, 3 … until the server accepts; returns the length found and the queries used. */
export function crack(server, message, tag, suffix, maxLen = 64) {
  const before = server.queries;
  for (let k = 1; k <= maxLen; k++) {
    const f = forge(message, tag, k, suffix);
    if (server.check(f.message, f.mac)) return { keyLen: k, forged: f, queries: server.queries - before };
  }
  return { keyLen: null, forged: null, queries: server.queries - before };
}

/** Message bytes as a query string: printable ASCII stays, everything else becomes %XX. */
export const show = bytes => Array.from(bytes, b => (b >= 33 && b < 127 && b !== 37 ? String.fromCharCode(b) : "%" + b.toString(16).padStart(2, "0").toUpperCase())).join("");

/** Everything the page shows, from its three inputs: which MAC the server uses, the guessed key length, and whether "Try 1, 2, 3 …" was pressed. */
export function view(kind, guess, searched) {
  const macFn = kind === "hmac" ? hmac : mac, server = makeServer(SECRET, macFn), m = textBytes(MESSAGE);
  const tag = macFn(SECRET, m), f = forge(m, tag, guess, SUFFIX), accepted = server.check(f.message, f.mac);
  const found = searched ? crack(makeServer(SECRET, macFn), m, tag, SUFFIX) : null;
  return {
    tag, forgedMac: f.mac, forgedMessage: show(f.message), padBytes: f.glue.length, forgedLength: f.message.length,
    accepted, role: accepted ? roleOf(f.message) : null,
    search: found && { keyLen: found.keyLen, queries: found.queries },
  };
}
