import { test } from "node:test";
import assert from "node:assert/strict";
import { History, relation, reachable } from "../lib/vclock.js";
import { mulberry } from "../lib/autograd.js";

function randomHistory(seed) {
  const h = new History(3), r = mulberry(seed);
  for (let i = 0; i < 25; i++) { const p = Math.floor(r() * 3); if (r() < 0.4) h.local(p); else { let q = Math.floor(r() * 3); if (q === p) q = (q + 1) % 3; h.send(p, q); } }
  return h;
}

test("vector clocks say 'before' exactly when a causal path exists", () => {
  for (let s = 1; s <= 20; s++) {
    const h = randomHistory(s);
    for (const a of h.events) for (const b of h.events) if (a.id !== b.id) {
      assert.equal(relation(a, b) === "before", reachable(h, a, b), `seed ${s}: ${a.id}→${b.id}`);
    }
  }
});

test("Lamport clocks respect causality but can't detect concurrency", () => {
  let sawFalseOrder = false;
  for (let s = 1; s <= 20; s++) {
    const h = randomHistory(s);
    for (const a of h.events) for (const b of h.events) {
      if (relation(a, b) === "before") assert.ok(a.lamport < b.lamport);
      if (relation(a, b) === "concurrent" && a.lamport < b.lamport) sawFalseOrder = true;
    }
  }
  assert.ok(sawFalseOrder);
});

test("two isolated local events are concurrent", () => {
  const h = new History(2), a = h.local(0), b = h.local(1);
  assert.equal(relation(a, b), "concurrent");
  const [s, r] = h.send(0, 1);
  assert.equal(relation(a, r), "before"); assert.equal(relation(b, s), "concurrent");
});
