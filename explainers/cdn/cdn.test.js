import { test } from "node:test";
import assert from "node:assert/strict";
import { km, rtt, nearest, simulate, POP_SETS } from "./cdn.js";
import { mulberry } from "../../shared/random.js";

const run = o => simulate({ rnd: mulberry(7), ...o });

test("distances and round trips are realistic", () => {
  assert.ok(Math.abs(km("london", "newyork") - 5570) < 60);
  const t = rtt("sydney", "virginia"); assert.ok(t > 200 && t < 260, `${t}`); // Sydney ↔ US east is ~200+ ms in practice
  assert.equal(nearest("tokyo", POP_SETS.eight), "singapore"); assert.equal(nearest("london", POP_SETS.three), "frankfurt");
});

test("a CDN cuts typical latency by several times", () => {
  const none = run({ pops: POP_SETS.none }), eight = run({ pops: POP_SETS.eight });
  assert.ok(eight.median * 3 < none.median, `${eight.median} vs ${none.median}`);
  assert.ok(eight.originRequests < none.originRequests / 4); // most requests never reach the origin
});

test("longer TTLs and more skewed popularity raise the hit rate", () => {
  const p = POP_SETS.three;
  assert.ok(run({ pops: p, ttl: 300 }).hitRate > run({ pops: p, ttl: 5 }).hitRate);
  assert.ok(run({ pops: p, skew: 1.3 }).hitRate > run({ pops: p, skew: 0.6 }).hitRate);
});

test("more edges are closer, but each warms up separately", () => {
  const three = run({ pops: POP_SETS.three }), eight = run({ pops: POP_SETS.eight });
  assert.ok(eight.median < three.median); assert.ok(eight.hitRate < three.hitRate);
});

test("after a purge, coalescing turns a stampede into a trickle", () => {
  const go = (coalesce, n) => run({ pops: POP_SETS.eight, purgeAt: 60, coalesce, skew: 1.2, n }).originPerSec[60];
  assert.ok(go(false, 150000) > go(true, 150000) * 1.5, `${go(false, 150000)} vs ${go(true, 150000)}`); // 1,250 requests/s
  assert.ok(go(false, 150000) / go(true, 150000) > go(false, 60000) / go(true, 60000), "the busier the site, the bigger the stampede");
});
