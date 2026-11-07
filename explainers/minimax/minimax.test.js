import { test } from "node:test";
import assert from "node:assert/strict";
import { search, winner, other } from "./minimax.js";

const empty = () => Array(9).fill(null);

test("plain minimax visits the whole game tree: 549,946 positions", () => {
  assert.equal(search(empty(), "X", { prune: false }).nodes, 549946);
});

test("alpha-beta finds the same answer, a draw, looking at a fraction of the positions", () => {
  const full = search(empty(), "X", { prune: false }), ab = search(empty(), "X");
  assert.equal(full.score, 0); assert.equal(ab.score, 0); assert.ok(ab.nodes * 20 < full.nodes, `${ab.nodes}`);
});

test("takes a win when there is one, and blocks the opponent's", () => {
  assert.equal(search(["X", "X", null, "O", "O", null, null, null, null], "X").move, 2);
  assert.equal(search(["X", "X", null, "O", null, null, null, null, null], "O").move, 2);
});

test("the computer never loses, whatever the human plays", () => {
  let games = 0;
  function play(b, turn, ai) {
    const w = winner(b); if (w) { games++; assert.notEqual(w, other(ai), b.join()); return; }
    if (turn === ai) { const n = [...b]; n[search(b, ai).move] = ai; play(n, other(turn), ai); }
    else for (let i = 0; i < 9; i++) if (!b[i]) { const n = [...b]; n[i] = turn; play(n, other(turn), ai); }
  }
  play(empty(), "X", "O"); play(empty(), "X", "X");
  assert.ok(games > 100, `${games}`);
});
