// PageRank by power iteration and by simulating a random surfer. No DOM.
import { mulberry } from "../../shared/random.js";

/** links: array of [from, to]; n nodes. Dangling pages (no out-links) jump anywhere. */
export function pagerank(n, links, { damping = 0.85, iters = 100, tol = 1e-12 } = {}) {
  const out = Array.from({ length: n }, () => []);
  for (const [a, b] of links) if (a !== b && !out[a].includes(b)) out[a].push(b);
  let r = new Array(n).fill(1 / n); const history = [r.slice()];
  for (let it = 0; it < iters; it++) {
    const next = new Array(n).fill((1 - damping) / n);
    let dangling = 0;
    for (let i = 0; i < n; i++) { if (!out[i].length) dangling += r[i]; else for (const j of out[i]) next[j] += damping * r[i] / out[i].length; }
    for (let i = 0; i < n; i++) next[i] += damping * dangling / n;
    const diff = next.reduce((s, v, i) => s + Math.abs(v - r[i]), 0);
    r = next; history.push(r.slice());
    if (diff < tol) break;
  }
  return { rank: r, history };
}

/** Follow a random surfer for `steps` clicks; return visit shares. */
export function surf(n, links, { damping = 0.85, steps = 20000, seed = 1, start = 0 } = {}) {
  const out = Array.from({ length: n }, () => []);
  for (const [a, b] of links) if (a !== b && !out[a].includes(b)) out[a].push(b);
  const r = mulberry(seed), visits = new Array(n).fill(0), path = [];
  let at = start;
  for (let s = 0; s < steps; s++) {
    visits[at]++; if (s < 200) path.push(at);
    at = r() > damping || !out[at].length ? Math.floor(r() * n) : out[at][Math.floor(r() * out[at].length)];
  }
  return { share: visits.map(v => v / steps), path };
}
