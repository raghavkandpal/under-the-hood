import { test } from "node:test";
import assert from "node:assert/strict";
import { NGram, decode, pick, generate } from "./sampling.js";
import { mulberry } from "../../shared/random.js";

const corpus = "The cat sat on the mat. The cat ate the fish. The dog sat on the rug. A dog ate a bone.";
const m = new NGram(corpus);

test("distributions sum to 1 and follow the data", () => {
  const d = m.dist(["the", "cat"]);
  assert.ok(Math.abs(d.reduce((s, r) => s + r.p, 0) - 1) < 1e-9);
  assert.ok(["sat", "ate"].includes(d[0].tok));
});

test("temperature 0 is greedy; high temperature flattens", () => {
  const d = m.dist(["the"]);
  const g = decode(d, { temp: 0 });
  assert.equal(g.filter(r => r.kept).length, 1);
  const hot = decode(d, { temp: 50 }), mx = Math.max(...hot.map(r => r.q)), mn = Math.min(...hot.map(r => r.q));
  assert.ok(mx / mn < 1.5);
});

test("top-k and top-p cut the tail and renormalise", () => {
  const d = m.dist(["the"]);
  const k = decode(d, { topK: 2 });
  assert.equal(k.filter(r => r.kept).length, 2);
  assert.ok(Math.abs(k.reduce((s, r) => s + r.q, 0) - 1) < 1e-9);
  const p = decode(d, { topP: 0.5 }), kept = p.filter(r => r.kept);
  const mass = kept.reduce((s, r) => s + r.t, 0);
  assert.ok(mass >= 0.5 - 1e-9);
  assert.ok(mass - kept.at(-1).t < 0.5, "smallest set that reaches p");
});

test("generation is deterministic per seed and ends at punctuation", () => {
  const a = generate(m, "the", { temp: 1 }, mulberry(4)), b = generate(m, "the", { temp: 1 }, mulberry(4));
  assert.deepEqual(a, b);
  const g = generate(m, "the", { temp: 0 }, mulberry(1));
  assert.ok([".", "!", "?"].includes(g.at(-1)) || g.length === 30);
});

test("pick respects kept set", () => {
  const rows = decode(m.dist(["the"]), { topK: 1 });
  for (let i = 0; i < 20; i++) assert.equal(pick(rows, mulberry(i)), rows[0].tok);
});
