import { test } from "node:test";
import assert from "node:assert/strict";
import { newServer, register, challenge, assert as sign, check, rpIdAllowed, counterFlag, relayTotp, textBytes, REAL, FAKE } from "./passkeys.js";
import { keygen } from "../../shared/rsa.js";
import { mulberry } from "../../shared/random.js";

const setup = (seed = 1) => { const s = newServer(), a = register(s, "example.com", mulberry(seed)); return { s, a }; };

test("a breach of the server's table yields only public keys; another key pair's assertion fails", () => {
  const { s, a } = setup();
  for (const c of s.creds.values()) assert.deepEqual(Object.keys(c.pub).sort(), ["e", "n"]);
  assert.ok(![...s.creds.values()].some(c => "d" in c || "p" in c || "key" in c));
  assert.equal(check(s, sign(a, challenge(s), REAL)).ok, true);
  for (let seed = 2; seed < 12; seed++) {
    const thief = keygen(64, mulberry(seed * 100));
    assert.equal(check(s, sign(a, challenge(s), REAL, thief)).error, "bad signature");
  }
});

test("phishing relay: a TOTP code is accepted within 30 s, the passkey assertion is bound to the fake origin", () => {
  const secret = textBytes("12345678901234567890");
  assert.equal(relayTotp(secret, 1000, 10), true);
  assert.equal(relayTotp(secret, 1000, 29), true);
  assert.equal(relayTotp(secret, 1000, 200), false); // too slow
  // a code stays valid 30 to 60 s: shown at a step start (990) it lasts 59 s, at a step end (1019) 30 s
  assert.equal(relayTotp(secret, 990, 59), true);
  assert.equal(relayTotp(secret, 990, 60), false);
  assert.equal(relayTotp(secret, 1019, 30), true);
  assert.equal(relayTotp(secret, 1019, 31), false);
  const { s, a } = setup();
  const r = check(s, sign(a, challenge(s), FAKE));
  assert.equal(r.ok, false);
  assert.match(r.error, /origin https:\/\/examp1e\.test/);
});

test("RP ID scoping: a dot-boundary suffix match", () => {
  const ok = h => rpIdAllowed("example.com", `https://${h}`);
  assert.equal(ok("example.com"), true);
  assert.equal(ok("login.example.com"), true);
  assert.equal(ok("example.com.evil.test"), false);
  assert.equal(ok("examp1e.test"), false);
  assert.equal(ok("badexample.com"), false);
});

test("challenges are single use: a replayed assertion fails", () => {
  const { s, a } = setup();
  const got = sign(a, challenge(s), REAL);
  assert.equal(check(s, got).ok, true);
  assert.equal(check(s, got).error, "unknown or used challenge");
  assert.equal(check(s, sign(a, "never-issued", REAL)).ok, false);
});

test("signature counter: flagged when it fails to rise unless both are 0", () => {
  assert.equal(counterFlag(5, 6), false);
  assert.equal(counterFlag(5, 5), true);
  assert.equal(counterFlag(5, 3), true);
  assert.equal(counterFlag(5, 0), true);
  assert.equal(counterFlag(0, 0), false);
  assert.equal(counterFlag(0, 1), false);
  const { s, a } = setup();
  assert.equal(check(s, sign(a, challenge(s), REAL)).clone, false);
  const copy = { ...a }; // a cloned authenticator counts on from the same point
  sign(a, "x", REAL); sign(a, "x", REAL); check(s, sign(a, challenge(s), REAL));
  assert.equal(check(s, sign(copy, challenge(s), REAL)).clone, true);
  const synced = { ...register(s, "example.com", mulberry(9)), synced: true };
  assert.equal(check(s, sign(synced, challenge(s), REAL)).clone, false);
  assert.equal(check(s, sign(synced, challenge(s), REAL)).clone, false);
});

test("a flagged clone does not lower the stored counter, so the real phone is not flagged later", () => {
  const { s, a } = setup();
  const copy = { ...a };
  for (let i = 0; i < 3; i++) check(s, sign(a, challenge(s), REAL));
  assert.equal(check(s, sign(copy, challenge(s), REAL)).clone, true);
  assert.equal(s.creds.get(a.id).counter, 3);
  assert.equal(check(s, sign(a, challenge(s), REAL)).clone, false);
});
