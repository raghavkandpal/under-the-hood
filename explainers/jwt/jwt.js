// JSON Web Tokens (HS256): a header and claims anyone can read, plus an HMAC-SHA256 signature only the key holder
// can make. Uses WebCrypto, so it runs the same in the browser and in Node. No DOM.

const enc = new TextEncoder(), dec = new TextDecoder();
const b64url = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64url = s => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
/** One base64url-encoded JSON part of a token. */
export const part = obj => b64url(enc.encode(JSON.stringify(obj)));

async function hmac(key, data) {
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(data))));
}

export async function sign(claims, key, header = { alg: "HS256", typ: "JWT" }) {
  const head = `${part(header)}.${part(claims)}`;
  return `${head}.${header.alg === "none" ? "" : await hmac(key, head)}`;
}
export function decode(token) {
  const [h, p, s] = token.split(".");
  try { return { header: JSON.parse(dec.decode(unb64url(h))), payload: JSON.parse(dec.decode(unb64url(p))), signature: s }; }
  catch { return null; }
}

/**
 * Check a token. `now` is in seconds. trustHeader: the classic bug of letting the token's own header choose the
 * algorithm, so a token that says alg "none" needs no signature at all.
 */
export async function verify(token, key, { now, trustHeader = false } = {}) {
  const d = decode(token); if (!d) return { error: "not a token" };
  if (!(trustHeader && d.header.alg === "none")) {
    if (d.header.alg !== "HS256" && !trustHeader) return { error: `unexpected algorithm ${d.header.alg}` };
    // shortcut: plain string compare; real code should compare in constant time (see timing attacks).
    if (d.signature !== await hmac(key, token.slice(0, token.lastIndexOf(".")))) return { error: "bad signature" };
  }
  if (d.payload.exp !== undefined && now >= d.payload.exp) return { error: "expired" };
  return { claims: d.payload };
}
