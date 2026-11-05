// CPU scheduling on one core: FCFS, SJF, SRTF and round robin, producing a Gantt chart. No DOM.
// jobs: [{name, arrive, burst}]

export const ALGOS = {
  fcfs: { label: "First come, first served", preemptive: false },
  sjf: { label: "Shortest job first", preemptive: false },
  srtf: { label: "Shortest remaining time (preemptive)", preemptive: true },
  rr: { label: "Round robin", preemptive: true },
};

export function schedule(jobs, algo, quantum = 2) {
  const J = jobs.map((j, i) => ({ ...j, i, left: j.burst, start: null, end: null }));
  const gantt = []; let t = 0, ready = [], done = 0, current = null, sliceLeft = 0, switches = 0;
  const arrive = () => { for (const j of J) if (j.arrive <= t && !j.queued) { j.queued = true; ready.push(j); } };
  const pick = () => {
    if (!ready.length) return null;
    if (algo === "fcfs" || algo === "rr") return ready.shift();
    const k = ready.reduce((b, j, idx) => (j.left < ready[b].left || (j.left === ready[b].left && j.arrive < ready[b].arrive) ? idx : b), 0);
    return ready.splice(k, 1)[0];
  };
  arrive();
  while (done < J.length) {
    if (!current) { current = pick(); sliceLeft = quantum; if (current) { if (current.start == null) current.start = t; switches++; } }
    if (!current) { const nxt = Math.min(...J.filter(j => !j.queued).map(j => j.arrive)); gantt.push({ name: null, from: t, to: nxt }); t = nxt; arrive(); continue; }
    // run one time unit
    const last = gantt.at(-1);
    if (last && last.name === current.name && last.to === t) last.to = t + 1; else gantt.push({ name: current.name, i: current.i, from: t, to: t + 1 });
    t++; current.left--; sliceLeft--; arrive();
    if (!current.left) { current.end = t; done++; current = null; continue; }
    if (algo === "rr" && sliceLeft === 0) { ready.push(current); current = null; continue; }
    if (algo === "srtf" && ready.some(j => j.left < current.left)) { ready.push(current); current = null; }
  }
  const per = J.map(j => ({ name: j.name, turnaround: j.end - j.arrive, waiting: j.end - j.arrive - j.burst, response: j.start - j.arrive }));
  const avg = k => per.reduce((s, p) => s + p[k], 0) / per.length;
  return { gantt, per, avgWait: avg("waiting"), avgTurn: avg("turnaround"), avgResp: avg("response"), switches, end: t };
}
