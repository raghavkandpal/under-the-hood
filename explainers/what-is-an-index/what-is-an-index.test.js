import { test } from "node:test";
import assert from "node:assert/strict";
import { heightFor } from "../../shared/height.js";
import { DEFAULTS, SHAPES, makeTable, buildIndex, lookup, lowerBound, scanPages, indexPages, insertRow, structuresPerInsert, maxCompares } from "./what-is-an-index.js";

const brute = (rows, f) => rows.filter(r => Object.entries(f).every(([c, v]) => r[c] === v)).map(r => r.id);
const filterFor = (p, shape) => Object.fromEntries(SHAPES[shape].map(c => [c, p[c]]));
const rows = makeTable(), index = buildIndex(rows);

test("fact 1: one row among 1,000,000 at 100 per page", () => {
  assert.equal(scanPages(1e6, 100), 10000);
  // three levels hold at most 100^3 - 1 = 999,999 keys, one short of a million, so 4 levels + 1 table page
  assert.equal(heightFor(999999, 100), 3);
  assert.equal(heightFor(1e6, 100), 4);
  assert.equal(indexPages(1e6, 100), 4 + 1);
  assert.equal(scanPages(1e6, 100) / indexPages(1e6, 100), 2000);
});

test("fact 2: binary search over 1,000,000 sorted keys takes at most 20 comparisons", () => {
  const keys = Array.from({ length: 1e6 }, (_, i) => i * 2); // even numbers, so odd targets are misses
  let worst = 0;
  for (let t = -1; t <= 2e6; t += 997) {
    const { pos, compares } = lowerBound(keys, e => e - t);
    assert.equal(pos, Math.min(1e6, Math.ceil(Math.max(t, 0) / 2))); // arithmetic reference
    worst = Math.max(worst, compares);
  }
  assert.equal(worst, 20); // never more, and the bound is reached
  assert.equal(maxCompares(1e6), 20);
});

test("doubling the table adds at most one comparison to the worst case", () => {
  const worst = n => { const a = Array.from({ length: n }, (_, i) => i * 2); let w = 0; for (let t = -1; t <= 2 * n; t++) w = Math.max(w, lowerBound(a, e => e - t).compares); return w; };
  for (let n = 1; n <= 300; n++) {
    assert.ok(worst(2 * n) <= worst(n) + 1, `n=${n}`);
    assert.equal(worst(n), maxCompares(n));
  }
});

test("default page: person 700, 2,000 rows, seed 7", () => {
  assert.equal(rows.length, DEFAULTS.rows);
  const p = rows[DEFAULTS.person - 1];
  assert.equal(p.last, "Ortiz");
  const res = Object.fromEntries(Object.keys(SHAPES).map(s => [s, lookup(rows, index, filterFor(p, s))]));
  // last: 11 comparisons + the 37 entries with that last name; both: 11 + 1; first alone: every row
  assert.deepEqual([res.last.matches.length, res.both.matches.length, res.first.matches.length], [37, 1, 32]);
  assert.equal(res.last.compares, 11);
  assert.deepEqual([res.last.steps, res.both.steps, res.first.steps], [11 + 37, 11 + 1, 2000]);
  assert.deepEqual([res.last.usedIndex, res.both.usedIndex, res.first.usedIndex], [true, true, false]);
  assert.equal(res.last.matches.length, rows.filter(r => r.last === p.last).length);
  assert.equal(res.both.matches.length, rows.filter(r => r.last === p.last && r.first === p.first).length);
});

test("many matches: every last name is shared by dozens, and adding the first name always narrows", () => {
  for (const p of rows) {
    const last = lookup(rows, index, { last: p.last }), both = lookup(rows, index, { last: p.last, first: p.first });
    assert.ok(last.matches.length >= 24, p.last);
    assert.ok(last.steps - both.steps >= 24, `person ${p.id}`);
    assert.ok(both.steps < last.steps);
  }
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
  assert.ok(r.compares <= maxCompares(rows.length));
});

test("trend: a 16x bigger table costs the scan 16x and the search about 4 more comparisons", () => {
  const cost = n => {
    const t = makeTable(DEFAULTS.seed, n), i = buildIndex(t), p = t[n >> 1];
    return { scan: lookup(t, i, { first: p.first }).steps, search: lookup(t, i, { last: p.last, first: p.first }).compares };
  };
  const small = cost(1000), big = cost(16000);
  assert.equal(big.scan, 16 * small.scan);
  assert.ok(big.search - small.search <= 4 && big.search <= maxCompares(16000));
});

test("fact 4: an insert writes 1 + k structures and keeps every index sorted", () => {
  for (let k = 0; k <= 8; k++) { // the slider's range
    const table = makeTable(DEFAULTS.seed, 300), indexes = Array.from({ length: k }, () => buildIndex(table));
    const row = { id: 301, last: "Chen", first: "Ana" };
    const written = insertRow(table, indexes, row);
    assert.equal(written, structuresPerInsert(k));
    assert.equal([table, ...indexes].filter(a => a.length === 301).length, written); // each one really grew
    for (const ix of indexes) {
      assert.deepEqual(ix, buildIndex(table)); // same as rebuilding from scratch
    }
  }
});
