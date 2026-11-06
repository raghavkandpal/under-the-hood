// Zero-knowledge proof of a graph 3-colouring: commit, challenge one edge, reveal two colours, repeat. No DOM.
import { sha1 } from "../../shared/git.js";

const enc = s => new TextEncoder().encode(s);
/** Hash commitment: hides the colour until the nonce is revealed, and can't be changed afterwards. */
export const commit = (colour, nonce) => sha1(enc(`${nonce}:${colour}`));

/** A small graph that is 3-colourable, and a valid colouring the prover keeps secret. */
export const GRAPH = {
  nodes: 8,
  edges: [[0, 1], [0, 2], [1, 2], [1, 3], [2, 4], [3, 4], [3, 5], [4, 6], [5, 6], [5, 7], [6, 7], [0, 7], [2, 3]],
  secret: [0, 1, 2, 0, 1, 2, 0, 1],
};
export const validColouring = (g, col) => g.edges.every(([a, b]) => col[a] !== col[b]);
export const badEdges = (g, col) => g.edges.filter(([a, b]) => col[a] === col[b]).length;
/** A cheater who doesn't know a valid colouring: copies the secret but gets one node wrong (which breaks two edges). */
export const cheatColouring = g => { const c = [...g.secret]; c[g.edges[0][1]] = c[g.edges[0][0]]; return c; };

const shuffle = (xs, rnd) => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/** One round. The prover relabels colours at random, commits to every node, the verifier challenges one random edge. */
export function round(g, colouring, rnd) {
  const perm = shuffle([0, 1, 2], rnd), coloured = colouring.map(c => perm[c]);
  const nonces = coloured.map(() => Math.floor(rnd() * 2 ** 32).toString(16));
  const commitments = coloured.map((c, i) => commit(c, nonces[i]));
  const e = g.edges[Math.floor(rnd() * g.edges.length)];
  const opened = e.map(i => ({ node: i, colour: coloured[i], nonce: nonces[i] }));
  const honest = opened.every(o => commit(o.colour, o.nonce) === commitments[o.node]); // the verifier checks the openings
  return { commitments, edge: e, opened, ok: honest && opened[0].colour !== opened[1].colour };
}

/** Chance a cheater with `bad` broken edges survives k rounds. */
export const survive = (g, k, bad = 1) => (1 - bad / g.edges.length) ** k;
/** Rounds needed to push a cheater's survival chance below `risk`. */
export const roundsFor = (g, risk, bad = 1) => Math.ceil(Math.log(risk) / Math.log(1 - bad / g.edges.length));
