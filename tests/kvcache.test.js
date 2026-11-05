import { test } from "node:test";
import assert from "node:assert/strict";
import { stepNoCache, stepCached, work, cacheBytes, SHAPES } from "../lib/kvcache.js";
import { mulberry } from "../lib/autograd.js";

test("cached decoding gives exactly the same outputs", () => {
  const rnd = mulberry(9), xs = Array.from({ length: 12 }, () => Array.from({ length: 4 }, () => rnd() * 2 - 1)), cache = { keys: [], vals: [] };
  xs.forEach((x, i) => { const a = stepNoCache(xs.slice(0, i + 1)).out, b = stepCached(cache, x).out; a.forEach((v, j) => assert.ok(Math.abs(v - b[j]) < 1e-12)); });
});

test("work: quadratic without the cache, linear with it", () => {
  assert.equal(work(0, 4, false), 1 + 2 + 3 + 4); assert.equal(work(0, 4, true), 4);
  assert.equal(work(100, 100, true), 200); assert.ok(work(100, 100, false) > 50 * work(100, 100, true));
});

test("cache memory: 8B-class GQA at 128k tokens is about 16 GB", () => {
  const gb = cacheBytes(SHAPES.small, 128 * 1024) / 2 ** 30; assert.equal(gb, 16);
  assert.equal(cacheBytes(SHAPES.smallMHA, 1000) / cacheBytes(SHAPES.small, 1000), 4);
});
