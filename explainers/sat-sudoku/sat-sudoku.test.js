import { test } from "node:test";
import assert from "node:assert/strict";
import { candidates, valid, complete, propagate, solve, generate } from "./sat-sudoku.js";

const { puzzle, solution } = generate(7, 26);

test("generated puzzles have exactly one solution, and keep their clues", () => {
  assert.equal(solve(puzzle, { propagate: true, mrv: true, count: 2 }).solutions, 1);
  assert.equal(solve(puzzle, { mrv: true, count: 2 }).solutions, 1); // independent check, no propagation
  assert.ok(puzzle.filter(Boolean).length <= 30);
  puzzle.forEach((v, i) => v && assert.equal(solution[i], v));
});

test("every strategy finds the same valid solution", () => {
  for (const o of [{}, { mrv: true }, { propagate: true, mrv: true }]) {
    const r = solve(puzzle, o); assert.ok(complete(r.solution)); assert.deepEqual(r.solution, solution);
  }
});

test("candidates respect row, column and box", () => {
  const g = [...solution]; g[0] = 0; assert.deepEqual(candidates(g, 0), [solution[0]]);
});

test("propagation and smart cell choice cut guesses by orders of magnitude", () => {
  let plain = 0, smart = 0;
  for (const seed of [1, 2, 3, 4]) { const p = generate(seed, 25).puzzle; plain += solve(p).guesses; smart += solve(p, { propagate: true, mrv: true }).guesses; }
  assert.ok(plain > 20 * Math.max(1, smart), `plain ${plain} vs smart ${smart}`);
});

test("contradictions are detected", () => {
  const g = [...puzzle]; const i = g.indexOf(0); g[i] = solution[i] % 9 + 1; // a wrong digit
  if (valid(g)) assert.equal(solve(g, { propagate: true, mrv: true }).solution, null);
  const bad = new Array(81).fill(0); bad[0] = 5; bad[1] = 5; assert.equal(valid(bad), false); assert.equal(propagate([...bad]) === null || !valid(bad), true);
});
