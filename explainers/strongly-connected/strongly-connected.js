// Strongly connected components (Kosaraju–Sharir) and 2-SAT, with no DOM, so it can be tested in Node.
import { mulberry } from "../../shared/random.js";

/** Self-made: components {0,1,2}, {3,4}, {5}, {6,7}. */
export const GRAPH = { n: 8, edges: [[0, 1], [1, 2], [2, 0], [2, 3], [3, 4], [4, 3], [4, 5], [1, 5], [5, 6], [6, 7], [7, 6]] };

const adjacency = (n, edges) => { const adj = Array.from({ length: n }, () => []); for (const [a, b] of edges) adj[a].push(b); return adj; };
const reversed = ({ n, edges }) => ({ n, edges: edges.map(([a, b]) => [b, a]) });

/** Recursive DFS over `order`; counts every edge looked at. Returns the visit groups and the postorder. */
function dfsPass(g, order) {
  const adj = adjacency(g.n, g.edges), seen = Array(g.n).fill(false), post = [], groups = [];
  let checks = 0;
  const visit = (u, group) => { seen[u] = true; group.push(u); for (const v of adj[u]) { checks++; if (!seen[v]) visit(v, group); } post.push(u); };
  for (const s of order) if (!seen[s]) { const group = []; visit(s, group); groups.push(group); }
  return { groups, post, checks };
}

/**
 * Pass 1: DFS on the reversed graph, keep the reverse postorder. Pass 2: DFS on the graph, starting in that order
 * ("reverse-postorder") or in plain node order ("node"). comp[u] numbers the groups in the order pass 2 found them.
 */
export function kosaraju(g, pass2 = "reverse-postorder") {
  const ids = [...Array(g.n).keys()];
  const p1 = dfsPass(reversed(g), ids), order = pass2 === "node" ? ids : [...p1.post].reverse();
  const p2 = dfsPass(g, order), comp = Array(g.n);
  p2.groups.forEach((grp, i) => grp.forEach(u => (comp[u] = i)));
  return { order, groups: p2.groups.map(grp => [...grp].sort((a, b) => a - b)), comp, checks: p1.checks + p2.checks };
}

/** reach[a][b]: b can be reached from a (Floyd–Warshall closure, the brute-force reference). */
export function reachability({ n, edges }) {
  const r = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => i === j));
  for (const [a, b] of edges) r[a][b] = true;
  for (let k = 0; k < n; k++) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (r[i][k] && r[k][j]) r[i][j] = true;
  return r;
}

/** The partition by mutual reachability, each group sorted, groups ordered by smallest node. */
export function bruteForceGroups(g) {
  const r = reachability(g), groups = [];
  for (let u = 0; u < g.n; u++) if (!groups.some(grp => grp.includes(u))) groups.push([...Array(g.n).keys()].filter(v => r[u][v] && r[v][u]));
  return groups;
}
export const sortGroups = groups => groups.map(g => [...g].sort((a, b) => a - b)).sort((a, b) => a[0] - b[0]);

/** Is every pair inside the group mutually reachable? */
export const isStronglyConnected = (g, group) => { const r = reachability(g); return group.every(a => group.every(b => r[a][b])); };

/** One node per group, one edge per pair of groups with an edge between them. */
export function condensation(g, comp) {
  const k = Math.max(...comp) + 1, seen = new Set();
  for (const [a, b] of g.edges) if (comp[a] !== comp[b]) seen.add(`${comp[a]},${comp[b]}`);
  return { n: k, edges: [...seen].map(s => s.split(",").map(Number)) };
}

// ---- 2-SAT. Variable v: literal 2v is "v", 2v+1 is "not v", so l ^ 1 negates.
export const VARS = "abcde";
export const literalName = l => (l & 1 ? "¬" : "") + VARS[l >> 1];
export const clauseText = ([x, y]) => `(${literalName(x)} ∨ ${literalName(y)})`;
/** (a ∨ ¬b) ∧ (¬a ∨ b) ∧ (¬a ∨ ¬b) ∧ (a ∨ ¬c) */
export const WORKED = [[0, 3], [1, 2], [1, 3], [0, 5]];
export const WORKED_PLUS = [...WORKED, [0, 2]];

const satisfies = (assign, clauses) => clauses.every(([x, y]) => assign[x >> 1] !== !!(x & 1) || assign[y >> 1] !== !!(y & 1));

export function twoSat(nVars, clauses) {
  const edges = clauses.flatMap(([x, y]) => [[x ^ 1, y], [y ^ 1, x]]);
  const g = { n: 2 * nVars, edges }, k = kosaraju(g);
  const clash = Array.from({ length: nVars }, (_, v) => v).filter(v => k.comp[2 * v] === k.comp[2 * v + 1]);
  // Groups come out sinks first, so a variable is true when its literal's group is found before its negation's.
  const assignment = clash.length ? null : Array.from({ length: nVars }, (_, v) => k.comp[2 * v] < k.comp[2 * v + 1]);
  return { graph: g, comp: k.comp, groups: k.groups, edges: edges.length, literals: g.n, satisfiable: !clash.length, clash, assignment };
}

/** Try all 2^nVars assignments. */
export function bruteForceSat(nVars, clauses) {
  for (let m = 0; m < 1 << nVars; m++) if (satisfies(Array.from({ length: nVars }, (_, v) => !!(m >> v & 1)), clauses)) return true;
  return false;
}
export const clausesHold = satisfies;

/** A seeded formula over `nVars` variables: 4 to 12 clauses on two different variables, each literal negated by a coin flip. */
export function randomFormula(seed, nVars = 5) {
  const rnd = mulberry(seed), count = 4 + Math.floor(rnd() * 9), clauses = [];
  for (let i = 0; i < count; i++) {
    const a = Math.floor(rnd() * nVars); let b = Math.floor(rnd() * (nVars - 1)); if (b >= a) b++;
    clauses.push([2 * a + (rnd() < 0.5 ? 1 : 0), 2 * b + (rnd() < 0.5 ? 1 : 0)]);
  }
  return clauses;
}

// ---- What the page shows, so the tests can check it.
export const FORMULAS = { worked: "4 clauses", plus: "+ (a ∨ b)", random: "Random" };
export function componentsView(pass2) {
  const k = kosaraju(GRAPH, pass2), truth = sortGroups(bruteForceGroups(GRAPH));
  return { ...k, bad: k.groups.filter(grp => !isStronglyConnected(GRAPH, grp)).length, correct: JSON.stringify(sortGroups(k.groups)) === JSON.stringify(truth), truthCount: truth.length };
}
export function satView(which, seed) {
  const nVars = which === "random" ? 5 : 3, clauses = which === "worked" ? WORKED : which === "plus" ? WORKED_PLUS : randomFormula(seed);
  const r = twoSat(nVars, clauses), brute = bruteForceSat(nVars, clauses);
  return { ...r, nVars, clauses, brute, holds: r.assignment ? satisfies(r.assignment, clauses) : null };
}
