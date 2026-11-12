// Tries for autocomplete: walk the prefix, then collect the most popular words below it. No DOM.

export class Trie {
  constructor() { this.root = { kids: new Map(), word: null, weight: 0, best: 0 }; this.size = 0; this.nodes = 1; }
  insert(word, weight = 1) {
    let n = this.root; n.best = Math.max(n.best, weight);
    for (const c of word) {
      if (!n.kids.has(c)) { n.kids.set(c, { kids: new Map(), word: null, weight: 0, best: 0 }); this.nodes++; }
      n = n.kids.get(c); n.best = Math.max(n.best, weight); // best weight anywhere below: lets search skip weak branches
    }
    if (n.word == null) this.size++;
    n.word = word; n.weight = weight;
  }
  /** Node for a prefix (and how many steps it took), or null. */
  find(prefix) { let n = this.root, steps = 0; for (const c of prefix) { n = n.kids.get(c); steps++; if (!n) return { node: null, steps }; } return { node: n, steps }; }
  has(word) { const { node } = this.find(word); return !!node && node.word != null; }
  /** Top-k completions by weight. Best-first search using each subtree's best weight, so it rarely visits the whole subtree. */
  complete(prefix, k = 5) {
    const { node, steps } = this.find(prefix); if (!node) return { words: [], visited: steps };
    const out = [], heap = [{ n: node, key: node.best, word: false }]; let visited = steps;
    while (heap.length && out.length < k) {
      heap.sort((a, b) => b.key - a.key); const top = heap.shift(); visited++;
      if (top.word) { out.push({ word: top.n.word, weight: top.n.weight }); continue; }
      if (top.n.word != null) heap.push({ n: top.n, key: top.n.weight, word: true });
      for (const kid of top.n.kids.values()) heap.push({ n: kid, key: kid.best, word: false });
    }
    return { words: out, visited };
  }
  /** Words under a prefix (for display/tests). */
  all(prefix = "") { const { node } = this.find(prefix), out = []; const go = n => { if (n.word != null) out.push(n.word); for (const k of n.kids.values()) go(k); }; if (node) go(node); return out; }
}

/** The naive alternative: scan every word. */
export function scanComplete(words, prefix, k = 5) {
  const hits = words.filter(w => w.word.startsWith(prefix)).sort((a, b) => b.weight - a.weight).slice(0, k);
  return { words: hits, visited: words.length };
}

/** A radix tree merges single-child chains; returns how many nodes that would leave. */
export function radixNodes(trie) {
  let count = 0; const go = (n, isRoot) => { if (isRoot || n.kids.size !== 1 || n.word != null) count++; for (const k of n.kids.values()) go(k, false); };
  go(trie.root, true); return count;
}
