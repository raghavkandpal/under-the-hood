import { test } from "node:test";
import assert from "node:assert/strict";
import { START, total, transferOps, timeline, restart, crashSweep } from "./transactions.js";

const ab = d => [d.Alice, d.Bob];
const final = s => s[s.length - 1].disk;

test("fact 1: autocommit, crash between the two statements leaves Alice 70, Bob 50, total 120", () => {
  const s = timeline("auto", transferOps(30));
  assert.deepEqual(ab(restart(s[1])), [70, 50]);
  assert.equal(total(restart(s[1])), 120);
});

test("fact 1: autocommit sweep: only the gap between the statements is wrong", () => {
  const sweep = crashSweep("auto", transferOps(30));
  assert.deepEqual(sweep.map(ab), [[100, 50], [70, 50], [70, 80]]);
  assert.deepEqual(sweep.map(total), [150, 120, 150]);
});

test("fact 1: transaction sweep: every crash point totals 150 and holds (100,50) or (70,80)", () => {
  const s = timeline("txn", transferOps(30)), sweep = s.map(restart);
  assert.deepEqual(s.map(x => x.step), ["start", "BEGIN", "UPDATE Alice - 30", "UPDATE Bob + 30", "COMMIT"]);
  for (const d of sweep) {
    assert.equal(total(d), 150);
    assert.ok([[100, 50], [70, 80]].some(ok => ab(d).join() === ok.join()), ab(d).join());
  }
  assert.deepEqual(sweep.map(ab), [[100, 50], [100, 50], [100, 50], [100, 50], [70, 80]]);
});

test("fact 1: the journal is hot until COMMIT; the file already holds the new values before it", () => {
  const s = timeline("txn", transferOps(30));
  assert.deepEqual(ab(s[3].disk), [70, 80]);
  assert.deepEqual(s[3].journal, { Bob: 50, Alice: 100 });
  assert.equal(s[4].journal, null);
});

test("fact 2: ROLLBACK after both updates restores the rows exactly", () => {
  const s = timeline("txn", transferOps(30), { rollback: true });
  assert.deepEqual(s.map(x => x.step).slice(-2), ["UPDATE Bob + 30", "ROLLBACK"]);
  assert.deepEqual(ab(s[3].disk), [70, 80]);
  assert.deepEqual(final(s), START);
  assert.equal(s[s.length - 1].journal, null);
});

test("fact 3: transfer 120 crediting Bob first, in a transaction: credit undone, (100,50)", () => {
  const s = timeline("txn", transferOps(120, true));
  assert.match(s.find(x => x.error).error, /Alice would be -20/);
  assert.deepEqual(ab(s[2].disk), [100, 170]);
  assert.equal(s[s.length - 1].step, "ROLLBACK");
  assert.deepEqual(final(s), START);
});

test("fact 3: the same transfer in autocommit keeps the credit: (100,170), total 270", () => {
  const s = timeline("auto", transferOps(120, true));
  assert.equal(s.length, 3);
  assert.ok(s[2].error);
  assert.deepEqual(ab(final(s)), [100, 170]);
  assert.equal(total(final(s)), 270);
});

test("fact 4: another session reads (100,50) at every step before COMMIT and (70,80) after, never (70,50)", () => {
  const s = timeline("txn", transferOps(30));
  assert.deepEqual(s.map(x => ab(x.view)), [[100, 50], [100, 50], [100, 50], [100, 50], [70, 80]]);
  assert.ok(!s.some(x => ab(x.view).join() === "70,50"));
});

test("fact 4: in autocommit the other session does see (70,50)", () => {
  assert.deepEqual(timeline("auto", transferOps(30)).map(x => ab(x.view)), [[100, 50], [70, 50], [70, 80]]);
});

test("a failed debit first changes nothing in either mode", () => {
  for (const m of ["auto", "txn"]) assert.deepEqual(final(timeline(m, transferOps(120))), START);
});
