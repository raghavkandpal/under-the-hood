import { test } from "node:test";
import assert from "node:assert/strict";
import { PROGRAM, LOOP_START, TRAP, run, debug, disassemble, setBreakpoint, clearBreakpoint, newCpu, step } from "./debuggers.js";

// Hand-worked: iteration k (0..9) has i = k + 1 and adds 3 + i to s, then prints s.
const expected = Array.from({ length: 10 }, (_, k) => 3 * (k + 1) + ((k + 1) * (k + 2)) / 2);
// Independent reference: how often does a plain run reach each address?
function visits(a) {
  const c = newCpu(); let n = 0;
  while (c.status === "running") { if (c.pc === a) n++; step(c); }
  return n;
}
const addrs = disassemble().map(r => r.addr);

test("the program has 1-, 2- and 3-byte instructions and prints the hand-worked sums", () => {
  assert.deepEqual(new Set(disassemble().map(r => r.bytes.length)), new Set([1, 2, 3]));
  assert.deepEqual(run().out, expected);
  assert.equal(expected[9], 85);
});

test("a breakpoint saves the byte and writes 0xCC; clearing restores the code exactly", () => {
  for (const a of addrs) {
    const mem = [...PROGRAM], saved = setBreakpoint(mem, a);
    assert.equal(saved, PROGRAM[a]);
    assert.equal(mem[a], TRAP);
    assert.deepEqual(mem.filter((b, k) => k !== a), PROGRAM.filter((b, k) => k !== a));
    clearBreakpoint(mem, a, saved);
    assert.deepEqual(mem, PROGRAM);
  }
});

test("a trap stops with pc = A + 1 and the debugger reports A", () => {
  const mem = [...PROGRAM]; setBreakpoint(mem, LOOP_START);
  const c = newCpu(mem);
  while (step(c) === "running");
  assert.equal(c.status, "trap");
  assert.equal(c.pc, LOOP_START + 1);
  assert.equal(debug(PROGRAM, { breakpoints: [LOOP_START] }).stops[0].addr, LOOP_START);
});

test("skipping the rewind resumes mid-instruction: the output differs at every address", () => {
  for (const a of addrs) {
    const r = debug(PROGRAM, { breakpoints: [a], rewind: false });
    assert.notDeepEqual([r.out, r.status], [expected, "halted"], `address ${a}`);
  }
  // At 2 the operand 3 is run as an opcode, which does not exist.
  assert.equal(debug(PROGRAM, { breakpoints: [2], rewind: false }).status, "fault");
});

test("restore, single-step, rewrite, resume: a breakpoint stops once per visit and leaves the output alone", () => {
  for (const a of addrs) {
    const r = debug(PROGRAM, { breakpoints: [a] });
    assert.equal(r.stops.length, visits(a), `address ${a}`);
    assert.deepEqual(r.out, expected);
    assert.equal(r.status, "halted");
  }
  const r = debug(PROGRAM, { breakpoints: [LOOP_START] });
  assert.equal(r.stops.length, 10);
  assert.deepEqual(r.stops.map(s => s.i), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test("without the rewrite the breakpoint stops once, but the output is still right", () => {
  const r = debug(PROGRAM, { breakpoints: [LOOP_START], reinsert: false });
  assert.equal(r.stops.length, 1);
  assert.deepEqual(r.out, expected);
});

test("conditional breakpoint i == 7: 10 traps, 1 stop shown, 20 switches", () => {
  const r = debug(PROGRAM, { breakpoints: [LOOP_START], cond: c => c.i === 7 });
  assert.equal(r.traps, 10);
  assert.equal(r.stops.length, 1);
  assert.equal(r.stops[0].i, 7);
  assert.equal(r.switches, 20);
  assert.deepEqual(r.out, expected);
  // An unconditional breakpoint costs the same switches.
  assert.equal(debug(PROGRAM, { breakpoints: [LOOP_START] }).switches, 20);
});

test("the debugger does not touch the caller's program", () => {
  debug(PROGRAM, { breakpoints: [2, 4] });
  assert.equal(PROGRAM.includes(TRAP), false);
});
