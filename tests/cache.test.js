import { test } from "node:test";
import assert from "node:assert/strict";
import { Cache, simulate } from "../lib/cache.js";

test("sequential access hits (line-1)/line of the time", () => {
  const c = new Cache({ size: 256, lineSize: 16, ways: 2 });
  for (let a = 0; a < 4096; a += 4) c.access(a);
  assert.equal(c.hitRate, 0.75);
});

test("LRU evicts the least recently used way", () => {
  const c = new Cache({ size: 32, lineSize: 16, ways: 2 }); // 1 set, 2 ways
  c.access(0); c.access(16); c.access(0); // 0 most recent
  const r = c.access(32);                  // evicts line 1 (addr 16)
  assert.equal(r.evicted, 1);
  assert.ok(c.access(0).hit);
  assert.ok(!c.access(16).hit);
});

test("direct-mapped conflict: two addresses fighting for one set always miss", () => {
  const c = new Cache({ size: 64, lineSize: 16, ways: 1 }); // 4 sets
  for (let i = 0; i < 10; i++) { c.access(0); c.access(64); }
  assert.equal(c.hits, 0);
});

test("row order beats column order once rows don't fit", () => {
  const cfg = { size: 256, lineSize: 16, ways: 2 };
  const rows = simulate("rows", 16, cfg).cache.hitRate, cols = simulate("cols", 16, cfg).cache.hitRate;
  assert.ok(rows > 0.7 && cols < 0.1, `rows ${rows}, cols ${cols}`);
  const tiled = simulate("tiled", 16, cfg).cache.hitRate;
  assert.ok(tiled > cols + 0.4);
});
