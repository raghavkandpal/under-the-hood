import { test } from "node:test";
import assert from "node:assert/strict";
import { LOG, SEGMENT, BACKUP_AT, DROP_AT, START, stateAt, restore, describe, hhmm, fuzzyCopy } from "./backups.js";

const at = s => { const [h, m] = s.split(":"); return h * 60 + +m; };
const inRange = (lo, hi) => LOG.filter(e => e.t > lo && e.t <= hi);

test("the model's constants", () => {
  assert.deepEqual(START.accounts, { Alice: 100, Bob: 50 });
  assert.equal(BACKUP_AT, 0);
  assert.equal(SEGMENT, 15);
  assert.equal(DROP_AT, at("17:15"));
  assert.equal(LOG.filter(e => e.kind === "drop").length, 1);
});

test("fact 1: the 00:00 backup alone is the 00:00 state and loses every commit since", () => {
  const r = restore("backup", at("17:30"));
  assert.deepEqual(r.state, stateAt(0));
  assert.deepEqual(r.state, START);
  assert.equal(r.lost, inRange(0, at("17:30")).length);
  assert.equal(r.lost, 11);
});

test("fact 2: backup plus the whole archive is the live state at the last shipped segment", () => {
  for (const f of [at("17:30"), at("17:29"), at("09:44"), at("23:59")]) {
    const r = restore("archive", f);
    assert.equal(r.upTo, SEGMENT * Math.floor(f / SEGMENT));
    assert.deepEqual(r.state, stateAt(r.upTo));
  }
  assert.equal(restore("archive", at("17:29")).upTo, DROP_AT);
});

test("fact 3: a failure at t loses the commits in (15*floor(t/15), t], under 15 minutes of them", () => {
  for (let t = 0; t < 1440; t++) {
    const r = restore("archive", t), from = SEGMENT * Math.floor(t / SEGMENT);
    assert.equal(r.lost, inRange(from, t).length, `t=${t}`);
    assert.ok(t - r.upTo < SEGMENT);
  }
});

test("fact 4: replaying to the end leaves the table dropped; replaying to 17:14 brings it back", () => {
  const end = restore("pitr", at("17:30"), Infinity), before = restore("pitr", at("17:30"), at("17:14"));
  assert.equal(end.state.audit, null);
  assert.deepEqual(before.state, stateAt(at("17:14")));
  assert.equal(before.state.audit.length, 9);
  assert.equal(before.upTo, at("17:14"));
  assert.deepEqual(before.state.accounts, { Alice: 35, Bob: 115 });
  assert.equal(restore("pitr", at("17:30"), DROP_AT).state.audit, null);
});

test("fact 5: a row-by-row copy during a transfer of 30 can total 120 or 180; copy plus replay always 150", () => {
  const runs = fuzzyCopy(30);
  assert.equal(runs.length, 6);
  const totals = runs.map(r => r.total);
  assert.ok(totals.includes(120) && totals.includes(180));
  assert.deepEqual([...new Set(totals)].sort(), [120, 150, 180]);
  assert.ok(runs.every(r => r.replayedTotal === 150));
  assert.ok(runs.every(r => r.replayed.Alice === 70 && r.replayed.Bob === 80));
});

test("fact 6: a target before the base backup ended is refused", () => {
  const r = restore("pitr", at("17:30"), -60);
  assert.match(r.error, /before the backup/);
  assert.equal(r.state, undefined);
  assert.equal(hhmm(-60), "23:00 the day before");
  assert.ok(restore("pitr", at("17:30"), BACKUP_AT).error === undefined);
});

test("a target past the last shipped segment stops at the segment", () => {
  assert.equal(restore("pitr", at("17:29"), at("17:29")).upTo, DROP_AT);
});

test("the log is in order and no balance goes negative", () => {
  assert.ok(LOG.every((e, i) => i === 0 || e.t >= LOG[i - 1].t));
  for (let t = 0; t < 1440; t++) assert.ok(Object.values(stateAt(t).accounts).every(v => v >= 0));
});

test("describe: what the page shows after a restore", () => {
  const d = describe("backup", at("17:30"));
  assert.equal(d.status, "Restored to 00:00. Lost 11 commits.");
  assert.deepEqual(d.stats, [[100, "Alice"], [50, "Bob"], ["0 rows", "audit"]]);
  assert.equal(d.rows.filter(r => r.mark === "lost").length, 11);
  assert.equal(d.rows.filter(r => r.mark === "kept").length, 0);

  const a = describe("archive", at("17:29"));
  assert.equal(a.status, "Restored to 17:15. Lost 1 commit.");
  assert.deepEqual(a.stats, [[35, "Alice"], [115, "Bob"], ["dropped", "audit"]]);
  assert.equal(a.rows.filter(r => r.mark === "kept").length, 10);
  assert.equal(a.rows.filter(r => r.mark === "lost").length, 1);
  assert.equal(a.rows.at(-1).mark, "");

  assert.equal(describe("archive", at("17:30")).status, "Restored to 17:30. Lost 0 commits.");

  const p = describe("pitr", at("17:30"), at("17:14"));
  assert.equal(p.status, "Restored to 17:14. Lost 2 commits.");
  assert.deepEqual(p.stats, [[35, "Alice"], [115, "Bob"], ["9 rows", "audit"]]);

  const e = describe("pitr", at("17:30"), -60);
  assert.equal(e.status, "Refused: 23:00 the day before is before the backup ended at 00:00.");
  assert.equal(e.stats, null);
  assert.ok(e.rows.every(r => r.mark === ""));
});

test("the page's prose numbers", () => {
  const p = restore("pitr", at("17:30"), at("17:14"));
  assert.equal(p.state.audit.length, 9);
  assert.equal(fuzzyCopy(30).length, 6);
  const totals = fuzzyCopy(30).map(r => r.total);
  assert.equal(totals.filter(t => t === 150).length, 4);
  assert.equal(totals.filter(t => t === 180).length, 1);
  assert.equal(totals.filter(t => t === 120).length, 1);
  assert.equal(LOG.length, 12);
  assert.equal(restore("archive", at("17:29")).lost, 1);
  assert.equal(LOG.find(e => e.t > DROP_AT).t, at("17:25"));
});
