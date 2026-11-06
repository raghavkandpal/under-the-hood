import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { measure, measureAll, helper, BASELINE } from "../scripts/text-budget.js";

const base = JSON.parse(readFileSync(BASELINE, "utf8"));
const all = measureAll();

test("measure counts helper text by kind and the caveat on its own", () => {
  const m = measure(`<main><h1>X</h1><p class="status">Click a cell to flip it.</p><p class="status" id="out"></p>
    <label>Rate <input type="range"></label><small>(per second)</small><h2>How it works</h2><p>Prose is free.</p><p class="caveat">Toy model.</p></main>`);
  assert.deepEqual(m, { status: 6, labels: 1, small: 2, note: 0, caveat: 2 });
});

test("helper text never grows: each page stays at or under its count in tests/text-budget.json", () => {
  const over = Object.entries(all).filter(([id, m]) => !base[id] || helper(m) > base[id].helper || m.caveat > base[id].caveat)
    .map(([id, m]) => `${id}: helper ${helper(m)} (budget ${base[id]?.helper ?? "none"}), caveat ${m.caveat} (budget ${base[id]?.caveat ?? "none"})`);
  assert.deepEqual(over, [], "Cut text or fix the layout instead (README › Text). New page? Run: npm run text-budget -- --update");
});

test("the recorded counts are current, so progress shows in the diff", () => {
  const stale = Object.entries(all).filter(([id, m]) => base[id] && (helper(m) < base[id].helper || m.caveat < base[id].caveat)).map(([id]) => id);
  assert.deepEqual(stale, [], "Text went down, nice. Record it: npm run text-budget -- --update");
});

