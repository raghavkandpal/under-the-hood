// How debuggers work: a toy byte-coded VM plus a ptrace-style debugger, with no DOM.
// Registers: i (counter) and s (sum). Opcodes (1 to 3 bytes):
//   00 HALT   10 n SETI i=n   11 ADDS s+=i   12 n ADDI s+=n   13 INC i++   14 OUT print s   20 n a JLT if i<n goto a   CC TRAP
export const TRAP = 0xcc;
// Loop of 10 iterations, i = 1..10: s += 3 + i, print s.
export const PROGRAM = [0x10, 1, 0x12, 3, 0x11, 0x14, 0x13, 0x20, 11, 2, 0x00];
export const LOOP_START = 2;

const SIZE = { 0x00: 1, 0x10: 2, 0x11: 1, 0x12: 2, 0x13: 1, 0x14: 1, 0x20: 3, [TRAP]: 1 };
const NAME = { 0x00: "HALT", 0x10: "SETI", 0x11: "ADDS", 0x12: "ADDI", 0x13: "INC", 0x14: "OUT", 0x20: "JLT" };

export const newCpu = (mem = PROGRAM) => ({ mem: [...mem], pc: 0, i: 0, s: 0, out: [], status: "running" });

/** Execute one instruction. A TRAP leaves pc one past the 0xCC byte. Unknown opcodes fault. */
export function step(c) {
  const m = c.mem, op = m[c.pc++];
  switch (op) {
    case 0x00: c.status = "halted"; break;
    case TRAP: c.status = "trap"; break;
    case 0x10: c.i = m[c.pc++]; break;
    case 0x11: c.s += c.i; break;
    case 0x12: c.s += m[c.pc++]; break;
    case 0x13: c.i++; break;
    case 0x14: c.out.push(c.s); break;
    case 0x20: { const n = m[c.pc++], a = m[c.pc++]; if (c.i < n) c.pc = a; break; }
    default: c.status = "fault"; c.pc--;
  }
  if (c.pc >= m.length && c.status === "running") c.status = "fault";
  return c.status;
}

/** Run to the end with no debugger. */
export function run(mem = PROGRAM, limit = 10000) {
  const c = newCpu(mem);
  for (let n = 0; c.status === "running" && n < limit; n++) step(c);
  return c;
}

/** Instruction listing: [{ addr, bytes, text }]. */
export function disassemble(mem = PROGRAM) {
  const rows = [];
  for (let a = 0; a < mem.length; a += SIZE[mem[a]] ?? 1) {
    const bytes = mem.slice(a, a + (SIZE[mem[a]] ?? 1));
    rows.push({ addr: a, bytes, text: [NAME[mem[a]] ?? "???", ...bytes.slice(1)].join(" ") });
  }
  return rows;
}

/** Save the byte at addr and write 0xCC over it. Returns the saved byte. */
export function setBreakpoint(mem, addr) { const b = mem[addr]; mem[addr] = TRAP; return b; }
/** Put the saved byte back. */
export function clearBreakpoint(mem, addr, saved) { mem[addr] = saved; }

/**
 * Run under a debugger. Options: breakpoints (addresses), rewind (pc back to the breakpoint after a trap),
 * reinsert (rewrite 0xCC after single-stepping the real instruction), cond (cpu => bool, stop only when true).
 * A trap costs two switches: into the debugger, and back to the program.
 */
export function debug(mem = PROGRAM, { breakpoints = [], rewind = true, reinsert = true, cond = null, limit = 10000 } = {}) {
  const c = newCpu(mem), saved = {};
  for (const a of breakpoints) saved[a] = setBreakpoint(c.mem, a);
  const stops = []; let traps = 0, switches = 0;
  for (let n = 0; n < limit && c.status === "running"; n++) {
    if (step(c) !== "trap") continue;
    const a = c.pc - 1;
    if (!(a in saved)) break; // a TRAP the program itself contains
    traps++; switches += 2;
    if (rewind) c.pc = a;
    if (!cond || cond(c)) stops.push({ addr: rewind ? a : c.pc, i: c.i, s: c.s });
    clearBreakpoint(c.mem, a, saved[a]);
    c.status = "running";
    if (rewind) { step(c); if (c.status === "running" && reinsert) setBreakpoint(c.mem, a); }
  }
  return { out: c.out, status: c.status, stops, traps, switches, pc: c.pc };
}
