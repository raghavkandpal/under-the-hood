import { test } from "node:test";
import assert from "node:assert/strict";
import { CUSTOMERS, kaplanMeier, at, median, dropCensored, censoredAsCancelled, cohort, trueS, MEAN } from "./survival-curves.js";
import { mulberry } from "../../shared/random.js";

const near = (a, b, eps = 1e-12) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);
const share = (rows, f) => rows.filter(f).length / rows.length;

test("the 10-customer table matches the hand-worked Kaplan–Meier table", () => {
  // cancelled at 2, 3, 5, 8, 8, 12; still subscribed at 3, 6, 10, 12. Hand work: 9/10, ×8/9, ×6/7, ×3/5, ×1/2.
  const km = kaplanMeier(CUSTOMERS);
  assert.deepEqual(km.map(s => s.t), [2, 3, 5, 8, 12]);
  assert.deepEqual(km.map(s => s.n), [10, 9, 7, 5, 2]); // someone censored at 3 or 12 is still at risk for the event at 3 or 12
  assert.deepEqual(km.map(s => s.d), [1, 1, 1, 2, 1]);
  [9 / 10, 8 / 10, 24 / 35, 72 / 175, 36 / 175].forEach((S, i) => near(km[i].S, S));
  assert.equal(km[0].S, 1 - 1 / 10);
});

test("at() is a step function: 1 before the first event, flat between events", () => {
  const km = kaplanMeier(CUSTOMERS);
  assert.equal(at(km, 1.9), 1);
  near(at(km, 2), 0.9);
  near(at(km, 4.99), 0.8);
  near(at(km, 100), 36 / 175);
});

test("with no censoring, Kaplan–Meier is the share still subscribed, ties included", () => {
  const rnd = mulberry(5), rows = Array.from({ length: 60 }, () => ({ t: 1 + Math.floor(rnd() * 20), event: 1 }));
  const km = kaplanMeier(rows);
  assert.ok(km.length > 10);
  for (const s of km) near(s.S, share(rows, r => r.t > s.t));
  for (const t of [0, 3.5, 7, 25]) near(at(km, t), share(rows, r => r.t > t));
});

test("on the table, both wrong answers disagree with Kaplan–Meier at month 6", () => {
  // Dropping the 4 still subscribed leaves 6 (2,3,5,8,8,12): 3 last past month 6. Counting them as cancelled: 5 of 10 last past month 6.
  assert.equal(dropCensored(CUSTOMERS, 6), 3 / 6);
  assert.equal(censoredAsCancelled(CUSTOMERS, 6), 5 / 10);
  near(at(kaplanMeier(CUSTOMERS), 6), 24 / 35);
  assert.ok(at(kaplanMeier(CUSTOMERS), 6) > 0.5);
});

test("the cohort is seeded and censors about the requested share", () => {
  assert.deepEqual(cohort({ seed: 3 }), cohort({ seed: 3 }));
  assert.notDeepEqual(cohort({ seed: 3 }), cohort({ seed: 4 }));
  assert.equal(cohort({ censored: 0 }).filter(r => !r.event).length, 0);
  for (const c of [0.2, 0.5, 0.7]) assert.ok(Math.abs(share(cohort({ censored: c }), r => !r.event) - c) < 0.04, `${c}`);
});

test("the page's default cohort (2,000, 50% censored, seed 1): Kaplan–Meier recovers e^-1 and both shortcuts fall far below", () => {
  const rows = cohort(), km = kaplanMeier(rows), truth = Math.exp(-1);
  assert.ok(Math.abs(at(km, 12) - truth) < 0.03);
  assert.ok(dropCensored(rows, 12) < truth - 0.05);
  assert.ok(censoredAsCancelled(rows, 12) < truth - 0.05);
  assert.ok(Math.abs(median(km) - 12 * Math.LN2) < 0.5);
});

