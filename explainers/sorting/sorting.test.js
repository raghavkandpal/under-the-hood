import { test } from "node:test";
import assert from "node:assert/strict";
import { ALGOS, INPUTS, count } from "./sorting.js";
import { mulberry } from "../../shared/random.js";

test("every algorithm sorts every input type and size", () => {
  for (const n of [0, 1, 2, 3, 10, 57, 200]) for (const [ik, inp] of Object.entries(INPUTS)) {
    const data = inp.gen(n, mulberry(n + ik.length)), want = data.slice().sort((x, y) => x - y);
    for (const a of Object.keys(ALGOS)) assert.deepEqual(count(a, data).sorted, want, `${a} on ${ik} n=${n}`);
  }
});

test("operation counts reflect known complexities", () => {
  const n = 200, sorted = Array.from({ length: n }, (_, i) => i), rnd = INPUTS.random.gen(n, mulberry(1));
  assert.equal(count("insertion", sorted).cmps, n - 1);
  assert.equal(count("bubble", sorted).cmps, n - 1);
  assert.equal(count("selection", sorted).cmps, n * (n - 1) / 2);
  const nlogn = n * Math.log2(n);
  for (const a of ["merge", "quick", "heap"]) assert.ok(count(a, rnd).cmps < 2.5 * nlogn, a);
  assert.ok(count("bubble", rnd).cmps > 4 * nlogn);
});
