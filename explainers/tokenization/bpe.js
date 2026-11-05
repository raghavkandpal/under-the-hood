// Byte-pair encoding (character-level, SentencePiece-style "▁" word-start marker). No DOM.

export const SPACE = "▁";

export function words(text) {
  // keep punctuation as its own word; lowercase for a smaller toy vocabulary
  return (text.toLowerCase().match(/[a-z0-9']+|[^\sa-z0-9']/g) || []).map(w => SPACE + w);
}

function pairCounts(wordList) {
  const counts = new Map();
  for (const { syms, n } of wordList) for (let i = 0; i < syms.length - 1; i++) {
    const k = syms[i] + "\u0000" + syms[i + 1];
    counts.set(k, (counts.get(k) || 0) + n);
  }
  return counts;
}
const best = counts => {
  let bk = null, bc = 0;
  for (const [k, c] of counts) if (c > bc || (c === bc && k < bk)) { bk = k; bc = c; }
  return bk ? { pair: bk.split("\u0000"), count: bc } : null;
};
function applyMerge(syms, [a, b]) {
  const out = [];
  for (let i = 0; i < syms.length; i++) {
    if (i < syms.length - 1 && syms[i] === a && syms[i + 1] === b) { out.push(a + b); i++; } else out.push(syms[i]);
  }
  return out;
}

/** Learn up to `numMerges` merges. Returns { merges: [{pair, count, token}], base: [chars], steps: [{top: [[pair,count]...]}] } */
export function train(text, numMerges) {
  const freq = new Map();
  for (const w of words(text)) freq.set(w, (freq.get(w) || 0) + 1);
  let wordList = [...freq].map(([w, n]) => ({ syms: [...w], n }));
  const base = [...new Set(wordList.flatMap(w => w.syms))].sort();
  const merges = [], tops = [];
  for (let m = 0; m < numMerges; m++) {
    const counts = pairCounts(wordList);
    const b = best(counts);
    if (!b || b.count < 2) break;
    tops.push([...counts].sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1)).slice(0, 8).map(([k, c]) => [k.split("\u0000"), c]));
    merges.push({ pair: b.pair, count: b.count, token: b.pair.join("") });
    wordList = wordList.map(w => ({ ...w, syms: applyMerge(w.syms, b.pair) }));
  }
  return { merges, base, tops };
}

/** Tokenise with the first `k` merges (default all), applied in learned order, like GPT-2 style BPE. */
export function encode(text, merges, k = merges.length) {
  const out = [];
  for (const w of words(text)) {
    let syms = [...w];
    for (let i = 0; i < k; i++) syms = applyMerge(syms, merges[i].pair);
    out.push(...syms);
  }
  return out;
}

export function vocab(base, merges, k = merges.length) { return [...base, ...merges.slice(0, k).map(m => m.token)]; }
