import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULTS, SHAPES, makeTable, buildIndex, lookup, lowerBound, scanPages, indexPages, insertRow } from "./what-is-an-index.js";

const brute = (rows, f) => rows.filter(r => Object.entries(f).every(([c, v]) => r[c] === v)).map(r => r.id);
const filterFor = (p, shape) => Object.fromEntries(SHAPES[shape].map(c => [c, p[c]]));
const rows = makeTable(), index = buildIndex(rows);

test("fact 1: one row among 1,000,000 at 100 per page", () => {
  assert.equal(scanPages(1e6, 100), 1e6 / 100);
  // 100^3 = 1,000,000 < 1,000,001 keys, so three levels are not enough: 4 levels + 1 table page
  assert.ok(100 ** 3 < 1e6 + 1 && 1e6 + 1 <= 100 ** 4);
  assert.equal(indexPages(1e6, 100), 4 + 1);
  assert.equal(scanPages(1e6, 100) / indexPages(1e6, 100), 2000);
});

test("fact 2: binary search over 1,000,000 sorted keys takes at most 20 comparisons", () => {
  assert.ok(2 ** 19 < 1e6 + 1 && 1e6 + 1 <= 2 ** 20);
  const keys = Array.from({ length: 1e6 }, (_, i) => i * 2); // even numbers, so odd targets are misses
  let worst = 0;
  for (let t = -1; t <= 2e6; t += 997) {
    const { pos, compares } = lowerBound(keys, e => e - t);
    assert.equal(pos, Math.min(1e6, Math.ceil(Math.max(t, 0) / 2))); // arithmetic reference
    worst = Math.max(worst, compares);
  }
  assert.ok(worst <= 20);
  assert.equal(worst, 20); // and the bound is reached
});

test("default page: person 700, 2,000 rows, seed 7", () => {
  assert.equal(rows.length, DEFAULTS.rows);
  const p = rows[DEFAULTS.person - 1];
  assert.equal(p.id, DEFAULTS.person);
  const res = Object.fromEntries(Object.keys(SHAPES).map(s => [s, lookup(rows, index, filterFor(p, s))]));
  // last: 11 comparisons + the 37 entries with that last name; both: 11 + 1; first alone: every row
  assert.deepEqual([res.last.steps, res.both.steps, res.first.steps], [11 + 37, 11 + 1, 2000]);
  assert.deepEqual([res.last.usedIndex, res.both.usedIndex, res.first.usedIndex], [true, true, false]);
  assert.equal(res.last.matches.length, rows.filter(r => r.last === p.last).length);
  assert.equal(res.both.matches.length, rows.filter(r => r.last === p.last && r.first === p.first).length);
});

test("fact 3: the index answers last and last+first like a full scan, for every person; first alone falls back", () => {
  for (const p of rows) {
    for (const shape of Object.keys(SHAPES)) {
      const f = filterFor(p, shape), r = lookup(rows, index, f);
      assert.deepEqual(r.matches.slice().sort((a, b) => a - b), brute(rows, f));
      assert.equal(r.usedIndex, shape !== "first");
      if (shape === "first") assert.equal(r.steps, rows.length);
      else assert.ok(r.steps < rows.length / 10); // far under a tenth of the scan on this table
    }
  }
});

test("a name that is not in the table finds nothing in a few steps", () => {
  const r = lookup(rows, index, { last: "Nobody" });
  assert.deepEqual(r.matches, []);
  assert.ok(r.compares <= Math.ceil(Math.log2(rows.length + 1)));
});

test("trend: a 16x bigger table costs the scan 16x and the search about 4 more comparisons", () => {
  const cost = n => {
    const t = makeTable(DEFAULTS.seed, n), i = buildIndex(t), p = t[n >> 1];
    return { scan: lookup(t, i, { first: p.first }).steps, search: lookup(t, i, { last: p.last, first: p.first }).compares };
  };
  const small = cost(1000), big = cost(16000);
  assert.equal(big.scan / small.scan, 16);
  assert.ok(big.search - small.search <= 4 && big.search <= Math.ceil(Math.log2(16001)));
});

test("fact 4: an insert writes 1 + k structures and keeps every index sorted", () => {
  for (const k of [0, 1, 3, 6]) {
    const table = makeTable(DEFAULTS.seed, 300), indexes = Array.from({ length: k }, () => buildIndex(table));
    const row = { id: 301, last: "Chen", first: "Ana" };
    assert.equal(insertRow(table, indexes, row), 1 + k);
    assert.equal(table.length, 301);
    for (const ix of indexes) {
      assert.equal(ix.length, 301);
      assert.deepEqual(ix, buildIndex(table)); // same as rebuilding from scratch
    }
  }
});
