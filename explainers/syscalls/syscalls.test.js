import { test } from "node:test";
import assert from "node:assert/strict";
import { boot, run, SYS, TRAP_TABLE, BUF, privileged, trap, writes, clock, loops, disk, count } from "./syscalls.js";

test("fact 1: a privileged instruction faults in user mode and runs in kernel mode", () => {
  const u = privileged("user"), k = privileged("kernel");
  assert.equal(u.procs[0].state, "faulted");
  assert.equal(count(u, "fault"), 1);
  assert.equal(u.trapTable.syscall, TRAP_TABLE.syscall);
  assert.notEqual(k.procs[0].state, "faulted");
  assert.equal(count(k, "fault"), 0);
  assert.equal(k.trapTable.syscall, 0x2000);
});

test("fact 2: a syscall goes user, kernel, user, through the table entry, and returns after the trap", () => {
  for (const r2 of [0, 0x1300, 0xdead]) {
    const m = trap(r2), e = m.entries[0];
    assert.deepEqual(m.modes.slice(0, 3), ["user", "kernel", "user"]);
    assert.equal(e.kind, "syscall");
    assert.equal(e.entryPc, TRAP_TABLE.syscall);
    assert.equal(e.returnPc, e.trapPc + 1);
    assert.equal(e.trapPc, 2);
    assert.equal(m.procs[0].regs[2], r2); // the program's register is untouched and was ignored
    assert.equal(m.procs[0].regs[3], 7); // execution carried on after the trap
  }
  assert.deepEqual(trap(0xdead).procs[0].seen, [1]); // getpid result came back in r0
});

test("fact 2: an unknown syscall number returns -1 and runs nothing", () => {
  const m = run(boot([[{ op: "mov", r: 0, v: 99 }, { op: "syscall" }, { op: "rec" }, { op: "exit" }]]));
  assert.deepEqual(m.procs[0].seen, [-1]);
});

test("fact 3: 10,000 one-byte writes make 10,000 syscalls; the 4,096-byte buffer makes 3", () => {
  const a = writes(10000, false), b = writes(10000, true);
  assert.equal(count(a, "syscall", SYS.write), 10000);
  assert.equal(count(b, "syscall", SYS.write), 3);
  assert.deepEqual(b.written, [4096, 4096, 1808]);
  assert.equal(BUF, 4096);
  assert.equal(10000 - 2 * 4096, 1808);
  const total = w => w.written.reduce((s, x) => s + x, 0);
  assert.equal(total(a), 10000);
  assert.equal(total(b), 10000);
});

test("fact 4: 1,000 clock_gettime calls enter the kernel 1,000 times without the vDSO and 0 times with it, and return the same times", () => {
  const a = clock(1000, false), b = clock(1000, true);
  assert.equal(count(a, "syscall", SYS.clock_gettime), 1000);
  assert.equal(count(b, "syscall", SYS.clock_gettime), 0);
  assert.equal(a.procs[0].seen.length, 1000);
  assert.deepEqual(a.procs[0].seen, b.procs[0].seen);
});

test("fact 5: with a 10 ms timer the kernel regains control 10 times in 100 ms and each loop runs 50 ms; with none the first runs 100 ms", () => {
  const t = loops(10), n = loops(0);
  assert.equal(t.now, 100);
  assert.equal(count(t, "timer"), 10);
  assert.deepEqual(t.procs.map(p => p.ran), [50, 50]);
  assert.equal(count(n, "timer"), 0);
  assert.equal(count(n, "syscall"), 0);
  assert.deepEqual(n.procs.map(p => p.ran), [100, 0]);
  assert.equal(count(t, "syscall"), 0); // neither loop made a syscall
});

test("fact 6: while A waits 5 ms for the disk, B runs 5 ms with an interrupt and 0 ms with polling", () => {
  const irq = disk(false), poll = disk(true);
  assert.equal(irq.entries.find(e => e.num === SYS.read).t + 5, irq.now);
  assert.equal(irq.procs[1].ran, 5);
  assert.equal(irq.procs[0].state, "ready"); // the disk interrupt woke A
  assert.equal(count(irq, "disk"), 1);
  assert.equal(poll.procs[1].ran, 0);
  assert.equal(poll.procs[0].ran, 2 + 5); // A spent the whole wait spinning
  assert.equal(count(poll, "disk"), 0);
  assert.equal(count(poll, "timer"), 0); // the 10 ms slice is longer than the 5 ms wait
});

test("fact 6: a wait longer than the slice lets polling lose the CPU to the timer", () => {
  const poll = disk(true, { ms: 25 });
  assert.ok(poll.procs[1].ran > 0);
});
