import { test } from "node:test";
import assert from "node:assert/strict";
import { Ring, modN, assignment, moved, loads } from "../lib/ring.js";

const keys = Array.from({ length: 5000 }, (_, i) => `user:${i}`);
const S = ["A", "B", "C", "D"];

test("adding a server moves ~1/(n+1) keys on the ring but most keys with mod-N", () => {
  const r = new Ring(S, 100), before = assignment(keys, k => r.lookup(k));
  r.add("E"); const after = assignment(keys, k => r.lookup(k));
  const frac = moved(before, after) / keys.length;
  assert.ok(frac > 0.12 && frac < 0.3, `ring moved ${frac}`);
  for (const [k, v] of after) if (v !== before.get(k)) assert.equal(v, "E", "keys only move to the new server");
  const m1 = assignment(keys, k => modN(k, S)), m2 = assignment(keys, k => modN(k, [...S, "E"]));
  assert.ok(moved(m1, m2) / keys.length > 0.7);
});

test("removing a server only moves that server's keys", () => {
  const r = new Ring(S, 50), before = assignment(keys, k => r.lookup(k));
  r.remove("B"); const after = assignment(keys, k => r.lookup(k));
  for (const [k, v] of before) if (v !== "B") assert.equal(after.get(k), v);
});

test("virtual nodes even out the load", () => {
  const spread = v => { const r = new Ring(S, v), l = Object.values(loads(assignment(keys, k => r.lookup(k)), S)); return Math.max(...l) / Math.min(...l); };
  assert.ok(spread(200) < spread(1), `${spread(200)} vs ${spread(1)}`);
  assert.ok(spread(200) < 1.35);
});
