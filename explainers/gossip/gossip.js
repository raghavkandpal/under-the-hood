// Gossip (epidemic) protocols: each round every node contacts a few random peers. No DOM.
// mode: "push" (informed nodes tell others), "pull" (everyone asks someone), "pushpull" (both).

/** Run until everyone knows or `maxRounds`. Returns per-round informed counts, when each node learned, and messages sent. */
export function spread({ n = 400, fanout = 1, mode = "push", loss = 0, dead = 0, maxRounds = 60, rnd = Math.random } = {}) {
  const alive = Array.from({ length: n }, (_, i) => i === 0 || rnd() >= dead), know = new Array(n).fill(false), when = new Array(n).fill(-1);
  know[0] = true; when[0] = 0;
  const peer = i => { let j; do j = Math.floor(rnd() * n); while (j === i && n > 1); return j; };
  const curve = [1]; let messages = 0, round = 0;
  const target = alive.filter(Boolean).length;
  while (curve.at(-1) < target && round < maxRounds) {
    round++; const learned = [];
    for (let i = 0; i < n; i++) {
      if (!alive[i]) continue;
      for (let f = 0; f < fanout; f++) {
        const j = peer(i); messages++;
        if (rnd() < loss || !alive[j]) continue; // lost message or crashed peer
        if ((mode === "push" || mode === "pushpull") && know[i] && !know[j]) learned.push(j);
        if ((mode === "pull" || mode === "pushpull") && !know[i] && know[j]) learned.push(i);
      }
    }
    for (const j of learned) if (!know[j]) { know[j] = true; when[j] = round; }
    curve.push(know.filter((k, i) => k && alive[i]).length);
  }
  return { curve, when, alive, rounds: round, messages, done: curve.at(-1) >= target, target };
}

/** Average rounds to reach everyone over several runs. */
export function avgRounds(opts, runs, rnd) { let s = 0; for (let r = 0; r < runs; r++) s += spread({ ...opts, rnd }).rounds; return s / runs; }
