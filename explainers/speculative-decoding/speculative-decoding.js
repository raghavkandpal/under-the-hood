// Speculative decoding: a cheap draft model guesses k tokens, the big model checks them all in one pass. No DOM.
// Models here are tiny bigram tables, so every probability can be shown. The accept/reject rule is the real one
// (Leviathan et al., Chen et al. 2023), and it leaves the output distribution exactly equal to the big model's.

export const VOCAB = ["the", "cat", "dog", "sat", "ran", "on", "under", "a", "mat", "rug", "and", "slept", "."];
const IDX = Object.fromEntries(VOCAB.map((w, i) => [w, i]));
// Target model: next-word weights after each word (unnormalised).
const T = {
  the: { cat: 5, dog: 4, mat: 2, rug: 2 }, a: { cat: 2, dog: 2, mat: 4, rug: 3 },
  cat: { sat: 6, ran: 2, slept: 2, and: 1 }, dog: { ran: 5, sat: 3, slept: 2, and: 1 },
  sat: { on: 6, under: 2, ".": 1 }, ran: { under: 3, on: 2, ".": 2, and: 1 },
  on: { the: 6, a: 3 }, under: { the: 5, a: 3 }, mat: { ".": 5, and: 3 }, rug: { ".": 4, and: 3 },
  and: { slept: 3, the: 3, ran: 2 }, slept: { ".": 4, on: 2, under: 1 }, ".": { the: 6, a: 3 },
};
const norm = w => { const v = VOCAB.map(t => w[t] || 0), s = v.reduce((a, b) => a + b, 0); return v.map(x => x / s); };

/** Big model's next-token distribution after `prev`. */
export const target = prev => norm(T[prev] || T["."]);
/** Draft model: a blurred copy of the target. quality 1 = identical, 0 = uniform guessing. */
export const draft = (prev, quality) => target(prev).map(p => quality * p + (1 - quality) / VOCAB.length);

const sample = (dist, rnd) => { let r = rnd(), i = 0; for (; i < dist.length - 1; i++) { r -= dist[i]; if (r < 0) return i; } return i; };
/** Probability that one drafted token is accepted: Σ min(p, q). */
export const acceptRate = (p, q) => p.reduce((s, pi, i) => s + Math.min(pi, q[i]), 0);

/**
 * One round: draft k tokens, verify them with one big-model pass.
 * Returns { proposed: [{tok, p, q, accepted}], fixed: {tok, from: "correction" | "bonus"}, out: [tokens appended] }.
 */
export function round(prev, k, quality, rnd) {
  const proposed = []; let ctx = prev;
  for (let i = 0; i < k; i++) { const q = draft(ctx, quality), t = sample(q, rnd); proposed.push({ tok: VOCAB[t], q: q[t], qd: q, ctx }); ctx = VOCAB[t]; }
  const out = [];
  for (const d of proposed) {
    const p = target(d.ctx), i = IDX[d.tok]; d.p = p[i];
    if (rnd() < Math.min(1, p[i] / d.q)) { d.accepted = true; out.push(d.tok); continue; }
    d.accepted = false;
    const resid = p.map((pj, j) => Math.max(0, pj - d.qd[j])), z = resid.reduce((a, b) => a + b, 0);
    const tok = VOCAB[sample(resid.map(r => r / z), rnd)]; out.push(tok);
    return { proposed, fixed: { tok, from: "correction" }, out };
  }
  const tok = VOCAB[sample(target(ctx), rnd)]; out.push(tok); // all accepted: the big pass also gave us the next token free
  return { proposed, fixed: { tok, from: "bonus" }, out };
}

/** Generate n tokens; returns tokens, rounds, and cost in units of one big-model pass (a draft pass costs `draftCost`). */
export function generate(n, { k = 4, quality = 0.8, draftCost = 0.05, rnd = Math.random, start = "." } = {}) {
  const toks = []; const rounds = []; let prev = start, cost = 0;
  while (toks.length < n) { const r = round(prev, k, quality, rnd); rounds.push(r); toks.push(...r.out); prev = toks.at(-1); cost += k * draftCost + 1; }
  return { toks: toks.slice(0, n), rounds, cost, plainCost: n, speedup: n / cost };
}

/** Expected tokens produced per round when each draft token is accepted with probability a. */
export const expectedPerRound = (a, k) => (a === 1 ? k + 1 : (1 - a ** (k + 1)) / (1 - a));
export const expectedSpeedup = (a, k, draftCost) => expectedPerRound(a, k) / (k * draftCost + 1);
