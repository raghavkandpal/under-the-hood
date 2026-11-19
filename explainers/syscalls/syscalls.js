// System calls and interrupts: a toy single-CPU machine with a mode bit, a trap table, a syscall table,
// a timer and one disk. DOM-free. One instruction takes 1 ms; the kernel's own work takes 0 ms (the model's choice).

export const SYS = { exit: 0, write: 1, clock_gettime: 2, getpid: 3, read: 4, read_start: 5 };
export const TRAP_TABLE = { syscall: 0x1000, timer: 0x1100, disk: 0x1200, fault: 0x1300 };
export const BUF = 4096;

export function boot(progs, { timer = 0, disk = 5, vdso = false } = {}) {
  return {
    now: 0, mode: "user", trapTable: { ...TRAP_TABLE }, timer, diskMs: disk, vdso,
    procs: progs.map(prog => ({ prog, pc: 0, regs: [0, 0, 0, 0], state: "ready", ran: 0, seen: [], buf: 0 })),
    cur: progs.length ? 0 : -1, entries: [], modes: ["user"], owner: [], written: [],
    pending: { timer: false, disk: false }, disk: { doneAt: -1, irq: false },
  };
}

// Round robin: the next ready process after the current one (the current one last), or -1 for idle.
function next(m) {
  const n = m.procs.length;
  for (let i = 1; i <= n; i++) { const k = (((m.cur + i) % n) + n) % n; if (m.procs[k].state === "ready") return k; }
  return -1;
}

const SYSCALLS = {
  [SYS.exit]: (m, p) => { p.state = "done"; m.cur = next(m); },
  [SYS.write]: (m, p, n) => { m.written.push(n); },
  [SYS.clock_gettime]: (m, p) => { p.regs[0] = m.now; },
  [SYS.getpid]: (m, p) => { p.regs[0] = m.cur + 1; },
  [SYS.read]: (m, p) => { m.disk = { doneAt: m.now + m.diskMs, irq: true }; p.state = "blocked"; m.cur = next(m); },
  [SYS.read_start]: (m) => { m.disk = { doneAt: m.now + m.diskMs, irq: false }; },
};
const HANDLERS = {
  syscall: (m, p) => (SYSCALLS[p.regs[0]] ?? (() => { p.regs[0] = -1; }))(m, p, p.regs[1]),
  fault: (m, p) => { p.state = "faulted"; m.cur = next(m); },
  timer: (m) => { m.cur = next(m); },
  disk: (m) => { m.procs.forEach(q => { if (q.state === "blocked") q.state = "ready"; }); if (m.cur < 0) m.cur = next(m); },
};

// The only way into the kernel: control goes to the trap table's entry for this kind of event, never to an address the program chose.
function enter(m, kind, extra = {}) {
  const p = m.procs[m.cur];
  m.entries.push({ kind, entryPc: m.trapTable[kind], from: m.mode, t: m.now, num: kind === "syscall" ? p.regs[0] : undefined, returnPc: p?.pc, ...extra });
  m.mode = "kernel"; m.modes.push("kernel");
  HANDLERS[kind](m, p);
  m.mode = "user"; m.modes.push("user");
}
function sys(m, p, num, arg, trapPc) { p.regs[0] = num; p.regs[1] = arg; enter(m, "syscall", { trapPc }); }

function tick(m, who) {
  m.owner.push(who); m.now++;
  if (m.timer && m.now % m.timer === 0) m.pending.timer = true;
  if (m.disk.irq && m.now >= m.disk.doneAt) { m.pending.disk = true; m.disk.irq = false; }
}
function deliver(m) {
  for (const k of ["timer", "disk"]) if (m.pending[k] && m.mode === "user") { m.pending[k] = false; enter(m, k); }
}

