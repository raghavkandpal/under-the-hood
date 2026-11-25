// Tail latency and fan-out: the logic, with no DOM, so it can be tested in Node.
import { mulberry } from "../../shared/random.js";

/** Model constants: a leaf answers in `fast` ms, or `slow` ms with probability `pSlow`; a hedge goes out after `hedgeAfter` ms. */
export const LEAF = { fast: 10, slow: 1000, pSlow: 0.01, hedgeAfter: 20 };
export const MODES = { plain: "No hedge", hedge: "Hedge at 20 ms", double: "Two copies" };
export const SEED = 7, REQUESTS = 10000;

/** Mean latency of one leaf call under `mode`, exact. */
export const leafMean = (mode = "plain") => {
  const { fast, slow, pSlow, hedgeAfter } = LEAF, q = 1 - pSlow;
  if (mode === "plain") return q * fast + pSlow * slow;
  if (mode === "double") return (1 - pSlow ** 2) * fast + pSlow ** 2 * slow;
  return q * fast + pSlow * (q * (hedgeAfter + fast) + pSlow * slow);
};
export const leafFastShare = () => 1 - LEAF.pSlow;

/** P(a request is slow) when it waits for n leaves; a hedged or doubled leaf is slow only if both copies are. */
export const pSlowRequest = (n, mode = "plain") => 1 - (1 - (mode === "plain" ? LEAF.pSlow : LEAF.pSlow ** 2)) ** n;

/** Extra leaf calls as a share of the first calls, in expectation. */
export const extraCalls = mode => ({ plain: 0, hedge: LEAF.pSlow, double: 1 })[mode];

const draw = rnd => (rnd() < LEAF.pSlow ? LEAF.slow : LEAF.fast);

/** One leaf call. Returns its latency and whether a second copy was sent. */
function leafCall(rnd, mode) {
  const a = draw(rnd), b = draw(rnd); // always two draws, so streams don't shift between modes
  if (mode === "plain") return { ms: a, extra: 0 };
  if (mode === "double") return { ms: Math.min(a, b), extra: 1 };
  return a <= LEAF.hedgeAfter ? { ms: a, extra: 0 } : { ms: Math.min(a, LEAF.hedgeAfter + b), extra: 1 };
}

/** A seeded run of `requests` requests, each waiting for the slowest of n leaves. */
export function simulate(n, mode, requests = REQUESTS, seed = SEED) {
  const rnd = mulberry(seed), times = [];
  let extra = 0;
  for (let r = 0; r < requests; r++) {
    let worst = 0;
    for (let i = 0; i < n; i++) { const c = leafCall(rnd, mode); extra += c.extra; if (c.ms > worst) worst = c.ms; }
    times.push(worst);
  }
  times.sort((x, y) => x - y);
  return { slowRate: times.filter(t => t >= LEAF.slow).length / requests, median: times[requests >> 1], extra: extra / (requests * n) };
}

/** Everything the page displays for one n and mode. */
export function view(n, mode) {
  const s = simulate(n, mode);
  return { formula: pSlowRequest(n, mode), slowRate: s.slowRate, median: s.median, extra: s.extra, expectedExtra: extraCalls(mode), leafMean: leafMean(mode) };
}
