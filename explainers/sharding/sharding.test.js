import { test } from "node:test";
import assert from "node:assert/strict";
import { workload, load, moved } from "./sharding.js";
import { mulberry } from "../../shared/random.js";

const maxKey = 100000, n = 4, rnd = mulberry(1);

test("range sharding sends every new signup to the last shard; hashing spreads them", () => {
  const ins = workload("inserts", { maxKey, rnd });
  assert.equal(load(ins, { scheme: "range", n, maxKey }).hottest, 1);
  assert.ok(load(ins, { scheme: "hash", n, maxKey }).hottest < 0.3);
});

test("a range scan touches one range shard but every hash shard", () => {
  const scan = workload("scan", { maxKey, rnd: mulberry(2) });
  assert.ok(load(scan, { scheme: "range", n, maxKey }).touched <= 2); assert.equal(load(scan, { scheme: "hash", n, maxKey }).touched, n);
});

test("adding a fifth shard: hash mod n moves about 80% of keys; splitting a range moves an eighth", () => {
  const m = moved({ scheme: "hash", n, maxKey }); assert.ok(Math.abs(m - 0.8) < 0.02, `${m}`);
  assert.equal(moved({ scheme: "range", n, maxKey }), 1 / 8);
});

test("random reads are balanced either way", () => {
  const reads = workload("reads", { maxKey, rnd: mulberry(3) });
  for (const scheme of ["range", "hash"]) assert.ok(load(reads, { scheme, n, maxKey }).hottest < 0.28, scheme);
});