/** Run one instruction of the current process (or one idle ms), then take any interrupt that is due. */
export function step(m) {
  const p = m.procs[m.cur];
  if (!p) { tick(m, "-"); return deliver(m); }
  const trapPc = p.pc, ins = p.prog[p.pc++] ?? { op: "exit" }, r = p.regs;
  tick(m, m.cur); p.ran++;
  switch (ins.op) {
    case "mov": r[ins.r] = ins.v; break;
    case "add": r[ins.r] += ins.v; break;
    case "jnz": if (r[ins.r] !== 0) p.pc = ins.to; break;
    case "jmp": p.pc = ins.to; break;
    case "rec": p.seen.push(r[0]); break;
    case "spin": if (m.disk.doneAt > m.now) p.pc = trapPc; break; // polling a status flag from user mode
    case "syscall": enter(m, "syscall", { trapPc }); break;
    case "exit": sys(m, p, SYS.exit, 0, trapPc); break;
    case "lidt": // privileged: point the syscall entry of the trap table at r1
      if (m.mode === "user") enter(m, "fault", { trapPc }); else m.trapTable.syscall = r[1];
      break;
    case "bwrite": // stdio in user space: copy into a buffer, trap only when it is full
      p.buf += ins.n;
      while (p.buf >= BUF) { p.buf -= BUF; sys(m, p, SYS.write, BUF, trapPc); }
      break;
    case "flush": if (p.buf) { const n = p.buf; p.buf = 0; sys(m, p, SYS.write, n, trapPc); } break;
    case "gettime": if (m.vdso) r[0] = m.now; else sys(m, p, SYS.clock_gettime, 0, trapPc); break; // vDSO: read the clock without a trap
    default: throw new Error(`unknown op ${ins.op}`);
  }
  deliver(m);
}

/** Step until `limit` ms have passed or nothing can run any more. */
export function run(m, limit = Infinity) {
  while (m.now < limit && m.procs.some(p => p.state === "ready" || p.state === "blocked")) step(m);
  return m;
}

// ---- Scenarios, one per fact the page claims ----

const mov = (r, v) => ({ op: "mov", r, v });
const loop = [{ op: "jmp", to: 0 }];

/** Fact 1: `lidt` in user or kernel mode. */
export function privileged(mode) {
  const m = boot([[mov(1, 0x2000), { op: "lidt" }, { op: "exit" }]]);
  m.mode = mode;
  return run(m, 2);
}
/** Fact 2: a syscall while r2 holds whatever address the program likes. */
export function trap(r2) {
  return run(boot([[mov(2, r2), mov(0, SYS.getpid), { op: "syscall" }, { op: "rec" }, mov(3, 7), { op: "exit" }]]));
}
/** Fact 3: n bytes, one per write() or through a 4,096-byte buffer. */
export function writes(n, buffered) {
  const body = buffered ? [{ op: "bwrite", n: 1 }] : [mov(0, SYS.write), mov(1, 1), { op: "syscall" }];
  return run(boot([[mov(3, n), ...body, { op: "add", r: 3, v: -1 }, { op: "jnz", r: 3, to: 1 }, ...(buffered ? [{ op: "flush" }] : [])]]));
}
/** Fact 4: n clock_gettime calls, through the kernel or the vDSO. */
export function clock(n, vdso) {
  return run(boot([[mov(3, n), { op: "gettime" }, { op: "rec" }, { op: "add", r: 3, v: -1 }, { op: "jnz", r: 3, to: 1 }]], { vdso }));
}
/** Fact 5: two loops that never make a syscall, for `ms` ms. */
export function loops(timer, ms = 100) {
  return run(boot([loop, loop], { timer }), ms);
}
/** Fact 6: A reads the disk (5 ms) while B loops; runs to the moment the disk answers. */
export function disk(poll, { ms = 5, timer = 10 } = {}) {
  const a = poll ? [mov(0, SYS.read_start), { op: "syscall" }, { op: "spin" }] : [mov(0, SYS.read), { op: "syscall" }];
  const m = boot([a, loop], { timer, disk: ms });
  return run(m, 2 + ms);
}

/** Entries into the kernel, by kind or by syscall number. */
export const count = (m, kind, num) => m.entries.filter(e => e.kind === kind && (num === undefined || e.num === num)).length;
