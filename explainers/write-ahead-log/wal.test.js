import { test } from "node:test";
import assert from "node:assert/strict";
import { Engine, total } from "./wal.js";

const transfer = (e, tx = 1) => { e.write(tx, "A", e.read("A") - 30); e.write(tx, "B", e.read("B") + 30); };
const init = { A: 100, B: 50 };

test("committed but unflushed pages survive a crash via redo", () => {
  const e = new Engine(init); transfer(e); e.commit(1); e.crash();
  assert.deepEqual(e.disk, init); // pages never written
  e.recover(); assert.deepEqual(e.disk, { A: 70, B: 80 });
});

test("uncommitted pages written early are rolled back via undo", () => {
  const e = new Engine(init); transfer(e); e.flushPage("A"); e.crash();
  assert.equal(e.disk.A, 70); // a half-done transfer reached disk
  const r = e.recover(); assert.deepEqual(e.disk, init); assert.deepEqual(r.losers, [1]);
});

test("the WAL rule: a page can't reach disk before its log record", () => {
  const e = new Engine(init); transfer(e); e.flushPage("A");
  assert.ok(e.logDisk.some(r => r.type === "update" && r.key === "A"));
});

test("without a log, a crash mid-commit loses money", () => {
  const e = new Engine(init, { wal: false }); transfer(e); e.commit(1, { crashAfterPages: 1 }); e.recover();
  assert.notEqual(total(e.disk, ["A", "B"]), 150);
});

test("recovery is idempotent: crashing during recovery and recovering again is fine", () => {
  const e = new Engine(init); transfer(e, 1); e.commit(1); e.write(2, "A", 0); e.flushPage("A"); e.crash();
  e.recover(); const once = { ...e.disk }; e.crash(); e.recover();
  assert.deepEqual(e.disk, once); assert.deepEqual(once, { A: 70, B: 80 });
});
