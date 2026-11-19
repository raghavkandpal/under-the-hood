import { test } from "node:test";
import assert from "node:assert/strict";
import { run, produce, LOG, N, TRUE_SUM, extraAtLeastOnce, lostAtMostOnce, payload } from "./exactly-once.js";

const ps = Array.from({ length: N }, (_, i) => i + 1);

test("the log: 100 messages, exactly one pair of identical payloads", () => {
  assert.equal(LOG.length, 100);
  const seen = new Map();
  for (const m of LOG) seen.set(payload(m), (seen.get(payload(m)) || 0) + 1);
  assert.deepEqual([...seen.values()].filter(c => c > 1), [2]);
  assert.equal(TRUE_SUM, 16709);
  assert.deepEqual(run("process-first"), { count: 100, sum: TRUE_SUM, emails: 100, committedAtCrash: null });
});

test("at-least-once: a crash after p counts 100 + (p - 10*floor((p-1)/10)) messages, 1 to 10 extra", () => {
  for (const p of ps) {
    const r = run("process-first", p), extra = p - 10 * Math.floor((p - 1) / 10);
    assert.equal(r.count, 100 + extra);
    assert.equal(extraAtLeastOnce(p), extra);
    assert.ok(extra >= 1 && extra <= 10);
  }
  assert.deepEqual([1, 10, 11, 100].map(p => run("process-first", p).count), [101, 110, 101, 110]);
});

test("at-most-once: a crash after p loses 10*ceil(p/10) - p messages, 0 to 9", () => {
  for (const p of ps) {
    assert.equal(run("commit-first", p).count, 100 - (10 * Math.ceil(p / 10) - p));
    assert.equal(lostAtMostOnce(p), 10 * Math.ceil(p / 10) - p);
  }
  assert.deepEqual([1, 10, 11, 100].map(p => run("commit-first", p).count), [91, 100, 91, 100]);
});

test("one transaction for output and offset: exactly 100 messages and the true sum at every crash point", () => {
  for (const p of ps) {
    const r = run("transaction", p);
    assert.equal(r.count, 100);
    assert.equal(r.sum, TRUE_SUM);
  }
});

test("dedupe by (partition, offset) counts 100; dedupe by content drops the genuine second payment too", () => {
  for (const p of ps) {
    const o = run("process-first", p, "offset"), c = run("process-first", p, "content");
    assert.equal(o.count, 100);
    assert.equal(o.sum, TRUE_SUM);
    assert.equal(c.count, 99);
    assert.equal(c.sum, TRUE_SUM - LOG[70].amount);
  }
  assert.equal(LOG[70].amount, LOG[23].amount);
});

test("producer: lost acks make duplicates; a producer ID with sequence numbers drops the resends", () => {
  const plain = produce({ idempotent: false }), safe = produce({ idempotent: true });
  assert.deepEqual(plain, { length: 123, resends: 23 }); // printed: seed 7, ack lost 20% of the time
  assert.deepEqual(safe, { length: 100, resends: 23 });
  for (const seed of [1, 2, 3, 4, 5]) {
    assert.equal(produce({ idempotent: true, seed }).length, 100);
    assert.ok(produce({ idempotent: false, seed }).length > 100);
  }
  assert.equal(produce({ idempotent: false, lossRate: 0 }).length, 100);
});

test("an email sent while processing goes out 100 + extra times, even in transactional mode", () => {
  for (const p of ps) {
    assert.equal(run("transaction", p).emails, 100 + extraAtLeastOnce(p));
    assert.equal(run("process-first", p, "offset").emails, 100 + extraAtLeastOnce(p));
  }
  assert.equal(run("transaction", 25).emails, 105);
});

test("the Try-it crash after message 25", () => {
  assert.equal(run("process-first", 25).count, 105);
  assert.equal(run("commit-first", 25).count, 95);
  assert.equal(run("process-first", 25).committedAtCrash, 20);
  assert.equal(run("commit-first", 25).committedAtCrash, 30);
  assert.equal(run("transaction", 25).count, 100);
});
