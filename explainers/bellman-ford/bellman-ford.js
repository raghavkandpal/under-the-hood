// Negative weights and Bellman–Ford: the logic, with no DOM, so it can be tested in Node.
// A graph is { nodes: [names], edges: [[from, to, weight], ...], pos } with nodes as indexes; edge order matters.

const chain = order => {
  const edges = [0, 1, 2, 3, 4].map(i => [i, i + 1, 1]);
  return { nodes: ["N0", "N1", "N2", "N3", "N4", "N5"], edges: order === "back" ? edges.reverse() : edges,
    pos: [[40, 100], [120, 100], [200, 100], [280, 100], [360, 100], [440, 100]] };
};

export const GRAPHS = {
  classic: { nodes: ["S", "A", "B"], edges: [[0, 1, 2], [0, 2, 5], [2, 1, -4]], pos: [[60, 100], [300, 40], [300, 160]] },
  "chain-front": chain("front"),
  "chain-back": chain("back"),
  loop: { nodes: ["S", "A", "B", "C", "T"], edges: [[0, 1, 1], [1, 2, 1], [2, 3, -3], [3, 1, 1], [3, 4, 2]],
    pos: [[40, 100], [140, 100], [240, 40], [240, 160], [340, 100]] },
};

// Invented rates, fees ignored: RATES[from][to] is how many `to` one `from` buys.
export const CURRENCIES = ["USD", "EUR", "GBP", "JPY"];
const RATES = [
  [0, 0.9, 0.75, 150],
  [1.1, 0, 0.85, 166],
  [1.32, 1.16, 0, 195],
  [0.0066, 0.006, 0.0051, 0],
];
const POS4 = [[80, 40], [320, 40], [320, 160], [80, 160]];

/** Currency graph with weight −ln(rate): a cycle's weights sum to −ln(product of its rates). `cut` = [from, to] lowers that rate by 1%. */
export function currencyGraph(cut) {
  const edges = [];
  RATES.forEach((row, i) => row.forEach((r, j) => {
    if (i !== j) edges.push([i, j, -Math.log(cut && cut[0] === i && cut[1] === j ? r * 0.99 : r)]);
  }));
  return { nodes: CURRENCIES, edges, pos: POS4, rates: true };
}

/** Product of exp(−w) around a cycle given as a node list (closing edge back to the first). */
export function cycleRate(g, cycle) {
  let p = 1;
  cycle.forEach((u, i) => {
    const v = cycle[(i + 1) % cycle.length];
    p *= Math.exp(-g.edges.find(e => e[0] === u && e[1] === v)[2]);
  });
  return p;
}
export const cycleWeight = (g, cycle) => -Math.log(cycleRate(g, cycle));

/** Bellman–Ford from `source`: up to V rounds over the edges in listed order; stop after a round that changes nothing. */
export function bellmanFord(g, source = 0) {
  const V = g.nodes.length, dist = Array(V).fill(Infinity), pred = Array(V).fill(-1);
  dist[source] = 0;
  const rounds = [];
  let relaxations = 0, last = -1;
  for (let r = 1; r <= V; r++) {
    let changed = 0;
    for (const [u, v, w] of g.edges) {
      if (dist[u] + w < dist[v] - 1e-12) { dist[v] = dist[u] + w; pred[v] = u; changed++; last = v; }
    }
    relaxations += changed;
    rounds.push({ dist: [...dist], changed });
    if (!changed) break;
  }
  const changingRounds = rounds.filter(x => x.changed).length;
  // A relaxation that still succeeds in round V proves a negative cycle; V steps back along pred lands on it.
  let cycle = null;
  if (rounds.length === V && rounds[V - 1].changed) {
    let x = last;
    for (let i = 0; i < V; i++) x = pred[x];
    cycle = [x];
    for (let y = pred[x]; y !== x; y = pred[y]) cycle.push(y);
    cycle.reverse();
  }
  return { dist, rounds, changingRounds, relaxations, bound: (V - 1) * g.edges.length, cycle };
}

/** Textbook Dijkstra: settle the nearest unsettled node once, relax only edges to unsettled nodes. Wrong with negative edges. */
export function dijkstraOnce(g, source = 0) {
  const V = g.nodes.length, dist = Array(V).fill(Infinity), done = Array(V).fill(false);
  dist[source] = 0;
  for (let k = 0; k < V; k++) {
    let u = -1;
    for (let i = 0; i < V; i++) if (!done[i] && (u < 0 || dist[i] < dist[u])) u = i;
    if (dist[u] === Infinity) break;
    done[u] = true;
    for (const [a, b, w] of g.edges) if (a === u && !done[b] && dist[u] + w < dist[b]) dist[b] = dist[u] + w;
  }
  return dist;
}
