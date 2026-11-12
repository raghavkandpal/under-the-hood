// Single-decree Paxos with scripted message schedules, no DOM, so it can be tested in Node.
import { mulberry } from "../../shared/random.js";

export const majority = n => Math.floor(n / 2) + 1;

/** n acceptors. A ballot is a positive integer; each proposer owns one parity, so ballots never collide. */
export class Cluster {
  constructor(n = 5) {
    this.n = n;
    this.nodes = Array.from({ length: n }, (_, id) => ({ id, up: true, promised: 0, ballot: 0, value: null }));
    this.log = []; // every accept that happened: { id, ballot, value }
  }
  get majority() { return majority(this.n); }
  /** Acceptor rule 1: promise only a ballot higher than any promise so far. Down nodes stay silent (null). */
  prepare(id, ballot) {
    const a = this.nodes[id];
    if (!a.up) return null;
    if (ballot <= a.promised) return { ok: false, promised: a.promised };
    a.promised = ballot;
    return { ok: true, ballot: a.ballot, value: a.value };
  }
  /** Acceptor rule 2: accept unless it has promised a higher ballot. */
  accept(id, ballot, value) {
    const a = this.nodes[id];
    if (!a.up) return null;
    if (ballot < a.promised) return { ok: false, promised: a.promised };
    Object.assign(a, { promised: ballot, ballot, value });
    this.log.push({ id, ballot, value });
    return { ok: true };
  }
  all() { return this.nodes.map(a => a.id); }
  /** Phase 1 to the acceptors in `reach`. Needs a majority of promises; adopts the value of the highest ballot reported. */
  phase1(ballot, reach = this.all()) {
    const replies = reach.map(id => [id, this.prepare(id, ballot)]).filter(([, r]) => r);
    const yes = replies.filter(([, r]) => r.ok);
    const prior = yes.map(([, r]) => r).filter(r => r.value !== null).sort((a, b) => b.ballot - a.ballot)[0];
    return {
      ok: yes.length >= this.majority, promises: yes.map(([id]) => id), rejects: replies.length - yes.length,
      adopted: prior ? prior.value : null, seen: Math.max(0, ...replies.map(([, r]) => r.promised ?? 0)),
    };
  }
  /** Phase 2 to `reach`. Chosen once a majority accept. */
  phase2(ballot, value, reach = this.all()) {
    const replies = reach.map(id => [id, this.accept(id, ballot, value)]).filter(([, r]) => r);
    const yes = replies.filter(([, r]) => r.ok);
    return { ok: yes.length >= this.majority, accepts: yes.map(([id]) => id), seen: Math.max(0, ...replies.map(([, r]) => r.promised ?? 0)) };
  }
  /** A whole attempt. `acceptReach` lets a script drop messages between the phases (a proposer that crashes mid-way). */
  propose(ballot, value, reach = this.all(), acceptReach = reach) {
    const p1 = this.phase1(ballot, reach);
    if (!p1.ok) return { ok: false, phase: 1, p1, delays: 2 };
    const v = p1.adopted ?? value, p2 = this.phase2(ballot, v, acceptReach);
    return { ok: p2.ok, phase: 2, value: v, p1, p2, delays: 4 };
  }
  /** Values a majority accepted at one ballot. Safety says this never holds two different values. */
  chosen() {
    const byBallot = new Map();
    for (const { id, ballot, value } of this.log) byBallot.set(ballot, { value, ids: new Set([...(byBallot.get(ballot)?.ids ?? []), id]) });
    return [...new Set([...byBallot].filter(([, x]) => x.ids.size >= this.majority).sort((a, b) => a[0] - b[0]).map(([, x]) => x.value))];
  }
}

/** All k-element subsets of 0..n-1. */
export function subsets(n, k, from = 0) {
  if (!k) return [[]];
  const out = [];
  for (let i = from; i <= n - k; i++) for (const rest of subsets(n, k - 1, i + 1)) out.push([i, ...rest]);
  return out;
}

/** Fact 3 and 4: v was accepted at ballot 1 by `acceptedBy` acceptors; B runs ballot 2 with w through each 3-acceptor quorum. */
export function secondProposer(acceptedBy, n = 5) {
  const q = majority(n);
  return subsets(n, q).map(quorum => {
    const c = new Cluster(n);
    c.propose(1, "v", c.all(), c.all().slice(0, acceptedBy)); // acceptors beyond the first `acceptedBy` never hear accept
    const before = c.chosen(), r = c.propose(2, "w", quorum);
    return { quorum, value: r.value, vChosenBefore: before.includes("v"), chosen: c.chosen() };
  });
}

/** Fact 5: two proposers, one phase per turn, A then B each round. After a rejected accept a proposer retries phase 1 at once, unless it backs off. */
export function duel(rounds = 20, { backoff = false, seed = 1 } = {}) {
  const rnd = mulberry(seed), c = new Cluster(5), events = [];
  let now = 0;
  const next = (p, seen) => { let b = seen + 1; while (b % 2 !== p.parity) b++; return b; };
  const P = [{ name: "A", value: "v", parity: 1 }, { name: "B", value: "w", parity: 0 }].map(p => ({ ...p, ballot: next(p, 0), phase: 1, wait: 0, fails: 0 }));
  const fail = (p, seen, what) => {
    p.ballot = next(p, seen); p.phase = 1; p.fails++;
    p.wait = backoff ? Math.floor(rnd() * 2 ** Math.min(p.fails, 4)) : 0;
    events.push({ who: p.name, kind: `${what} rejected`, ballot: p.ballot, wait: p.wait, round: now });
  };
  const turn = (p, round) => {
    if (p.phase === 1) {
      const r = c.phase1(p.ballot);
      if (!r.ok) return fail(p, r.seen, "prepare");
      p.phase = 2; p.value = r.adopted ?? p.value;
      events.push({ who: p.name, kind: "promised", ballot: p.ballot, round });
    } else {
      const r = c.phase2(p.ballot, p.value);
      if (!r.ok) { fail(p, r.seen, "accept"); if (!p.wait) turn(p, round); return; }
      events.push({ who: p.name, kind: "chosen", ballot: p.ballot, round });
      return true;
    }
  };
  for (let round = 1; round <= rounds; round++) {
    now = round;
    for (const p of P) {
      if (p.wait > 0) { p.wait--; events.push({ who: p.name, kind: "waits", round }); continue; }
      if (turn(p, round)) return { round, value: p.value, events, ballots: Math.max(...P.map(x => x.ballot)) };
    }
  }
  return { round: null, value: null, events, ballots: Math.max(...P.map(x => x.ballot)) };
}

/** Fact 6: message delays for `slots` decisions. Multi-Paxos runs phase 1 once, for every slot, then only accept/accepted. */
export function delays(slots, stableLeader) {
  return stableLeader ? 4 + 2 * Math.max(0, slots - 1) : 4 * slots;
}
