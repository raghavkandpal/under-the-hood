// Deadlock: dining philosophers who are always hungry. A random scheduler picks one philosopher who can act. No DOM.

/**
 * Philosopher i needs forks i and (i + 1) % n.
 * naive: left, then right. ordered: lower-numbered fork first (a global lock order). waiter: naive, but at most n − 1 may hold forks at once.
 */
export const STRATEGIES = ["naive", "ordered", "waiter"];
const forksOf = (i, n, strategy) => { const l = i, r = (i + 1) % n; return strategy === "ordered" ? [Math.min(l, r), Math.max(l, r)] : [l, r]; };

/** Possible actions right now. Each is { who, kind: "take" | "eat", fork? }. Empty means deadlock. */
export function actions(state, strategy) {
  const { n, owner, held } = state, out = [], holders = held.filter(h => h.length).length;
  for (let i = 0; i < n; i++) {
    const [a, b] = forksOf(i, n, strategy), h = held[i];
    if (h.length === 2) out.push({ who: i, kind: "eat" });
    else { const want = h.length ? b : a;
      if (owner[want] === null && !(strategy === "waiter" && !h.length && holders >= n - 1)) out.push({ who: i, kind: "take", fork: want }); }
  }
  return out;
}
export function apply(state, act) {
  const s = { n: state.n, owner: [...state.owner], held: state.held.map(h => [...h]), meals: [...state.meals] };
  if (act.kind === "take") { s.owner[act.fork] = act.who; s.held[act.who].push(act.fork); }
  else { for (const f of s.held[act.who]) s.owner[f] = null; s.held[act.who] = []; s.meals[act.who]++; }
  return s;
}
export const start = n => ({ n, owner: new Array(n).fill(null), held: Array.from({ length: n }, () => []), meals: new Array(n).fill(0) });

/** Run up to `steps` actions. Returns every state, and the step at which no one could move (or null). */
export function run({ n = 5, strategy, steps = 400, rnd }) {
  let s = start(n); const states = [s];
  for (let t = 0; t < steps; t++) {
    const acts = actions(s, strategy);
    if (!acts.length) return { states, deadlockAt: t };
    s = apply(s, acts[Math.floor(rnd() * acts.length)]); states.push(s);
  }
  return { states, deadlockAt: null };
}
/** Who waits for whom: philosopher i waits for the owner of the fork it wants next. A cycle here is a deadlock. */
export function waitsFor(state, strategy) {
  return state.held.map((h, i) => { const [a, b] = forksOf(i, state.n, strategy), want = h.length === 2 ? null : h.length ? b : a, o = want === null ? null : state.owner[want]; return o === i ? null : o; });
}
