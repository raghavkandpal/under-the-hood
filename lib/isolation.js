// A toy multi-version key-value store with four isolation levels, and the classic anomaly scripts. No DOM.

export const LEVELS = {
  ru: "Read uncommitted",
  rc: "Read committed",
  si: "Snapshot (repeatable read)",
  ser: "Serializable",
};

export class DB {
  constructor(initial) {
    this.clock = 1; this.versions = new Map(); // key -> [{v, ts}]
    for (const [k, v] of Object.entries(initial)) this.versions.set(k, [{ v, ts: 0 }]);
    this.dirty = new Map(); // key -> {v, txn} (uncommitted writes, for read-uncommitted readers)
  }
  latest(k, asOf = Infinity) { const vs = this.versions.get(k) ?? []; for (let i = vs.length - 1; i >= 0; i--) if (vs[i].ts <= asOf) return vs[i]; return { v: undefined, ts: -1 }; }
  begin(level, name) { return { name, level, start: this.clock, writes: new Map(), reads: new Set(), status: "active", vars: {} }; }
  read(t, k) {
    t.reads.add(k);
    if (t.writes.has(k)) return t.writes.get(k);
    if (t.level === "ru" && this.dirty.has(k)) return this.dirty.get(k).v;
    if (t.level === "ru" || t.level === "rc") return this.latest(k).v;
    return this.latest(k, t.start).v; // snapshot as of transaction start
  }
  write(t, k, v) { t.writes.set(k, v); this.dirty.set(k, { v, txn: t.name }); }
  commit(t) {
    if (t.level === "si" || t.level === "ser") {
      for (const k of t.writes.keys()) if (this.latest(k).ts > t.start) return this.abort(t, `write conflict on “${k}”: another transaction changed it after we started`);
    }
    if (t.level === "ser") {
      for (const k of t.reads) if (this.latest(k).ts > t.start) return this.abort(t, `read “${k}”, which another transaction changed before we committed, so no serial order fits`);
    }
    const ts = ++this.clock;
    for (const [k, v] of t.writes) { this.versions.get(k)?.push({ v, ts }) ?? this.versions.set(k, [{ v, ts }]); if (this.dirty.get(k)?.txn === t.name) this.dirty.delete(k); }
    t.status = "committed"; return { ok: true };
  }
  abort(t, why = "rolled back") { t.status = "aborted"; t.why = why; for (const k of t.writes.keys()) if (this.dirty.get(k)?.txn === t.name) this.dirty.delete(k); return { ok: false, why }; }
  snapshot() { return Object.fromEntries([...this.versions.keys()].map(k => [k, this.latest(k).v])); }
}

/**
 * Scenarios: steps run in order. Each step is [txn, kind, ...]:
 *  ["T1", "read", key, var]            read key into a txn-local variable
 *  ["T1", "write", key, (vars)=>value] write a computed value
 *  ["T1", "commit"] / ["T1", "abort"]
 * `anomaly(result)` says whether the bad thing happened.
 */
export const SCENARIOS = {
  dirty: {
    label: "Dirty read", initial: { balance: 100 },
    story: "T1 adds a deposit, then cancels it. T2 reads the balance in between.",
    steps: [["T1", "write", "balance", v => 200], ["T2", "read", "balance", "seen"], ["T1", "abort"], ["T2", "commit"]],
    anomaly: r => r.vars.T2.seen === 200, what: r => `T2 saw ${r.vars.T2.seen}, ${r.vars.T2.seen === 200 ? "money that never existed" : "the real balance"}.`,
  },
  nonrepeat: {
    label: "Non-repeatable read", initial: { price: 10 },
    story: "T1 reads a price twice while T2 changes it in between.",
    steps: [["T1", "read", "price", "first"], ["T2", "write", "price", v => 15], ["T2", "commit"], ["T1", "read", "price", "second"], ["T1", "commit"]],
    anomaly: r => r.vars.T1.first !== r.vars.T1.second, what: r => `T1 read ${r.vars.T1.first}, then ${r.vars.T1.second}${r.vars.T1.first !== r.vars.T1.second ? " in the same transaction" : ", consistent"}.`,
  },
  lost: {
    label: "Lost update", initial: { balance: 100 },
    story: "Two transactions each add 50 to the same balance: read, add, write.",
    steps: [["T1", "read", "balance", "b"], ["T2", "read", "balance", "b"], ["T1", "write", "balance", v => v.b + 50], ["T2", "write", "balance", v => v.b + 50], ["T1", "commit"], ["T2", "commit"]],
    anomaly: r => !r.aborted.length && r.final.balance === 150,
    what: r => r.aborted.length ? `Final balance ${r.final.balance}. The database refused ${r.aborted.join(", ")}, which the app must retry, but nothing was silently lost.` : `Final balance ${r.final.balance}${r.final.balance === 150 ? ", but it should be 200. Both commits succeeded and one deposit silently vanished" : ", correct"}.`,
  },
  skew: {
    label: "Write skew", initial: { alice_on_call: true, bob_on_call: true },
    story: "Rule: at least one doctor must stay on call. Alice and Bob both check that the other is on call, then sign themselves off.",
    steps: [["T1", "read", "bob_on_call", "other"], ["T2", "read", "alice_on_call", "other"], ["T1", "write", "alice_on_call", v => (v.other ? false : true)], ["T2", "write", "bob_on_call", v => (v.other ? false : true)], ["T1", "commit"], ["T2", "commit"]],
    anomaly: r => !r.final.alice_on_call && !r.final.bob_on_call, what: r => (!r.final.alice_on_call && !r.final.bob_on_call ? "Nobody is on call. Each transaction was fine alone, but together they broke the rule." : "At least one doctor is still on call."),
  },
};

export function runScenario(key, level) {
  const S = SCENARIOS[key], db = new DB(S.initial), txns = {}, log = [];
  const T = name => (txns[name] ??= db.begin(level, name));
  // all transactions begin at the start, as in the classic textbook interleavings
  for (const [name] of S.steps) T(name);
  for (const [name, kind, k, x] of S.steps) {
    const t = T(name);
    if (t.status !== "active") { log.push({ name, text: `(${kind} skipped: already ${t.status})`, kind: "skip" }); continue; }
    if (kind === "read") { const v = db.read(t, k); t.vars[x] = v; log.push({ name, text: `read ${k} → ${v}`, kind }); }
    else if (kind === "write") { const v = x(t.vars); db.write(t, k, v); log.push({ name, text: `write ${k} = ${v}`, kind }); }
    else if (kind === "commit") { const r = db.commit(t); log.push({ name, text: r.ok ? "COMMIT ✓" : `ABORT ✗: ${r.why}`, kind: r.ok ? "commit" : "abort" }); }
    else if (kind === "abort") { db.abort(t, "chose to roll back"); log.push({ name, text: "ROLLBACK", kind: "abort" }); }
  }
  const result = { final: db.snapshot(), vars: Object.fromEntries(Object.entries(txns).map(([n, t]) => [n, t.vars])), log, aborted: Object.values(txns).filter(t => t.status === "aborted").map(t => t.name) };
  result.anomaly = S.anomaly(result); result.what = S.what(result);
  return result;
}
