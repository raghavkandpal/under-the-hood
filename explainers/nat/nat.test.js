import { test } from "node:test";
import assert from "node:assert/strict";
import { makeNat, holePunch } from "./nat.js";

const SERVER = "93.184.216.34:443";

test("outgoing packets get the router's address; the reply is rewritten back", () => {
  const nat = makeNat("203.0.113.7"), out = nat.out({ src: "192.168.1.10:51000", dst: SERVER });
  assert.deepEqual(out, { src: "203.0.113.7:40000", dst: SERVER });
  assert.deepEqual(nat.in({ src: SERVER, dst: out.src }), { src: SERVER, dst: "192.168.1.10:51000" });
});

test("two laptops share one public address on different ports", () => {
  const nat = makeNat("203.0.113.7"), a = nat.out({ src: "192.168.1.10:51000", dst: SERVER }), b = nat.out({ src: "192.168.1.11:51000", dst: SERVER });
  assert.notEqual(a.src, b.src); assert.equal(a.src.split(":")[0], b.src.split(":")[0]);
  assert.equal(nat.in({ src: SERVER, dst: b.src }).dst, "192.168.1.11:51000");
});

test("unsolicited packets are dropped, and so are packets from someone you didn't contact", () => {
  const nat = makeNat("203.0.113.7");
  assert.equal(nat.in({ src: "198.51.100.9:1234", dst: "203.0.113.7:40000" }).drop, "no mapping");
  const out = nat.out({ src: "192.168.1.10:51000", dst: SERVER });
  assert.equal(nat.in({ src: "198.51.100.9:1234", dst: out.src }).drop, "not expected from this sender");
});

test("easy NAT reuses the port for every destination; symmetric NAT picks a new one", () => {
  const easy = makeNat("203.0.113.7", "independent"), sym = makeNat("203.0.113.7", "dependent"), h = "192.168.1.10:5000";
  assert.equal(easy.out({ src: h, dst: SERVER }).src, easy.out({ src: h, dst: "198.51.100.9:1" }).src);
  assert.notEqual(sym.out({ src: h, dst: SERVER }).src, sym.out({ src: h, dst: "198.51.100.9:1" }).src);
});

test("hole punching works only when neither side is symmetric", () => {
  assert.equal(holePunch("independent", "independent").direct, true);
  assert.equal(holePunch("independent", "dependent").direct, false);
  assert.equal(holePunch("dependent", "independent").direct, false);
  assert.equal(holePunch("dependent", "dependent").direct, false);
  assert.equal(holePunch("independent", "independent").steps.length, 3);
});
