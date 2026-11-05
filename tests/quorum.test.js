import { test } from "node:test";
import assert from "node:assert/strict";
import { Cluster, staleness } from "../lib/quorum.js";

test("R + W > N never returns stale data", () => {
  for (const [N, R, W] of [[3, 2, 2], [3, 1, 3], [3, 3, 1], [5, 3, 3], [5, 2, 4]]) assert.equal(staleness(N, R, W).stale, 0, `${N}/${R}/${W}`);
});

test("R + W ≤ N sometimes does, at the predicted rate", () => {
  // N=3, R=1, W=1: the one replica read was the one written with probability 1/3
  const s = staleness(3, 1, 1, 6000).stale;
  assert.ok(Math.abs(s - 2 / 3) < 0.03, String(s));
  assert.ok(staleness(5, 2, 2).stale > 0);
});

test("bigger quorums are slower", () => {
  const a = staleness(5, 1, 1), b = staleness(5, 5, 5);
  assert.ok(b.readMs > a.readMs * 2 && b.writeMs > a.writeMs * 2);
});

test("failures: an op needing more replicas than are up fails", () => {
  const c = new Cluster(3); c.nodes[0].up = false; c.nodes[1].up = false;
  assert.equal(c.write("x", 2).ok, false); assert.equal(c.read(1).ok, true);
});
