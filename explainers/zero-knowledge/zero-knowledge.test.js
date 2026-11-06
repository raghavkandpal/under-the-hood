import { test } from "node:test";
import assert from "node:assert/strict";
import { GRAPH, commit, round, validColouring, cheatColouring, badEdges, survive, roundsFor } from "./zero-knowledge.js";
import { mulberry } from "../../shared/random.js";

test("the secret colouring is valid; the cheater's isn't", () => {
  assert.ok(validColouring(GRAPH, GRAPH.secret)); assert.ok(!validColouring(GRAPH, cheatColouring(GRAPH)));
});

test("commitments hide the colour and bind to it", () => {
  assert.notEqual(commit(1, "a1"), commit(1, "b2")); // same colour, different nonce: unrelated hashes
  assert.notEqual(commit(1, "a1"), commit(2, "a1")); // can't open to a different colour later
});

test("an honest prover always passes", () => {
  const rnd = mulberry(1); for (let i = 0; i < 300; i++) assert.ok(round(GRAPH, GRAPH.secret, rnd).ok);
});

test("a cheater with b broken edges is caught with probability b/E per round, and survives k rounds with (1 − b/E)^k", () => {
  const rnd = mulberry(2), N = 6000; let caught = 0;
  for (let i = 0; i < N; i++) if (!round(GRAPH, cheatColouring(GRAPH), rnd).ok) caught++;
  const b = badEdges(GRAPH, cheatColouring(GRAPH)); assert.equal(b, 2);
  assert.ok(Math.abs(caught / N - b / GRAPH.edges.length) < 0.015, `${caught / N}`);
  assert.ok(survive(GRAPH, 100, 1) < 1e-3); assert.equal(roundsFor(GRAPH, 1e-6, 1), 173); // even a single broken edge can't hide for long
});

test("zero knowledge: every opened pair of colours is equally likely", () => {
  const rnd = mulberry(3), counts = {}, N = 12000;
  for (let i = 0; i < N; i++) { const r = round(GRAPH, GRAPH.secret, rnd), k = r.opened.map(o => o.colour).join(""); counts[k] = (counts[k] || 0) + 1; }
  assert.equal(Object.keys(counts).length, 6); // the six ordered pairs of different colours
  for (const c of Object.values(counts)) assert.ok(Math.abs(c / N - 1 / 6) < 0.02);
});
