import { test } from "node:test";
import assert from "node:assert/strict";
import { Raft } from "./raft.js";
import { mulberry32 } from "../../shared/tcp.js";

test("elects a single leader quickly", () => {
  const r = new Raft({ seed: 3 });
  r.step(5000);
  const leaders = r.nodes.filter(n => n.state === "leader");
  assert.equal(leaders.length, 1);
  assert.ok(r.nodes.every(n => n.term === leaders[0].term));
});

test("replicates and commits client entries everywhere", () => {
  const r = new Raft({ seed: 4 });
  r.step(5000);
  for (const c of ["x=1", "y=2", "z=3"]) r.clientRequest(c);
  r.step(3000);
  for (const n of r.nodes) {
    assert.deepEqual(n.log.map(e => e.cmd), ["x=1", "y=2", "z=3"]);
    assert.equal(n.commitIndex, 3);
  }
});

test("leader crash triggers re-election; committed data survives", () => {
  const r = new Raft({ seed: 5 });
  r.step(5000); r.clientRequest("a"); r.step(2000);
  const old = r.leader().id;
  r.crash(old); r.step(6000);
  const nl = r.leader();
  assert.ok(nl && nl.id !== old);
  assert.equal(nl.log[0].cmd, "a");
  r.clientRequest("b"); r.step(2000);
  r.restart(old); r.step(3000);
  assert.deepEqual(r.nodes[old].log.map(e => e.cmd), ["a", "b"]);
});

test("minority partition cannot commit; heals cleanly", () => {
  const r = new Raft({ seed: 6 });
  r.step(5000);
  const L = r.leader().id;
  const others = r.nodes.map(n => n.id).filter(i => i !== L);
  // isolate old leader with one follower (minority of 2)
  r.setGroup(L, 1); r.setGroup(others[0], 1);
  r.clientRequest("lost-write");
  r.step(8000);
  assert.equal(r.nodes[L].commitIndex, 0, "minority leader must not commit");
  const majLeader = r.nodes.find(n => n.group === 0 && n.state === "leader");
  assert.ok(majLeader, "majority side elects a leader");
  assert.equal(r.nodes[L].state, "leader", "stale leader still thinks it leads");
  assert.ok(r.clientRequest("kept-write", majLeader.id) != null);
  r.step(3000);
  assert.ok(majLeader.commitIndex >= 1, "majority side commits");
  for (const n of r.nodes) n.group = 0;
  r.step(6000);
  for (const n of r.nodes) assert.ok(!n.log.some(e => e.cmd === "lost-write"), `node ${n.id} discarded uncommitted write`);
  for (const n of r.nodes) assert.ok(n.log.some(e => e.cmd === "kept-write"));
});

test("randomised chaos keeps election safety and committed-prefix agreement", () => {
  for (let seed = 1; seed <= 40; seed++) {
    const r = new Raft({ seed }), rnd = mulberry32(seed * 77);
    const committed = []; // global committed history
    for (let round = 0; round < 60; round++) {
      const x = rnd();
      if (x < 0.15) r.crash(Math.floor(rnd() * 5));
      else if (x < 0.3) r.restart(Math.floor(rnd() * 5));
      else if (x < 0.4) r.setGroup(Math.floor(rnd() * 5), rnd() < 0.5 ? 0 : 1);
      else if (x < 0.45) r.nodes.forEach(n => n.group = 0);
      else r.clientRequest(`s${seed}r${round}`);
      r.step(300 + rnd() * 1500); // throws on two leaders in one term
      for (const n of r.nodes) for (let i = 0; i < n.commitIndex; i++) {
        const e = n.log[i];
        if (committed[i] == null) committed[i] = e;
        else assert.deepEqual([e.term, e.cmd], [committed[i].term, committed[i].cmd], `seed ${seed}: index ${i + 1} differs`);
      }
    }
  }
});
