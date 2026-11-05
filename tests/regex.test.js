import { test } from "node:test";
import assert from "node:assert/strict";
import { parse, compile, simulate, backtrack } from "../lib/regex.js";

const cases = [
  ["abc", ["abc"], ["ab", "abcd", ""]],
  ["a|b", ["a", "b"], ["ab", ""]],
  ["ab*c", ["ac", "abc", "abbbbc"], ["a", "abbb"]],
  ["(ab)+", ["ab", "abab"], ["", "aba"]],
  ["colou?r", ["color", "colour"], ["colouur"]],
  ["a.c", ["abc", "a-c"], ["ac"]],
  ["(a|b)*abb", ["abb", "aababb", "babb"], ["ab", "abba"]],
  ["", [""], ["a"]],
  ["a\\*b", ["a*b"], ["ab", "aab"]],
];

test("NFA and backtracking agree with JavaScript's RegExp", () => {
  for (const [p, yes, no] of cases) {
    const ast = parse(p), nfa = compile(ast), js = new RegExp(`^(?:${p})$`);
    for (const s of [...yes, ...no]) {
      const want = js.test(s);
      assert.equal(simulate(nfa, s).matched, want, `NFA /${p}/ on "${s}"`);
      assert.equal(backtrack(ast, s).matched, want, `BT /${p}/ on "${s}"`);
    }
  }
});

test("syntax errors are reported", () => {
  for (const bad of ["(ab", "a)", "*a", "a|*", "ab\\"]) assert.throws(() => parse(bad), /./, bad);
});

test("catastrophic backtracking: exponential for (a+)+b, linear for the NFA", () => {
  const ast = parse("(a+)+b"), nfa = compile(ast);
  const bt = n => backtrack(ast, "a".repeat(n)).steps, nf = n => simulate(nfa, "a".repeat(n)).work;
  assert.ok(bt(16) > 8 * bt(12), `bt ${bt(12)} → ${bt(16)}`);
  assert.ok(nf(200) < 3 * nf(100), `nfa ${nf(100)} → ${nf(200)}`);
  assert.equal(backtrack(ast, "a".repeat(40), 1e5).gaveUp, true);
});
