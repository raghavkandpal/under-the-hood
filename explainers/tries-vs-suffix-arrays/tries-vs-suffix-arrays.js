// Tries vs suffix arrays: the logic, with no DOM, so it can be tested in Node.
import { Trie } from "../../shared/trie.js";
import { mulberry } from "../../shared/random.js";

export const TEXTS = { banana: "banana", terms: "database metadata update" };

/** Start offsets of all suffixes in sorted order (plain sort: fine for the page's short texts). */
export const suffixArray = t => Array.from({ length: t.length }, (_, i) => i).sort((a, b) => (t.slice(a) < t.slice(b) ? -1 : 1));

/** lcp[i] = common prefix length of suffixes sa[i] and sa[i+1], by Kasai's linear scan. */
export function lcpArray(t, sa) {
  const rank = new Array(t.length); sa.forEach((s, i) => { rank[s] = i; });
  const lcp = new Array(Math.max(0, t.length - 1)).fill(0); let h = 0;
  for (let i = 0; i < t.length; i++) {
    if (rank[i] === t.length - 1) { h = 0; continue; }
    const j = sa[rank[i] + 1];
    while (i + h < t.length && j + h < t.length && t[i + h] === t[j + h]) h++;
    lcp[rank[i]] = h; if (h > 0) h--;
  }
  return lcp;
}

/** Every substring starts some suffix: n(n+1)/2 prefixes, minus the ones shared with the neighbour above. */
export const distinctSubstrings = (t, lcp) => (t.length * (t.length + 1)) / 2 - lcp.reduce((a, b) => a + b, 0);

/** Trie of every suffix, built node by node (small texts only; its size is quadratic). */
export function suffixTrie(t) {
  const tr = new Trie(); for (let i = 0; i < t.length; i++) tr.insert(t.slice(i)); return tr;
}

/** Suffix-trie node count without building it: the root plus one node per distinct substring. */
export const suffixTrieNodes = (t, lcp) => 1 + distinctSubstrings(t, lcp);

/** Binary search for the block of suffixes starting with p. Counts every suffix-versus-pattern comparison. */
export function find(t, sa, p) {
  let comparisons = 0;
  const bound = upper => {
    let lo = 0, hi = sa.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1; comparisons++;
      const s = t.slice(sa[mid], sa[mid] + p.length);
      if (upper ? s <= p : s < p) lo = mid + 1; else hi = mid;
    }
    return lo;
  };
  const from = bound(false), to = bound(true);
  return { from, to, count: to - from, positions: sa.slice(from, to).sort((a, b) => a - b), comparisons };
}

/** The worst case for the two searches together. */
export const maxComparisons = n => 2 * Math.ceil(Math.log2(n + 1));

export function longestRepeated(t, sa, lcp) {
  let best = 0; lcp.forEach((v, i) => { if (v > lcp[best]) best = i; });
  return lcp.length && lcp[best] ? t.slice(sa[best], sa[best] + lcp[best]) : "";
}

export function randomText(seed, n, alphabet = "abcd") {
  const r = mulberry(seed); return Array.from({ length: n }, () => alphabet[Math.floor(r() * alphabet.length)]).join("");
}

/** Words of a text, in a prefix trie: the thing the suffix array is compared with. */
export function wordTrie(t) { const tr = new Trie(); for (const w of t.split(" ")) tr.insert(w); return tr; }
