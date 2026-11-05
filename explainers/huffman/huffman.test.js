import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSteps, codesFrom, encode, decode, entropyBits } from "./huffman.js";

const samples = ["abracadabra", "aaaaaaaab", "the quick brown fox jumps over the lazy dog", "ab", "héllo wörld 🎉🎉"];

for (const s of samples) {
  test(`round-trips: ${s}`, () => {
    const steps = buildSteps(s);
    const root = steps.at(-1).forest[0];
    const codes = codesFrom(root);
    assert.equal(decode(encode(s, codes), root), s);
  });
  test(`prefix-free and within 1 bit of entropy: ${s}`, () => {
    const codes = [...codesFrom(buildSteps(s).at(-1).forest[0]).values()];
    for (const a of codes) for (const b of codes) if (a !== b) assert.ok(!b.startsWith(a), `${a} prefixes ${b}`);
    const root = buildSteps(s).at(-1).forest[0];
    const avg = encode(s, codesFrom(root)).length / [...s].length;
    const H = entropyBits(s);
    assert.ok(avg >= H - 1e-9 && avg < H + 1, `avg ${avg} vs H ${H}`);
  });
}

test("steps shrink forest by one each time", () => {
  const steps = buildSteps("abracadabra");
  assert.equal(steps[0].forest.length, 5);
  steps.forEach((st, i) => assert.equal(st.forest.length, 5 - i));
});

test("single symbol and empty input", () => {
  const one = buildSteps("zzzz");
  assert.equal(one.length, 1);
  const root = one[0].forest[0];
  assert.equal(codesFrom(root).get("z"), "0");
  assert.equal(decode(encode("zzzz", codesFrom(root)), root), "zzzz");
  assert.deepEqual(buildSteps("")[0].forest, []);
});