// The page's slider reaches 0 to 0.7 in steps of 0.1, and its cohort button reaches seeds 1 to 9.
const LEVELS = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7], SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

test("at every censoring level and seed, Kaplan–Meier is within 0.04 at month 12, and from 20% up the shortcuts miss by more than 0.05", () => {
  for (const censored of LEVELS) for (const seed of SEEDS) {
    const rows = cohort({ censored, seed });
    assert.ok(Math.abs(at(kaplanMeier(rows), 12) - Math.exp(-1)) < 0.04, `km ${censored} ${seed}`);
    if (censored < 0.2) continue;
    assert.ok(dropCensored(rows, 12) < Math.exp(-1) - 0.05, `drop ${censored} ${seed}`);
    assert.ok(censoredAsCancelled(rows, 12) < Math.exp(-1) - 0.05, `as-cancelled ${censored} ${seed}`);
  }
});

test("more censoring pushes both shortcuts lower at every step and seed", () => {
  for (const seed of SEEDS) {
    const rows = LEVELS.map(censored => cohort({ censored, seed }));
    for (const f of [dropCensored, censoredAsCancelled]) for (let i = 1; i < rows.length; i++) assert.ok(f(rows[i], 12) < f(rows[i - 1], 12), `${f.name} ${LEVELS[i]} ${seed}`);
  }
});

test("with nobody censored, all three curves coincide", () => {
  for (const seed of SEEDS) {
    const rows = cohort({ censored: 0, seed }), km = kaplanMeier(rows);
    for (const t of [0, 3, 12, 30]) { near(at(km, t), dropCensored(rows, t)); near(at(km, t), censoredAsCancelled(rows, t)); }
  }
});

test("median: first event time with S ≤ 0.5", () => {
  assert.equal(median(kaplanMeier(CUSTOMERS)), 8);
  assert.equal(median(kaplanMeier(CUSTOMERS.map(r => ({ t: r.t, event: r.t < 3 ? 1 : 0 })))), null);
});

test("the 95% band brackets S and is wider late than early, when few are left at risk", () => {
  const km = kaplanMeier(CUSTOMERS), w = s => s.hi - s.lo;
  for (const s of km) assert.ok(s.lo <= s.S && s.S <= s.hi && s.lo >= 0 && s.hi <= 1);
  assert.ok(w(km.at(-1)) > w(km[0]));
  // Greenwood by hand at t = 5: S = 24/35, variance = S² (1/(10·9) + 1/(9·8) + 1/(7·6)), half-width 1.96 se.
  const se = (24 / 35) * Math.sqrt(1 / 90 + 1 / 72 + 1 / 42);
  near(km[2].hi - km[2].S, 1.959964 * se, 1e-4);
  const big = kaplanMeier(cohort());
  assert.ok(w(big.find(s => s.t >= 24)) > w(big.find(s => s.t >= 3)));
  // The numbers the page quotes.
  assert.equal(Math.round(km[0].lo * 100) + "-" + Math.round(km[0].hi * 100), "71-100");
  assert.equal(Math.round(km.at(-1).lo * 100) + "-" + Math.round(km.at(-1).hi * 100), "0-54");
  assert.equal(km.at(-1).n, 2); // 2 customers left at month 12
});

test("the numbers the page quotes for the default cohort", () => {
  const rows = cohort(), km = kaplanMeier(rows), pc = v => Math.round(v * 100);
  assert.deepEqual([pc(at(km, 12)), pc(dropCensored(rows, 12)), pc(censoredAsCancelled(rows, 12))], [36, 14, 13]);
  assert.equal(median(km).toFixed(1), "8.1");
  assert.equal(pc(share(rows, r => !r.event)), 48);
  assert.deepEqual([at(kaplanMeier(CUSTOMERS), 6), dropCensored(CUSTOMERS, 6), censoredAsCancelled(CUSTOMERS, 6)].map(pc), [69, 50, 50]);
});
