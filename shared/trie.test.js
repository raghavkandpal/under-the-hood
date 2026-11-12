import { test } from "node:test";
import assert from "node:assert/strict";
import { Trie, scanComplete, radixNodes } from "./trie.js";

const W = [["car", 50], ["card", 20], ["care", 40], ["careful", 10], ["cart", 5], ["cat", 60], ["dog", 30]].map(([word, weight]) => ({ word, weight }));
const t = new Trie(); W.forEach(w => t.insert(w.word, w.weight));

test("stores words and shares prefixes", () => {
  assert.equal(t.size, 7); assert.ok(t.has("care")); assert.ok(!t.has("ca"));
  assert.equal(t.nodes, 1 + 3 + 1 + 1 + 3 + 1 + 1 + 3); // root, c-a-r, d, e, f-u-l, t(cart), t(cat), d-o-g
  assert.deepEqual(t.all("care").sort(), ["care", "careful"]);
});

test("top-k completions match a full scan", () => {
  for (const p of ["", "c", "ca", "car", "care", "d", "x"]) for (const k of [1, 3, 10])
    assert.deepEqual(t.complete(p, k).words.map(w => w.word), scanComplete(W, p, k).words.map(w => w.word), `${p} k=${k}`);
});

test("best-first search visits few nodes in a big trie", () => {
  const big = new Trie(), words = [];
  for (let i = 0; i < 5000; i++) { const word = "w" + i.toString(36), weight = 1 / (i + 1); big.insert(word, weight); words.push({ word, weight }); }
  const r = big.complete("w", 5); assert.deepEqual(r.words.map(w => w.word), scanComplete(words, "w", 5).words.map(w => w.word));
  assert.ok(r.visited < 100, `visited ${r.visited}`);
});

test("radix compression removes single-child chains", () => { assert.ok(radixNodes(t) < t.nodes); });
