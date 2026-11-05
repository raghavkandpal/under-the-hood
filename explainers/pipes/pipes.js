// Unix pipelines as a discrete-time simulation: stages, bounded pipe buffers, backpressure, early exit. No DOM.
// Stage kinds: "source" (cat: produces the input), "filter" (keeps a fraction of lines, like grep),
// "map" (one line out per line in, like cut or sed), "sort" (must read everything before writing anything),
// "head" (stops after n lines), "count" (wc -l: reads everything, prints one line at the end).

/**
 * stages: [{ kind, rate (lines it can handle per tick), keep?, n? }]
 * opts: { input (lines in the file), buffer (pipe capacity in lines), maxTicks }
 * Returns per-tick history plus totals.
 */
export function simulate(stages, { input = 10000, buffer = 64, maxTicks = 20000 } = {}) {
  const S = stages.map(s => ({ ...s, inDone: false, alive: true, done: false, handled: 0, out: 0, held: 0, carry: 0 }));
  const pipes = new Array(S.length - 1).fill(0); // lines waiting between stage i and i+1
  let remaining = input; const hist = [];
  const space = i => (i >= pipes.length ? Infinity : buffer - pipes[i]);
  let t = 0;
  for (; t < maxTicks; t++) {
    // run downstream first so space frees up this tick (like processes running concurrently)
    for (let i = S.length - 1; i >= 0; i--) {
      const s = S[i]; if (!s.alive || s.done) continue;
      const downstreamDead = i < S.length - 1 && !S[i + 1].alive;
      if (downstreamDead) { s.alive = false; s.sigpipe = true; continue; } // writing to a closed pipe kills the writer (SIGPIPE)
      const avail = i === 0 ? remaining : pipes[i - 1], upstreamFinished = i === 0 || S[i - 1].done || !S[i - 1].alive;
      if (s.kind === "sort" || s.kind === "count") {
        const take = Math.min(s.rate, avail); s.handled += take; s.held += s.kind === "sort" ? take : 0; if (s.kind === "count") s.counted = (s.counted || 0) + take;
        if (i === 0) remaining -= take; else pipes[i - 1] -= take;
        if (upstreamFinished && (i === 0 ? remaining : pipes[i - 1]) === 0) {
          if (s.kind === "count") { if (space(i) >= 1) { if (i < pipes.length) pipes[i] += 1; s.out += 1; s.done = true; } }
          else { const w = Math.min(s.rate, s.held, space(i)); s.held -= w; s.out += w; if (i < pipes.length) pipes[i] += w; if (s.held === 0) s.done = true; }
        }
        continue;
      }
      const ratio = s.kind === "filter" ? s.keep : 1;
      // can't take more input than the output pipe has room for (backpressure)
      let take = Math.min(s.rate, avail);
      if (s.kind === "head") take = Math.min(take, s.n - s.out);
      else if (ratio > 0) take = Math.min(take, Math.floor(space(i) / ratio + 1e-9));
      take = Math.max(0, take);
      s.handled += take; if (i === 0) remaining -= take; else pipes[i - 1] -= take;
      const produced = s.carry + take * ratio, whole = Math.floor(produced + 1e-9); s.carry = produced - whole;
      const w = Math.min(whole, space(i)); s.out += w; if (i < pipes.length) pipes[i] += w;
      if (s.kind === "head" && s.out >= s.n) { s.done = true; s.alive = false; s.exited = true; } // head exits, closing its input pipe
      else if (upstreamFinished && (i === 0 ? remaining : pipes[i - 1]) === 0) s.done = true;
    }
    hist.push({ pipes: [...pipes], held: S.map(s => s.held), alive: S.map(s => s.alive), done: S.map(s => s.done), out: S.at(-1).out, read: input - remaining });
    if (S.every(s => s.done || !s.alive)) { t++; break; }
  }
  const memory = hist.map(h => h.pipes.reduce((a, b) => a + b, 0) + h.held.reduce((a, b) => a + b, 0));
  return { ticks: t, hist, stages: S, read: input - remaining, output: S.at(-1).out, peakMemory: Math.max(0, ...memory), finished: S.every(s => s.done || !s.alive) };
}

/** Ready-made pipelines (rates in lines per tick). */
export const PIPELINES = {
  head: { cmd: "cat big.log | grep ERROR | head -n 10", stages: [{ kind: "source", name: "cat", rate: 40 }, { kind: "filter", name: "grep ERROR", rate: 30, keep: 0.05 }, { kind: "head", name: "head -n 10", rate: 100, n: 10 }] },
  count: { cmd: "cat big.log | grep ERROR | wc -l", stages: [{ kind: "source", name: "cat", rate: 40 }, { kind: "filter", name: "grep ERROR", rate: 30, keep: 0.05 }, { kind: "count", name: "wc -l", rate: 100 }] },
  slow: { cmd: "cat big.log | sed 's/…/…/' | grep ERROR", stages: [{ kind: "source", name: "cat", rate: 40 }, { kind: "map", name: "sed (slow)", rate: 8 }, { kind: "filter", name: "grep ERROR", rate: 30, keep: 0.05 }] },
  sort: { cmd: "cat big.log | cut -f3 | sort | uniq -c", stages: [{ kind: "source", name: "cat", rate: 40 }, { kind: "map", name: "cut -f3", rate: 35 }, { kind: "sort", name: "sort", rate: 50 }, { kind: "filter", name: "uniq -c", rate: 50, keep: 0.02 }] },
};
