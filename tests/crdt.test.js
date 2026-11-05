import { test } from "node:test";
import assert from "node:assert/strict";
import { PNCounter as C, ORSet as S, Naive, equalState } from "../lib/crdt.js";
import { mulberry } from "../lib/autograd.js";

function randomStates(T, ops, n, seed) {
  const r = mulberry(seed); let tag = 0;
  return Array.from({ length: n }, (_, id) => { let s = T.empty(); for (let i = 0; i < 6; i++) s = ops(s, `r${id}`, r, () => `t${seed}-${id}-${tag++}`); return s; });
}
const counterOps = (s, id, r) => (r() < 0.6 ? C.inc(s, id, 1 + Math.floor(r() * 3)) : C.dec(s, id));
const setOps = (s, id, r, tag) => { const it = "abcd"[Math.floor(r() * 4)]; return r() < 0.6 ? S.add(s, it, tag()) : S.remove(s, it); };

for (const [name, T, ops] of [["PN-counter", C, counterOps], ["OR-set", S, setOps]]) {
  test(`${name}: merge is commutative, associative and idempotent`, () => {
    for (let seed = 1; seed <= 30; seed++) {
      const [a, b, c] = randomStates(T, ops, 3, seed);
      assert.ok(equalState(T.merge(a, b), T.merge(b, a)));
      assert.ok(equalState(T.merge(T.merge(a, b), c), T.merge(a, T.merge(b, c))));
      assert.ok(equalState(T.merge(a, a), a));
    }
  });
}

test("counter keeps every replica's increments", () => {
  let a = C.inc(C.empty(), "A", 3), b = C.inc(C.empty(), "B", 2); b = C.dec(b, "B");
  assert.equal(C.value(C.merge(a, b)), 4);
});

test("OR-set: concurrent add and remove → add wins; seen remove sticks", () => {
  let base = S.add(S.empty(), "milk", "t1");
  const a = S.remove(base, "milk");       // A removes the milk it saw
  const b = S.add(base, "milk", "t2");    // B concurrently re-adds milk
  assert.deepEqual(S.value(S.merge(a, b)), ["milk"]);
  assert.deepEqual(S.value(S.merge(a, base)), []);
});

test("naive last-writer-wins loses concurrent work", () => {
  const a = Naive.inc(Naive.empty(), 3, 1), b = Naive.inc(Naive.empty(), 2, 2);
  assert.equal(Naive.merge(a, b).count, 2); // the 3 increments from A vanished
});
