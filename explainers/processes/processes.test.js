import { test } from "node:test";
import assert from "node:assert/strict";
import { boot, fork, exec, exit, wait, runCommand, children } from "./processes.js";

test("fork makes a child running the same program; exec keeps the pid", () => {
  const f = fork(boot(), 2), c = f.sys.procs[f.result];
  assert.deepEqual([c.ppid, c.program], [2, "sh"]);
  const e = exec(f.sys, f.result, "ls"); assert.equal(e.sys.procs[f.result].program, "ls"); assert.equal(e.sys.procs[f.result].pid, f.result);
});

test("an exited child stays a zombie until its parent waits", () => {
  const f = fork(boot(), 2), x = exit(f.sys, f.result, 3);
  assert.equal(x.sys.procs[f.result].state, "zombie");
  const w = wait(x.sys, 2); assert.deepEqual(w.result, { pid: f.result, code: 3 }); assert.equal(w.sys.procs[f.result], undefined);
  assert.match(wait(w.sys, 2).error, /ECHILD/);
  assert.match(wait(fork(boot(), 2).sys, 2).error, /blocks/);
});

test("orphans are adopted by init, which reaps them", () => {
  let s = fork(boot(), 2), child = s.result; s = fork(s.sys, child); const grandchild = s.result;
  s = exit(s.sys, child); assert.equal(s.sys.procs[grandchild].ppid, 1, "adopted");
  assert.equal(s.sys.procs[child].state, "zombie", "still waits for sh");
  s = exit(s.sys, grandchild); assert.equal(s.sys.procs[grandchild], undefined, "init reaped it");
});

test("a shell runs a command in four steps and ends where it started", () => {
  const steps = runCommand(boot(), 2, "ls");
  assert.equal(steps.length, 4); assert.deepEqual(Object.keys(steps.at(-1).sys.procs), ["1", "2"]); assert.equal(children(steps[1].sys, 2)[0].program, "ls");
});
