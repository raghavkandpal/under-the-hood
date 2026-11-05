import { test } from "node:test";
import assert from "node:assert/strict";
import { world, handshake, checkCert, encrypt, decrypt } from "../lib/tls.js";
import { mulberry } from "../lib/autograd.js";

const W = world(mulberry(11));

test("normal handshake succeeds and both sides derive the same key", () => {
  const r = handshake(W, "normal", mulberry(1));
  assert.ok(r.outcome.ok, r.outcome.why);
  assert.equal(r.clientKey, r.serverKey);
});

test("every attack scenario is rejected for the right reason", () => {
  const cases = { "mitm-selfsigned": /trusted root/, "mitm-wrongname": /not “bank.example”/, expired: /expired/, "mitm-stolen-cert": /private key/ };
  for (const [s, re] of Object.entries(cases)) {
    const r = handshake(W, s, mulberry(2));
    assert.ok(!r.outcome.ok, s);
    assert.match(r.outcome.why, re, s);
  }
});

test("tampering with a certificate breaks the CA signature", () => {
  const forged = { ...W.serverCert, subject: "evil.example" };
  assert.match(checkCert(forged, "evil.example", W.ca).why, /doesn't verify/);
});

test("toy cipher round-trips and depends on the key", () => {
  const c = encrypt("k1", "transfer £50 to Alice");
  assert.equal(decrypt("k1", c), "transfer £50 to Alice");
  assert.notEqual(decrypt("k2", c), "transfer £50 to Alice");
});
