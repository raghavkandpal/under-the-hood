import { test } from "node:test";
import assert from "node:assert/strict";
import { train, encode, vocab, SPACE } from "./bpe.js";

const corpus = "low lower lowest newer newest wider widest low low newer";

test("first merge is the most frequent pair", () => {
  const { merges } = train(corpus, 1);
  // "▁l", "lo" and "ow" each appear 5 times (low ×3, lower, lowest); ties break lexicographically, so "lo" wins
  assert.equal(merges[0].count, 5);
  assert.deepEqual(merges[0].pair, ["l", "o"]);
  const { tops } = train(corpus, 1);
  assert.ok(tops[0].some(([p, c]) => p.join("") === SPACE + "l" && c === 5));
});

test("encode with all merges round-trips the text", () => {
  const { merges } = train(corpus, 50);
  const toks = encode("lowest newer widest", merges);
  assert.equal(toks.join("").replaceAll(SPACE, " ").trim(), "lowest newer widest");
});

test("more merges => fewer tokens, never more", () => {
  const text = "the quick brown fox jumps over the lazy dog. the dog sleeps.";
  const { merges } = train(text.repeat(3), 60);
  let prev = Infinity;
  for (let k = 0; k <= merges.length; k += 5) { const n = encode(text, merges, k).length; assert.ok(n <= prev); prev = n; }
});

test("unseen words fall back to pieces", () => {
  const { merges, base } = train(corpus, 30);
  const toks = encode("lowly", merges);
  assert.ok(toks.length >= 2 && toks.length < 6, toks.join("|"));
  assert.ok(vocab(base, merges).length === base.length + merges.length);
});
