import { test } from "node:test";
import assert from "node:assert/strict";
import { tokenize, parse, fold, compile, run } from "../lib/compiler.js";

const evalSrc = (s, f = false) => { let ast = parse(tokenize(s)); if (f) ast = fold(ast); return run(compile(ast)); };

test("precedence, associativity and unary minus follow maths conventions", () => {
  // -2 ^ 2 is -(2^2) = -4, as in maths and Python
  const cases = { "1 + 2 * 3": 7, "(1 + 2) * 3": 9, "10 - 4 - 3": 3, "2 ^ 3 ^ 2": 512, "-2 ^ 2": -4, "2 * -3": -6, "7 % 4 + 8 / 2": 7, "-(1 - 4) * 2": 6 };
  for (const [s, v] of Object.entries(cases)) assert.equal(evalSrc(s).out[0], v, s);
});

test("variables and multiple statements", () => {
  const r = evalSrc("width = 3; height = width + 2; width * height");
  assert.equal(r.out[0], 15); assert.deepEqual(r.env, { width: 3, height: 5 });
});

test("constant folding gives the same answer with fewer instructions", () => {
  const s = "x = 4; x * (2 + 3) - 10 / 2";
  const a = compile(parse(tokenize(s))), b = compile(fold(parse(tokenize(s))));
  assert.equal(run(a).out[0], run(b).out[0]); assert.ok(b.length < a.length);
});

test("errors are reported with positions", () => {
  assert.throws(() => tokenize("2 $ 3"), /position 2/);
  assert.throws(() => parse(tokenize("(1 + 2")), /expected '\)'/);
  assert.throws(() => evalSrc("y + 1"), /'y' is not defined/);
});
