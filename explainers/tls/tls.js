// A toy TLS-1.3-shaped handshake built from the site's own pieces: Diffie-Hellman (lib/dh), RSA signatures (lib/rsa)
// and SHA-1 (lib/git). It shows the *structure* of TLS, not its real cryptography. No DOM.
import { modPow, safePrime, randomBigBelow } from "../../shared/dh.js";
import { keygen, sign, verify } from "../../shared/rsa.js";
import { sha1 } from "../../shared/git.js";

const enc = new TextEncoder();
export const H = s => sha1(enc.encode(s));
export const certBody = c => `subject=${c.subject};key=${c.n}:${c.e};issuer=${c.issuer};expires=${c.expires}`;

/** Shared world: one trusted CA, a DH group, the real server and an attacker. */
export function world(rnd = Math.random) {
  const group = safePrime(32, rnd);
  const ca = { name: "Toy Root CA", ...keygen(40, rnd) };
  const serverKey = keygen(40, rnd), malloryKey = keygen(40, rnd);
  const issue = (subject, key, signer, signerName, expires = 2030) => {
    const c = { subject, n: key.n, e: key.e, issuer: signerName, expires };
    return { ...c, sig: sign(certBody(c), signer) };
  };
  return {
    group, ca, serverKey, malloryKey,
    serverCert: issue("bank.example", serverKey, ca, ca.name),
    selfSigned: issue("bank.example", malloryKey, malloryKey, "Mallory"),
    wrongName: issue("mallory.example", malloryKey, ca, ca.name),
    expired: issue("bank.example", serverKey, ca, ca.name, 2019),
  };
}

/** Client-side certificate checks, in the order a browser does them. */
export function checkCert(cert, hostname, trustedCA, year = 2026) {
  if (cert.issuer !== trustedCA.name) return { ok: false, why: `issued by “${cert.issuer}”, which isn't in the trusted root store` };
  if (!verify(certBody(cert), cert.sig, trustedCA)) return { ok: false, why: "the CA's signature on the certificate doesn't verify (it was altered or forged)" };
  if (cert.subject !== hostname) return { ok: false, why: `it's for “${cert.subject}”, not “${hostname}”` };
  if (cert.expires < year) return { ok: false, why: `it expired in ${cert.expires}` };
  return { ok: true, why: "signed by a trusted CA, right name, not expired" };
}

/**
 * Run the handshake. scenario: "normal" | "mitm-selfsigned" | "mitm-wrongname" | "expired" | "mitm-stolen-cert"
 * Returns the message flow plus both sides' derived keys.
 */
export function handshake(W, scenario = "normal", rnd = Math.random) {
  const { p, g } = W.group, host = "bank.example", msgs = [];
  const say = (from, to, label, detail, kind = "msg") => msgs.push({ from, to, label, detail, kind });
  const clientRandom = H("cr" + rnd()).slice(0, 16), a = randomBigBelow(p - 3n, rnd) + 2n, A = modPow(g, a, p);
  say("client", "server", "ClientHello", `random=${clientRandom}, key share A = g^a mod p = ${A}, “I want bank.example”`);
  const mitm = scenario.startsWith("mitm");
  const responder = mitm ? "mallory" : "server";
  const key = mitm ? W.malloryKey : W.serverKey;
  const cert = scenario === "mitm-selfsigned" ? W.selfSigned : scenario === "mitm-wrongname" ? W.wrongName : scenario === "expired" ? W.expired : W.serverCert;
  if (mitm) say("client", "mallory", "(intercepted)", "Mallory sits on the network path and answers instead of the bank.", "warn");
  const serverRandom = H("sr" + rnd()).slice(0, 16), b = randomBigBelow(p - 3n, rnd) + 2n, B = modPow(g, b, p);
  say(responder, "client", "ServerHello", `random=${serverRandom}, key share B = g^b mod p = ${B}`);
  say(responder, "client", "Certificate", `subject=${cert.subject}, issuer=${cert.issuer}, expires ${cert.expires}`);
  // CertificateVerify: sign the transcript so far with the certificate's private key
  const transcript = H(clientRandom + A + serverRandom + B + certBody(cert));
  const keyForSig = scenario === "mitm-stolen-cert" ? W.malloryKey : key;  // Mallory has the bank's cert but not its key
  const cv = sign(transcript, keyForSig);
  say(responder, "client", "CertificateVerify", `signature over the handshake so far, made with the private key for that certificate: ${cv}`);
  const shared = modPow(B, a, p), serverShared = modPow(A, b, p);
  const clientKey = H("key" + shared + clientRandom + serverRandom).slice(0, 16), serverKeyDerived = H("key" + serverShared + clientRandom + serverRandom).slice(0, 16);
  const certCheck = checkCert(cert, host, W.ca);
  const sigOk = verify(transcript, cv, { n: cert.n, e: cert.e });
  say(responder, "client", "Finished", `MAC over the transcript using the new key`);
  let outcome;
  if (!certCheck.ok) outcome = { ok: false, why: `Certificate rejected: ${certCheck.why}.` };
  else if (!sigOk) outcome = { ok: false, why: "CertificateVerify failed: whoever answered doesn't hold the private key for this certificate." };
  else outcome = { ok: true, why: `Certificate checks out (${certCheck.why}), the signature proves the responder owns it, and both sides now share a key.` };
  say("client", responder, outcome.ok ? "Finished ✓" : "Alert ✗", outcome.why, outcome.ok ? "good" : "bad");
  return { msgs, outcome, clientKey, serverKey: serverKeyDerived, responder, shared, cert, certCheck, sigOk };
}

/** Toy authenticated-looking encryption: XOR with a SHA-1 keystream. Illustration only. */
export function encrypt(key, text) {
  const bytes = enc.encode(text), out = [];
  for (let i = 0; i < bytes.length; i++) { const block = H(key + Math.floor(i / 20)); out.push(bytes[i] ^ parseInt(block.slice((i % 20) * 2, (i % 20) * 2 + 2), 16)); }
  return out.map(b => b.toString(16).padStart(2, "0")).join("");
}
export function decrypt(key, hexStr) {
  const bytes = hexStr.match(/../g)?.map(h => parseInt(h, 16)) ?? [], out = [];
  for (let i = 0; i < bytes.length; i++) { const block = H(key + Math.floor(i / 20)); out.push(bytes[i] ^ parseInt(block.slice((i % 20) * 2, (i % 20) * 2 + 2), 16)); }
  return new TextDecoder().decode(new Uint8Array(out));
}
