import { test } from "node:test";
import assert from "node:assert/strict";
import { Cluster, majority, subsets, secondProposer, duel, delays } from "./paxos.js";

test("1. chosen once 3 of 5 accept at one ballot; 2 down still works, 3 down does not", () => {
  assert.equal(majority(5), 3);
  for (const [down, ok] of [[0, true], [1, true], [2, true], [3, false]]) {
    const c = new Cluster(5);
    for (let i = 0; i < down; i++) c.nodes[i].up = false;
    assert.equal(c.propose(1, "v").ok, ok, `${down} down`);
    assert.deepEqual(c.chosen(), ok ? ["v"] : []);
  }
  const c = new Cluster(5); // two accepts are not a majority
  c.phase1(1); c.phase2(1, "v", [0, 1]);
  assert.deepEqual(c.chosen(), []);
  c.phase2(1, "v", [2]);
  assert.deepEqual(c.chosen(), ["v"]);
});

test("2. an acceptor rejects a prepare or accept below its promise", () => {
  const c = new Cluster(5);
  assert.equal(c.prepare(0, 5).ok, true);
  assert.deepEqual(c.prepare(0, 3), { ok: false, promised: 5 });
  assert.deepEqual(c.accept(0, 4, "x"), { ok: false, promised: 5 });
  assert.equal(c.accept(0, 5, "x").ok, true);
  assert.equal(c.prepare(0, 5).ok, false, "an equal ballot is not higher");
  const r = c.propose(2, "w"); // every acceptor but #0 would promise; #0 rejects
  assert.equal(r.p1.rejects, 1);
  assert.equal(c.nodes[0].value, "x");
});

test("3. safety: after v is chosen at ballot 1, B's ballot 2 finds v through every one of the 10 quorums", () => {
  assert.equal(subsets(5, 3).length, 10);
  const runs = secondProposer(3);
  assert.equal(runs.length, 10);
  for (const r of runs) {
    assert.equal(r.vChosenBefore, true);
    assert.equal(r.value, "v", r.quorum.join());
    assert.deepEqual(r.chosen, ["v"], "w is never chosen");
  }
});

test("4. accepted is not chosen: with v on one acceptor, 6 quorums keep v and 4 pick w", () => {
  const runs = secondProposer(1);
  assert.equal(runs.every(r => !r.vChosenBefore), true);
  for (const r of runs) {
    assert.equal(r.value, r.quorum.includes(0) ? "v" : "w", r.quorum.join());
    assert.deepEqual(r.chosen, [r.value], "exactly one value ends up chosen");
  }
  assert.equal(runs.filter(r => r.value === "v").length, 6);
  assert.equal(runs.filter(r => r.value === "w").length, 4);
});

test("5. duelling proposers: no backoff chooses nothing in 20 rounds; seeded backoff always does, within 4 rounds", () => {
  const d = duel(20);
  assert.equal(d.round, null);
  assert.equal(d.value, null);
  assert.equal(d.ballots, 40, "ballots keep climbing, 2 per round");
  for (let seed = 1; seed <= 500; seed++) {
    const r = duel(20, { backoff: true, seed });
    assert.ok(r.round >= 2 && r.round <= 4, `seed ${seed}: round ${r.round}`);
    assert.ok(r.value === "v" || r.value === "w");
  }
  assert.deepEqual(duel(20, { backoff: true, seed: 8 }), duel(20, { backoff: true, seed: 8 }));
  assert.equal(duel(20, { backoff: true, seed: 8 }).value, "v");
});

test("6. cost: 4 message delays for one decision, then 2 per slot with a stable leader", () => {
  assert.equal(new Cluster(5).propose(1, "v").delays, 4);
  assert.equal(delays(1, true), 4);
  assert.deepEqual([1, 2, 3, 10].map(s => delays(s, true)), [4, 6, 8, 22]);
  assert.deepEqual([1, 2, 3, 10].map(s => delays(s, false)), [4, 8, 12, 40]);
});
