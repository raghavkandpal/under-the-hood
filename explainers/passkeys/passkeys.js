// Passkeys: registration, assertion and the server's checks, with toy RSA from shared/rsa.js. No DOM.
import { keygen, sign, verify } from "../../shared/rsa.js";
import { verify as verifyTotp, totp, textBytes } from "../../shared/totp.js";

export const REAL = "https://example.com", FAKE = "https://examp1e.test", RP = "example.com";

export const hostOf = origin => new URL(origin).hostname;
/** Suffix match on a dot boundary. Real browsers use the public suffix list so "co.uk" can't be an RP ID. */
export const rpIdAllowed = (rpId, origin) => { const h = hostOf(origin); return h === rpId || h.endsWith("." + rpId); };

/** The authenticator creates a key pair for one RP ID. Only the public half goes to the server. */
export function register(server, rpId, rnd, bits = 64) {
  const key = keygen(bits, rnd), id = "cred-" + server.creds.size;
  server.creds.set(id, { pub: { n: key.n, e: key.e }, counter: 0, rpId });
  return { id, key, rpId, counter: 0, synced: false };
}
export const newServer = () => ({ creds: new Map(), challenges: new Set(), n: 0 });
export function challenge(server) { const c = "ch" + ++server.n; server.challenges.add(c); return c; }

/** What the authenticator signs: authenticator data (RP ID, counter) joined to clientDataJSON (challenge, origin). */
export function assert(auth, ch, origin, key = auth.key) {
  if (!auth.synced) auth.counter++;
  const clientData = JSON.stringify({ type: "webauthn.get", challenge: ch, origin });
  const authData = `${auth.rpId}|${auth.counter}`;
  return { id: auth.id, clientData, authData, sig: sign(authData + "." + clientData, key) };
}

/** §7.2: challenge, origin, RP ID, signature, then the counter. A challenge is spent as soon as it is looked up. */
export function check(server, a, { origin = REAL, rpId = RP } = {}) {
  const cred = server.creds.get(a.id); if (!cred) return { ok: false, error: "unknown credential" };
  const cd = JSON.parse(a.clientData), count = Number(a.authData.split("|")[1]);
  if (!server.challenges.delete(cd.challenge)) return { ok: false, error: "unknown or used challenge" };
  if (cd.origin !== origin) return { ok: false, error: `origin ${cd.origin} is not ${origin}` };
  if (a.authData.split("|")[0] !== rpId) return { ok: false, error: "wrong RP ID" };
  if (!verify(a.authData + "." + a.clientData, a.sig, cred.pub)) return { ok: false, error: "bad signature" };
  const clone = counterFlag(cred.counter, count);
  if (count > cred.counter) cred.counter = count; // a flagged clone must not lower the stored value
  return { ok: true, clone };
}

/** §6.1.1: a counter that fails to rise, when either value is non-zero, hints at a cloned authenticator. */
export const counterFlag = (stored, now) => (now !== 0 || stored !== 0) && now <= stored;

/** The same relay against a 6-digit code: the user types it into the fake site, the attacker forwards it `delay` seconds later. */
export function relayTotp(secret, t, delay) {
  return verifyTotp(secret, totp(secret, t), t + delay) !== null;
}
export { textBytes };
