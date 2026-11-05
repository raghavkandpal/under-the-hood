// LZ77 with a sliding window: tokens are literals or (distance, length) back-references. No DOM.

/** Greedy longest-match encoder. Matches may overlap the current position (so "aaaa…" compresses). */
export function encode(text, { window = 4096, minMatch = 3, maxMatch = 258 } = {}) {
  const s = [...text], out = [];
  let i = 0;
  while (i < s.length) {
    let bestLen = 0, bestDist = 0;
    const start = Math.max(0, i - window);
    for (let j = i - 1; j >= start; j--) {
      let k = 0;
      while (k < maxMatch && i + k < s.length && s[j + k] === s[i + k]) k++;
      if (k > bestLen) { bestLen = k; bestDist = i - j; if (k === maxMatch) break; }
    }
    if (bestLen >= minMatch) { out.push({ pos: i, dist: bestDist, len: bestLen }); i += bestLen; }
    else { out.push({ pos: i, lit: s[i] }); i++; }
  }
  return out;
}

export function decode(tokens) {
  const out = [];
  for (const t of tokens) {
    if (t.lit != null) out.push(t.lit);
    else for (let k = 0; k < t.len; k++) out.push(out[out.length - t.dist]);
  }
  return out.join("");
}

/** Rough encoded size in bits: a literal ≈ 9 bits (flag + byte), a match ≈ 1 + 12 (distance) + 8 (length) bits. */
export function sizeBits(tokens) { return tokens.reduce((s, t) => s + (t.lit != null ? 9 : 21), 0); }
export const rawBits = text => [...text].length * 8;
