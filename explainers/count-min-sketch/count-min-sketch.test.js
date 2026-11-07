import { test } from "node:test";
import assert from "node:assert/strict";
import { sketch, add, query, epsilon, delta, zipfStream } from "./count-min-sketch.js";
import { mulberry } from "../../shared/random.js";

const stream = zipfStream({ items: 5000, length: 50000, rnd: mulberry(1) });
const truth = new Map(); for (const x of stream) truth.set(x, (truth.get(x) ?? 0) + 1);
const filled = (w, d) => { const s = sketch(w, d); stream.forEach(x => add(s, x)); return s; };

test("never undercounts", () => {
  const s = filled(200, 4); for (const [x, c] of truth) assert.ok(query(s, x) >= c, x);
});

test("the error bound holds for at least 1 − δ of items", () => {
  const w = 272, d = 5, s = filled(w, d), bound = epsilon(w) * stream.length;
  const within = [...truth].filter(([x, c]) => query(s, x) - c <= bound).length / truth.size;
  assert.ok(within >= 1 - delta(d), `${within}`); assert.ok(Math.abs(epsilon(272) - 0.01) < 0.0001);
});

test("more rows shrink the worst error, and popular items are nearly exact", () => {
  const worst = s => Math.max(...[...truth].map(([x, c]) => query(s, x) - c));
  assert.ok(worst(filled(200, 1)) > worst(filled(200, 5)));
  const s = filled(1000, 4), top = truth.get("item-1"); assert.ok((query(s, "item-1") - top) / top < 0.02, "the head of the distribution stands out from the noise");
});
