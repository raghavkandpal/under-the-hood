// Unix processes: fork copies a process, exec replaces its program, exit leaves a zombie until the parent waits. No DOM.
// The table maps pid → { pid, ppid, program, state: "running" | "zombie", code }.

export function boot() {
  return { next: 3, procs: { 1: { pid: 1, ppid: 0, program: "init", state: "running" }, 2: { pid: 2, ppid: 1, program: "sh", state: "running" } } };
}
const copy = sys => ({ next: sys.next, procs: Object.fromEntries(Object.entries(sys.procs).map(([k, p]) => [k, { ...p }])) });
export const children = (sys, pid) => Object.values(sys.procs).filter(p => p.ppid === pid);

/** fork: a new process running the same program. The parent gets the child's pid back; the child gets 0. */
export function fork(sys, pid) {
  const s = copy(sys), child = s.next++, p = s.procs[pid];
  s.procs[child] = { pid: child, ppid: pid, program: p.program, state: "running" };
  return { sys: s, result: child };
}
/** exec: same pid, same parent, new program. */
export function exec(sys, pid, program) { const s = copy(sys); s.procs[pid].program = program; return { sys: s, result: 0 }; }

/** exit: the process becomes a zombie holding its exit code. Its children are adopted by init, which reaps zombies at once. */
export function exit(sys, pid, code = 0) {
  if (pid === 1) return { sys, error: "init can't exit" };
  let s = copy(sys); s.procs[pid].state = "zombie"; s.procs[pid].code = code;
  for (const c of children(s, pid)) s.procs[c.pid].ppid = 1;
  s = reapByInit(s);
  return { sys: s, result: code };
}
const reapByInit = s => { for (const c of children(s, 1)) if (c.state === "zombie") delete s.procs[c.pid]; return s; };

/** wait: reap one zombie child and return its exit code. With live children but no zombies, the caller would block. */
export function wait(sys, pid) {
  const kids = children(sys, pid), z = kids.find(c => c.state === "zombie");
  if (!kids.length) return { sys, error: "no children (ECHILD)" };
  if (!z) return { sys, error: "blocks until a child exits" };
  const s = copy(sys); delete s.procs[z.pid];
  return { sys: s, result: { pid: z.pid, code: z.code } };
}

/** How a shell runs a command: fork, exec in the child, the child exits, the shell waits. */
export function runCommand(sys, shell, program, code = 0) {
  const steps = [], f = fork(sys, shell); steps.push({ call: `fork() → ${f.result}`, sys: f.sys });
  const e = exec(f.sys, f.result, program); steps.push({ call: `exec("${program}") in ${f.result}`, sys: e.sys });
  const x = exit(e.sys, f.result, code); steps.push({ call: `${program} exits with ${code}`, sys: x.sys });
  const w = wait(x.sys, shell); steps.push({ call: `wait() → pid ${w.result.pid}, status ${w.result.code}`, sys: w.sys });
  return steps;
}
