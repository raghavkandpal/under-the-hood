// Sorting algorithms as generators that yield every comparison and write, so a UI can replay them. No DOM.
// Each yields { type: "cmp", i, j } | { type: "swap", i, j } | { type: "set", i, v }. They sort `a` in place.

function* bubble(a) {
  for (let end = a.length - 1; end > 0; end--) {
    let swapped = false;
    for (let i = 0; i < end; i++) { yield { type: "cmp", i, j: i + 1 }; if (a[i] > a[i + 1]) { [a[i], a[i + 1]] = [a[i + 1], a[i]]; swapped = true; yield { type: "swap", i, j: i + 1 }; } }
    if (!swapped) return;
  }
}
function* insertion(a) {
  for (let i = 1; i < a.length; i++) for (let j = i; j > 0; j--) {
    yield { type: "cmp", i: j - 1, j };
    if (a[j - 1] > a[j]) { [a[j - 1], a[j]] = [a[j], a[j - 1]]; yield { type: "swap", i: j - 1, j }; } else break;
  }
}
function* selection(a) {
  for (let i = 0; i < a.length - 1; i++) {
    let m = i;
    for (let j = i + 1; j < a.length; j++) { yield { type: "cmp", i: m, j }; if (a[j] < a[m]) m = j; }
    if (m !== i) { [a[i], a[m]] = [a[m], a[i]]; yield { type: "swap", i, j: m }; }
  }
}
function* merge(a) {
  const tmp = a.slice();
  function* rec(lo, hi) {
    if (hi - lo < 2) return;
    const mid = (lo + hi) >> 1;
    yield* rec(lo, mid); yield* rec(mid, hi);
    for (let k = lo; k < hi; k++) tmp[k] = a[k];
    let i = lo, j = mid;
    for (let k = lo; k < hi; k++) {
      if (i < mid && j < hi) yield { type: "cmp", i, j };
      const v = i < mid && (j >= hi || tmp[i] <= tmp[j]) ? tmp[i++] : tmp[j++];
      a[k] = v; yield { type: "set", i: k, v };
    }
  }
  yield* rec(0, a.length);
}
function* quick(a) {
  function* rec(lo, hi) {
    while (lo < hi) {
      // median-of-three pivot moved to hi
      const mid = (lo + hi) >> 1;
      yield { type: "cmp", i: lo, j: mid }; if (a[mid] < a[lo]) { [a[mid], a[lo]] = [a[lo], a[mid]]; yield { type: "swap", i: lo, j: mid }; }
      yield { type: "cmp", i: lo, j: hi }; if (a[hi] < a[lo]) { [a[hi], a[lo]] = [a[lo], a[hi]]; yield { type: "swap", i: lo, j: hi }; }
      yield { type: "cmp", i: mid, j: hi }; if (a[mid] < a[hi]) { [a[mid], a[hi]] = [a[hi], a[mid]]; yield { type: "swap", i: mid, j: hi }; }
      const p = a[hi]; let i = lo;
      for (let j = lo; j < hi; j++) { yield { type: "cmp", i: j, j: hi }; if (a[j] < p) { if (i !== j) { [a[i], a[j]] = [a[j], a[i]]; yield { type: "swap", i, j }; } i++; } }
      if (i !== hi) { [a[i], a[hi]] = [a[hi], a[i]]; yield { type: "swap", i, j: hi }; }
      // recurse on the smaller side, loop on the larger (bounded stack)
      if (i - lo < hi - i) { yield* rec(lo, i - 1); lo = i + 1; } else { yield* rec(i + 1, hi); hi = i - 1; }
    }
  }
  yield* rec(0, a.length - 1);
}
function* heap(a) {
  const n = a.length;
  function* sift(start, end) {
    let root = start;
    for (;;) {
      let child = 2 * root + 1; if (child > end) return;
      if (child + 1 <= end) { yield { type: "cmp", i: child, j: child + 1 }; if (a[child] < a[child + 1]) child++; }
      yield { type: "cmp", i: root, j: child };
      if (a[root] < a[child]) { [a[root], a[child]] = [a[child], a[root]]; yield { type: "swap", i: root, j: child }; root = child; } else return;
    }
  }
  for (let s = (n >> 1) - 1; s >= 0; s--) yield* sift(s, n - 1);
  for (let end = n - 1; end > 0; end--) { [a[0], a[end]] = [a[end], a[0]]; yield { type: "swap", i: 0, j: end }; yield* sift(0, end - 1); }
}

export const ALGOS = {
  bubble: { label: "Bubble sort", gen: bubble, big: "O(n²)" },
  insertion: { label: "Insertion sort", gen: insertion, big: "O(n²), O(n) if nearly sorted" },
  selection: { label: "Selection sort", gen: selection, big: "O(n²) always" },
  merge: { label: "Merge sort", gen: merge, big: "O(n log n), extra memory" },
  quick: { label: "Quicksort", gen: quick, big: "O(n log n) average" },
  heap: { label: "Heapsort", gen: heap, big: "O(n log n), in place" },
};

export const INPUTS = {
  random: { label: "Random", gen: (n, r) => shuffle(Array.from({ length: n }, (_, i) => i + 1), r) },
  nearly: { label: "Nearly sorted", gen: (n, r) => { const a = Array.from({ length: n }, (_, i) => i + 1); for (let k = 0; n > 1 && k < Math.max(1, n / 20); k++) { const i = Math.floor(r() * (n - 1)); [a[i], a[i + 1]] = [a[i + 1], a[i]]; } return a; } },
  reversed: { label: "Reversed", gen: n => Array.from({ length: n }, (_, i) => n - i) },
  few: { label: "Few unique values", gen: (n, r) => shuffle(Array.from({ length: n }, (_, i) => 1 + Math.floor(i / n * 4) * Math.ceil(n / 4)), r) },
};
function shuffle(a, r) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/** Run to completion and count operations. */
export function count(algo, input) {
  const a = input.slice(); let cmps = 0, writes = 0;
  for (const op of ALGOS[algo].gen(a)) { if (op.type === "cmp") cmps++; else writes += op.type === "swap" ? 2 : 1; }
  return { cmps, writes, sorted: a };
}
