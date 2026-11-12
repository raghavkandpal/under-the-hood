import { test } from "node:test";
import assert from "node:assert/strict";
import { radixNodes } from "../../shared/trie.js";
import { TEXTS, SIZES, SEED, suffixArray, lcpArray, distinctSubstrings, suffixTrie, suffixTrieNodes, find, maxComparisons, longestRepeated, randomText, wordTrie } from "./tries-vs-suffix-arrays.js";

const build = t => { const sa = suffixArray(t), lcp = lcpArray(t, sa); return { sa, lcp }; };

test("banana: suffix array and LCP array", () => {
  const { sa, lcp } = build("banana");
  assert.deepEqual(sa, [5, 3, 1, 0, 4, 2]);
  assert.deepEqual(lcp, [1, 3, 0, 0, 2]);
});

test("Kasai LCP equals comparing neighbours directly", () => {
  for (const t of [TEXTS.terms, randomText(3, 200)]) {
    const { sa, lcp } = build(t);
    const direct = sa.slice(1).map((s, i) => { let h = 0; while (t[s + h] && t[s + h] === t[sa[i] + h]) h++; return h; });
    assert.deepEqual(lcp, direct);
  }
});

test("banana: 15 distinct substrings, 16-node suffix trie, 23 with $, 11 as a suffix tree", () => {
  const { lcp } = build("banana");
  assert.equal(distinctSubstrings("banana", lcp), 15);
  assert.equal(suffixTrie("banana").nodes, 16);
  assert.equal(suffixTrieNodes("banana", lcp), 16);
  const withEnd = suffixTrie("banana$");
  assert.equal(withEnd.nodes, 23);
  assert.equal(radixNodes(withEnd), 11);
  assert.equal(radixNodes(suffixTrie("banana")), 7); // the page's bars: no marker
});

test("the distinct-substring formula matches a brute-force set and a real trie", () => {
  for (const t of ["banana", TEXTS.terms, randomText(5, 60)]) {
    const set = new Set(); for (let i = 0; i < t.length; i++) for (let j = i + 1; j <= t.length; j++) set.add(t.slice(i, j));
    const { lcp } = build(t);
    assert.equal(distinctSubstrings(t, lcp), set.size);
    assert.equal(suffixTrie(t).nodes, 1 + set.size);
  }
});

test("a word trie finds the prefix once, the suffix array finds both occurrences", () => {
  const t = TEXTS.terms, { sa } = build(t);
  assert.deepEqual(wordTrie(t).all("data"), ["database"]);
  const r = find(t, sa, "data");
  assert.equal(r.count, 2);
  assert.deepEqual(r.positions, [0, 13]); // database, and the data inside metadata
  assert.equal(find(t, sa, "zzz").count, 0);
});

test("find agrees with a plain scan for every substring length 1-4 of a random text", () => {
  const t = randomText(SEED, 120), { sa } = build(t);
  for (let len = 1; len <= 4; len++) for (let i = 0; i + len <= t.length; i += 7) {
    const p = t.slice(i, i + len), scan = [];
    for (let j = 0; j + len <= t.length; j++) if (t.startsWith(p, j)) scan.push(j);
    assert.deepEqual(find(t, sa, p).positions, scan);
  }
});

test("a lookup takes at most 2*ceil(log2(n+1)) comparisons: 20 for n = 1000", () => {
  assert.equal(maxComparisons(1000), 20);
  for (const n of SIZES) {
    const t = randomText(SEED, n), { sa } = build(t);
    let worst = 0;
    for (const p of ["a", "ab", "abc", "dcba", "aaaa", "zz", t.slice(5, 9), t.slice(n - 3)]) worst = Math.max(worst, find(t, sa, p).comparisons);
    assert.ok(worst <= maxComparisons(n), `n=${n}: ${worst}`);
    assert.ok(worst >= maxComparisons(n) - 4, `n=${n}: the bound is not far off (${worst})`);
  }
});

test("space: the page's n = 1000 random text has about 496,000 trie nodes, roughly 500 per array entry", () => {
  const t = randomText(SEED, 1000), { lcp } = build(t), nodes = suffixTrieNodes(t, lcp);
  assert.equal(Math.round(nodes / 1000), 496);
  assert.equal(Math.round(nodes / t.length / 100) * 100, 500);
  assert.equal(suffixTrieNodes(t, lcp), suffixTrie(t).nodes); // the formula is the real build
});

test("the node-to-entry ratio grows with n, for every seed tried", () => {
  for (let seed = 1; seed <= 8; seed++) {
    const ratios = SIZES.map(n => { const t = randomText(seed, n), { lcp } = build(t); return suffixTrieNodes(t, lcp) / n; });
    for (let i = 1; i < ratios.length; i++) assert.ok(ratios[i] > ratios[i - 1], `seed ${seed}: ${ratios}`);
  }
});

test("longest repeated substring is the longest LCP: ana in banana", () => {
  const { sa, lcp } = build("banana");
  assert.equal(longestRepeated("banana", sa, lcp), "ana");
  const t = randomText(SEED, 300), b = build(t), r = longestRepeated(t, b.sa, b.lcp);
  assert.ok(t.indexOf(r) !== t.lastIndexOf(r));
  assert.equal(r.length, Math.max(...b.lcp));
  const abc = build("abc");
  assert.equal(longestRepeated("abc", abc.sa, abc.lcp), "");
});

test("the suffix tree has fewer than 2n nodes on every text the page builds it for, and is a small fraction of the trie", () => {
  const texts = ["banana", "banana$", TEXTS.terms, ...SIZES.filter(n => n <= 100).map(n => randomText(SEED, n))];
  for (const t of texts) assert.ok(radixNodes(suffixTrie(t)) < 2 * t.length, t);
  const t = randomText(SEED, 100), trie = suffixTrie(t);
  assert.ok(radixNodes(trie) * 10 < trie.nodes, "most trie nodes are one-child chains");
});
