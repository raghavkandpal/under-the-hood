// A JavaScript-style event loop, step by step: call stack, timers, task queue, microtask queue. No DOM.
// Programs are small trees of statements instead of real JS:
//   { log: "A" }                      console.log("A")
//   { timeout: ms, body: [...] }      setTimeout(() => {...}, ms)
//   { then: [...] }                   Promise.resolve().then(() => {...})
//   { busy: ms }                      a blocking loop that takes ms of CPU time
//   { call: "name", body: [...] }     calling a synchronous function

/** Run a program; returns a list of snapshots, one per step, and the console output. */
export function run(program) {
  const steps = [], out = [], timers = [], tasks = [], micro = []; let now = 0, seq = 0;
  const snap = (note, stack) => (fireTimers(), steps.push({ note, now, stack: [...stack], timers: timers.map(t => `${t.label} @${t.due}ms`), tasks: tasks.map(t => t.label), micro: micro.map(m => m.label), out: [...out] }));
  const exec = (body, stack) => {
    for (const s of body) {
      if (s.log != null) { out.push(String(s.log)); snap(`console.log("${s.log}")`, [...stack, `log("${s.log}")`]); }
      else if (s.timeout != null) { const label = s.label || `timer ${++seq}`; timers.push({ due: now + s.timeout, order: seq, body: s.body || [], label }); snap(`setTimeout(…, ${s.timeout}): the browser starts a ${s.timeout} ms timer`, [...stack, "setTimeout"]); }
      else if (s.then) { const label = s.label || `then ${++seq}`; micro.push({ body: s.then, label }); snap(`.then(…): callback queued as a microtask`, [...stack, "Promise.then"]); }
      else if (s.busy != null) { now += s.busy; snap(`busy loop: the thread is blocked for ${s.busy} ms`, [...stack, `busy ${s.busy}ms`]); }
      else if (s.call) { const st = [...stack, s.call + "()"]; snap(`call ${s.call}()`, st); exec(s.body || [], st); snap(`${s.call}() returns`, stack); }
    }
  };
  const fireTimers = () => { timers.sort((a, b) => a.due - b.due || a.order - b.order); while (timers.length && timers[0].due <= now) tasks.push(timers.shift()); };
  // the script itself is the first task
  exec(program, ["main script"]); snap("script finished: the call stack is empty", []);
  for (let guard = 0; guard < 500; guard++) {
    if (micro.length) { const m = micro.shift(); snap(`run microtask: ${m.label}`, [m.label]); exec(m.body, [m.label]); snap(`${m.label} done`, []); continue; }
    fireTimers();
    if (tasks.length) { const t = tasks.shift(); snap(`run task: ${t.label} (fired at ${now} ms)`, [t.label]); exec(t.body, [t.label]); snap(`${t.label} done, now drain microtasks`, []); fireTimers(); continue; }
    if (timers.length) { const next = Math.min(...timers.map(t => t.due)); now = Math.max(now, next); fireTimers(); snap(`idle until ${now} ms: timer fires and its callback joins the task queue`, []); continue; }
    break;
  }
  snap("nothing left to do", []);
  return { steps, out };
}

/** Preset programs (with the JS they stand for). */
export const PRESETS = {
  classic: {
    name: "The classic puzzle",
    js: `console.log("1");\nsetTimeout(() => console.log("2"), 0);\nPromise.resolve().then(() => console.log("3"));\nconsole.log("4");`,
    prog: [{ log: "1" }, { timeout: 0, label: "timeout", body: [{ log: "2" }] }, { then: [{ log: "3" }], label: "then" }, { log: "4" }],
  },
  chain: {
    name: "Microtasks queue microtasks",
    js: `setTimeout(() => console.log("timeout"), 0);\nPromise.resolve()\n  .then(() => { console.log("a");\n    Promise.resolve().then(() => console.log("c")); })\n  .then(() => console.log("b"));`,
    prog: [{ timeout: 0, label: "timeout", body: [{ log: "timeout" }] }, { then: [{ log: "a" }, { then: [{ log: "c" }], label: "then c" }, { then: [{ log: "b" }], label: "then b" }], label: "then a" }],
  },
  blocking: {
    name: "A timer can't interrupt busy code",
    js: `setTimeout(() => console.log("tick"), 10);\nconst t = Date.now();\nwhile (Date.now() - t < 200) {} // block 200 ms\nconsole.log("done");`,
    prog: [{ timeout: 10, label: "tick", body: [{ log: "tick" }] }, { busy: 200 }, { log: "done" }],
  },
  order: {
    name: "Timers in order of due time",
    js: `setTimeout(() => console.log("slow"), 100);\nsetTimeout(() => console.log("fast"), 10);\nfunction work() { console.log("sync"); }\nwork();`,
    prog: [{ timeout: 100, label: "slow", body: [{ log: "slow" }] }, { timeout: 10, label: "fast", body: [{ log: "fast" }] }, { call: "work", body: [{ log: "sync" }] }],
  },
};
