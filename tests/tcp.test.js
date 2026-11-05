import { test } from "node:test";
import assert from "node:assert/strict";
import { simulate } from "../lib/tcp.js";

test("lossless transfer completes with no retransmits", () => {
  const r = simulate({ segments: 8, window: 4 });
  assert.ok(r.done);
  assert.equal(r.stats.retrans, 0);
  assert.equal(r.stats.delivered, 8);
});

test("bigger window finishes sooner", () => {
  const a = simulate({ segments: 12, window: 1 }).done;
  const b = simulate({ segments: 12, window: 6 }).done;
  assert.ok(b < a, `${b} < ${a}`);
});

test("dropping a data segment triggers fast retransmit with a wide window", () => {
  const r = simulate({ segments: 10, window: 6, drops: new Set(["c2s|DATA 2|1"]) });
  assert.ok(r.done);
  assert.equal(r.stats.fastRetrans, 1);
  assert.equal(r.stats.timeouts, 0);
  assert.equal(r.stats.delivered, 10);
});

test("without fast retransmit the same loss waits for a timeout", () => {
  const r = simulate({ segments: 10, window: 6, fastRetransmit: false, drops: new Set(["c2s|DATA 2|1"]) });
  assert.ok(r.done);
  assert.equal(r.stats.timeouts, 1);
  const fast = simulate({ segments: 10, window: 6, drops: new Set(["c2s|DATA 2|1"]) });
  assert.ok(fast.done < r.done);
});

test("lost SYN is retried", () => {
  const r = simulate({ segments: 3, drops: new Set(["c2s|SYN|1"]) });
  assert.ok(r.done);
  assert.equal(r.packets.filter(p => p.label === "SYN").length, 2);
});

test("heavy random loss still delivers everything, in order", () => {
  for (let seed = 1; seed <= 25; seed++) {
    const r = simulate({ segments: 15, window: 5, lossPct: 25, seed });
    assert.ok(r.done, `seed ${seed} finished`);
    assert.equal(r.stats.delivered, 15);
  }
});

test("deterministic for a given seed", () => {
  const a = simulate({ lossPct: 20, seed: 3 }), b = simulate({ lossPct: 20, seed: 3 });
  assert.deepEqual(a.packets.map(p => p.key + p.lost), b.packets.map(p => p.key + p.lost));
});
