// Big-O by measurement: real algorithms instrumented to count their basic steps. No DOM.

const range = n => Array.from({ length: n }, (_, i) => i);

export const ALGOS = {
  index:  { big: "O(1)", name: "Read item #n/2 of an array", run: n => 1 },
  binary: { big: "O(log n)", name: "Binary search a sorted list", run: n => { const a = range(n), x = n - 1; let lo = 0, hi = n - 1, s = 0; while (lo <= hi) { s++; const m = (lo + hi) >> 1; if (a[m] === x) break; if (a[m] < x) lo = m + 1; else hi = m - 1; } return s; } },
  linear: { big: "O(n)", name: "Find the largest item", run: n => { let s = 0, best = -1; for (let i = 0; i < n; i++) { s++; if (i > best) best = i; } return s; } },
  merge:  { big: "O(n log n)", name: "Merge sort", run: n => { let s = 0; const ms = a => { if (a.length < 2) return a; const m = a.length >> 1, L = ms(a.slice(0, m)), R = ms(a.slice(m)), o = []; let i = 0, j = 0; while (i < L.length && j < R.length) { s++; o.push(L[i] <= R[j] ? L[i++] : R[j++]); } return o.concat(L.slice(i), R.slice(j)); }; ms(range(n).reverse()); return s; } },
  pairs:  { big: "O(n²)", name: "Compare every pair (find duplicates naively)", run: n => (n * (n - 1)) / 2 },
  subsets:{ big: "O(2ⁿ)", name: "Try every subset (brute-force packing)", run: n => 2 ** n },
};

/** Steps for each algorithm at size n. Quadratic and exponential use their exact closed forms so huge n stays instant. */
export function steps(n) { return Object.fromEntries(Object.entries(ALGOS).map(([k, a]) => [k, a.run(n)])); }

/** Human-readable duration at `rate` steps per second. */
export function duration(stepsCount, rate = 1e9) {
  const s = stepsCount / rate;
  if (s < 1e-6) return "< 1 µs"; if (s < 1e-3) return (s * 1e6).toFixed(0) + " µs"; if (s < 1) return (s * 1e3).toFixed(0) + " ms";
  if (s < 60) return s.toFixed(1) + " s"; if (s < 3600) return (s / 60).toFixed(0) + " min"; if (s < 86400) return (s / 3600).toFixed(1) + " h";
  if (s < 3.15e7) return (s / 86400).toFixed(0) + " days"; const y = s / 3.15e7;
  return y < 1e6 ? y.toFixed(0) + " years" : y < 1.4e10 ? (y / 1e6).toFixed(0) + " million years" : "longer than the age of the universe";
}
