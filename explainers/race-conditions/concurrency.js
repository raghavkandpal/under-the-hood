// A tiny multi-threaded machine: threads run instruction lists over shared memory with locks.
// You choose the interleaving; the machine reports races and deadlocks. No DOM.

/** Instruction forms: ["load", reg, var] ["add", reg, k] ["store", var, reg] ["lock", L] ["unlock", L] */
export const PROGRAMS = {
  race: {
    label: "count++ with no lock", shared: { count: 0 },
    threads: [
      [["load", "r", "count"], ["add", "r", 1], ["store", "count", "r"]],
      [["load", "r", "count"], ["add", "r", 1], ["store", "count", "r"]],
    ], expect: s => s.count === 2, goal: "count should end at 2",
  },
  locked: {
    label: "count++ inside a lock", shared: { count: 0 },
    threads: [
      [["lock", "m"], ["load", "r", "count"], ["add", "r", 1], ["store", "count", "r"], ["unlock", "m"]],
      [["lock", "m"], ["load", "r", "count"], ["add", "r", 1], ["store", "count", "r"], ["unlock", "m"]],
    ], expect: s => s.count === 2, goal: "count should end at 2",
  },
  deadlock: {
    label: "two locks, opposite order", shared: { a: 100, b: 0 },
    threads: [
      [["lock", "A"], ["lock", "B"], ["load", "r", "a"], ["add", "r", -10], ["store", "a", "r"], ["unlock", "B"], ["unlock", "A"]],
      [["lock", "B"], ["lock", "A"], ["load", "r", "b"], ["add", "r", 10], ["store", "b", "r"], ["unlock", "A"], ["unlock", "B"]],
    ], expect: () => true, goal: "both threads should finish",
  },
  ordered: {
    label: "two locks, same order", shared: { a: 100, b: 0 },
    threads: [
      [["lock", "A"], ["lock", "B"], ["load", "r", "a"], ["add", "r", -10], ["store", "a", "r"], ["unlock", "B"], ["unlock", "A"]],
      [["lock", "A"], ["lock", "B"], ["load", "r", "b"], ["add", "r", 10], ["store", "b", "r"], ["unlock", "B"], ["unlock", "A"]],
    ], expect: () => true, goal: "both threads should finish",
  },
};

export class Machine {
  constructor(prog) {
    this.prog = prog; this.shared = { ...prog.shared }; this.locks = {};
    this.threads = prog.threads.map((code, id) => ({ id, code, pc: 0, regs: {} }));
    this.trace = [];
  }
  done(t) { return t.pc >= t.code.length; }
  canRun(id) {
    const t = this.threads[id]; if (this.done(t)) return false;
    const [op, L] = t.code[t.pc];
    return !(op === "lock" && this.locks[L] != null && this.locks[L] !== id);
  }
  runnable() { return this.threads.filter(t => this.canRun(t.id)).map(t => t.id); }
  get finished() { return this.threads.every(t => this.done(t)); }
  get deadlocked() { return !this.finished && this.runnable().length === 0; }
  step(id) {
    if (!this.canRun(id)) return false;
    const t = this.threads[id], ins = t.code[t.pc], [op, x, y] = ins;
    if (op === "load") t.regs[x] = this.shared[y];
    else if (op === "add") t.regs[x] += y;
    else if (op === "store") this.shared[x] = t.regs[y];
    else if (op === "lock") this.locks[x] = id;
    else if (op === "unlock") this.locks[x] = null;
    this.trace.push({ id, ins, shared: { ...this.shared } });
    t.pc++; return true;
  }
}

/** Every possible interleaving, by brute force. Returns tallies of outcomes. */
export function explore(prog) {
  const outcomes = new Map(); let schedules = 0;
  (function go(m) {
    if (m.finished || m.deadlocked) {
      schedules++;
      const k = m.deadlocked ? "deadlock" : JSON.stringify(m.shared);
      outcomes.set(k, (outcomes.get(k) || 0) + 1); return;
    }
    for (const id of m.runnable()) {
      const c = new Machine(prog);
      for (const s of m.trace) c.step(s.id);
      c.step(id); go(c);
    }
  })(new Machine(prog));
  return { schedules, outcomes: [...outcomes].map(([k, n]) => ({ k, n })).sort((a, b) => b.n - a.n) };
}

export const fmt = ins => {
  const [op, x, y] = ins;
  return op === "load" ? `${x} = ${y}` : op === "add" ? `${x} = ${x} ${y < 0 ? "−" : "+"} ${Math.abs(y)}` : op === "store" ? `${x} = ${y}` : `${op}(${x})`;
};
