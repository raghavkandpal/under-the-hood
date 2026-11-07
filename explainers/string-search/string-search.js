// Finding a pattern in text: naive, Knuth–Morris–Pratt and Boyer–Moore–Horspool, counting character comparisons. No DOM.
// Each returns { matches, comparisons, trace }, where trace lists alignments: { shift, cells: [{ i (pattern index), ok }] }.

export function naive(text, pat) {
  const matches = [], trace = []; let comparisons = 0;
  for (let s = 0; s + pat.length <= text.length; s++) {
    const cells = [];
    for (let i = 0; i < pat.length; i++) { comparisons++; const ok = text[s + i] === pat[i]; cells.push({ i, ok }); if (!ok) break; }
    if (cells.length === pat.length && cells.at(-1).ok) matches.push(s);
    trace.push({ shift: s, cells });
  }
  return { matches, comparisons, trace };
}

/** fail[i]: length of the longest proper prefix of pat[0..i] that is also a suffix of it. */
export function failure(pat) {
  const f = new Array(pat.length).fill(0);
  for (let i = 1, k = 0; i < pat.length; i++) { while (k && pat[i] !== pat[k]) k = f[k - 1]; if (pat[i] === pat[k]) k++; f[i] = k; }
  return f;
}
/** KMP never moves backwards in the text: on a mismatch, the failure table says how much of the pattern still matches. */
export function kmp(text, pat) {
  const f = failure(pat), matches = [], trace = []; let comparisons = 0, k = 0, cells = [], shift = 0;
  for (let t = 0; t < text.length; t++) {
    for (;;) {
      comparisons++; const ok = text[t] === pat[k]; cells.push({ i: k, ok });
      if (ok) break;
      if (!k) break;
      trace.push({ shift, cells }); k = f[k - 1]; shift = t - k; cells = Array.from({ length: k }, (_, i) => ({ i, ok: true, known: true }));
    }
    if (text[t] === pat[k]) { k++; if (k === pat.length) { matches.push(t - k + 1); trace.push({ shift, cells }); k = f[k - 1]; shift = t + 1 - k; cells = Array.from({ length: k }, (_, i) => ({ i, ok: true, known: true })); } }
    else { trace.push({ shift, cells }); shift = t + 1; cells = []; }
  }
  if (cells.length) trace.push({ shift, cells });
  return { matches, comparisons, trace };
}

/** Horspool compares right to left, and on a mismatch jumps by how far the text's last aligned character is from the pattern's end. */
export function horspool(text, pat) {
  const m = pat.length, skip = new Map(), matches = [], trace = []; let comparisons = 0;
  for (let i = 0; i < m - 1; i++) skip.set(pat[i], m - 1 - i);
  for (let s = 0; s + m <= text.length; s += skip.get(text[s + m - 1]) ?? m) {
    const cells = [];
    for (let i = m - 1; i >= 0; i--) { comparisons++; const ok = text[s + i] === pat[i]; cells.push({ i, ok }); if (!ok) break; }
    if (cells.length === m && cells.at(-1).ok) matches.push(s);
    trace.push({ shift: s, cells });
  }
  return { matches, comparisons, trace };
}
export const ALGORITHMS = { naive, kmp, horspool };
