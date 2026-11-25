import { test } from "node:test";
import assert from "node:assert/strict";
import { N, D, Z, share, ruleWins, peekWins, exact, singleTest, walk, results, view, pct, MODES, LIFT_LABELS } from "./sequential-testing.js";

const rule = results("rule", "none"), peek = results("peek", "none");

test("constants: N = 808, threshold 2 sqrt(N) rounds up to 57, z = 1.645", () => {
  assert.equal(N, 808);
  assert.ok(Math.abs(2 * Math.sqrt(N) - 56.85) < 0.01);
  assert.equal(D, 57);
  assert.ok(Math.abs(Z - 1.645) < 0.001);
  assert.ok(Math.abs(Z * Math.sqrt(N) - 46.8) < 0.05);
});

test("a conversion is the treatment's with probability 1/2, or 6/11 with a 20% lift", () => {
  assert.equal(share(0), 0.5);
  assert.ok(Math.abs(share(0.2) - 6 / 11) < 1e-12);
});

test("fact 1: the rule declares a false winner at most 5% of the time (4.5%)", () => {
  assert.ok(rule.win <= 0.05);
  assert.equal(pct(rule.win), "4.5%");
});

test("fact 2: peeking declares a false winner more than twice as often (42.7%, about nine times)", () => {
  assert.ok(peek.win > 2 * rule.win);
  assert.equal(pct(peek.win), "42.7%");
  assert.ok(peek.win / rule.win > 9 && peek.win / rule.win < 10);
});

test("fact 3: one test at conversion 808 keeps false winners at or below 5% (4.9%)", () => {
  const one = singleTest(0).win;
  assert.ok(one <= 0.05);
  assert.equal(pct(one), "4.9%");
});

test("fact 4: with a 20% lift the rule finds the winner 79.0% of the time and stops at 577 on average", () => {
  const r = results("rule", 20);
  assert.ok(Math.abs(r.win - 0.8) <= 0.05);
  assert.equal(pct(r.win), "79.0%");
  assert.ok(r.mean < N);
  assert.equal(Math.round(r.mean), 577);
});

test("fact 5: with a 50% lift it stops sooner on average (285 against 577)", () => {
  assert.ok(results("rule", 50).mean < results("rule", 20).mean);
  assert.equal(Math.round(results("rule", 50).mean), 285);
});

test("peeking with a 20% lift: 94.6% winners, stops at 188 on average", () => {
  const p = results("peek", 20);
  assert.equal(pct(p.win), "94.6%");
  assert.equal(Math.round(p.mean), 188);
});

test("with no difference the rule almost never stops early: mean stop 799", () => {
  assert.equal(Math.round(rule.mean), 799);
});

test("the dynamic program matches 20000 seeded runs", () => {
  for (const [name, wins, exactWin] of [["peek", peekWins, peek.win], ["rule", ruleWins, rule.win]]) {
    let w = 0;
    for (let s = 1; s <= 20000; s++) if (walk(wins, 0, s).won) w++;
    assert.ok(Math.abs(w / 20000 - exactWin) < 0.012, `${name}: ${w / 20000} vs ${exactWin}`);
  }
});

test("the dynamic program is cumulative and ends at the win probability", () => {
  const e = exact(ruleWins, 0);
  assert.equal(e.byN.length, N + 1);
  assert.equal(e.byN[N], e.win);
  assert.equal(e.byN[D - 1], 0);
  for (let n = 1; n <= N; n++) assert.ok(e.byN[n] >= e.byN[n - 1]);
});

test("a walk stops at its first win and is the same for the same seed", () => {
  const a = walk(ruleWins, 0.5, 3), b = walk(ruleWins, 0.5, 3);
  assert.deepEqual(a, b);
  if (a.won) { assert.equal(a.path[a.stop], D); assert.equal(a.path.length, a.stop + 1); }
});

test("view: tile labels and values follow the mode and lift", () => {
  for (const mode of Object.keys(MODES)) for (const lift of Object.keys(LIFT_LABELS)) {
    const v = view(mode, lift, 5), kind = lift === "none" ? "false winners" : "winners found", m = MODES[mode].toLowerCase();
    assert.deepEqual(v.stats.map(s => s[1]), [`${kind}, stop rule`, `${kind}, peeking`, `${kind}, one test at 808`, `mean stop, ${m}`, `this run, ${m}`]);
    assert.equal(v.stats[0][0], pct(results("rule", lift).win));
    assert.equal(v.stats[1][0], pct(results("peek", lift).win));
    assert.equal(v.stats[3][0], Math.round(results(mode, lift).mean));
    assert.ok(v.status.startsWith(MODES[mode]));
    assert.equal(v.stats[4][0], v.run.won ? `winner at ${v.run.stop}` : "no winner");
  }
});

test("view: boundary is flat at 57 for the rule and rises to 46.8 for peeking", () => {
  const r = view("rule", "none", 1).boundary, p = view("peek", "none", 1).boundary;
  assert.deepEqual(r, [[0, 57], [808, 57]]);
  assert.deepEqual(p[p.length - 1].map(Math.round), [808, 47]);
  assert.ok(p.every(([n, y]) => Math.abs(y - Z * Math.sqrt(n)) < 1e-9));
});

test("pct: tiny and near-certain values", () => {
  assert.equal(pct(0.0449), "4.5%");
  assert.equal(pct(0.99995), ">99.9%");
  assert.equal(pct(results("rule", 50).win), ">99.9%");
});
