// Binary min-heap stored in an array, recording every swap so a page can animate it. No DOM.
// Children of i are 2i+1 and 2i+2; parent is (i-1)>>1.

export class Heap {
  constructor(items = []) { this.a = []; this.log = []; this.compares = 0; items.forEach(x => this.push(x)); this.log = []; }
  get size() { return this.a.length; }
  peek() { return this.a[0]; }
  #less(i, j) { this.compares++; return this.a[i] < this.a[j]; }
  #swap(i, j) { [this.a[i], this.a[j]] = [this.a[j], this.a[i]]; this.log.push(["swap", i, j]); }
  push(x) {
    this.a.push(x); let i = this.a.length - 1; this.log.push(["add", i]);
    while (i > 0) { const p = (i - 1) >> 1; if (!this.#less(i, p)) break; this.#swap(i, p); i = p; } // sift up
  }
  pop() {
    if (!this.a.length) return undefined;
    const top = this.a[0], last = this.a.pop(); this.log.push(["remove", 0]);
    if (this.a.length) {
      this.a[0] = last; this.log.push(["move", this.a.length, 0]); let i = 0;
      for (;;) { // sift down to the smaller child
        const l = 2 * i + 1, r = l + 1; let m = i;
        if (l < this.a.length && this.#less(l, m)) m = l;
        if (r < this.a.length && this.#less(r, m)) m = r;
        if (m === i) break; this.#swap(i, m); i = m;
      }
    }
    return top;
  }
  valid() { for (let i = 1; i < this.a.length; i++) if (this.a[i] < this.a[(i - 1) >> 1]) return false; return true; }
}

/** Build a heap from an array in O(n) by sifting down from the last parent (Floyd). Returns swaps made. */
export function heapify(arr) {
  const a = [...arr]; let swaps = 0;
  for (let s = (a.length >> 1) - 1; s >= 0; s--) {
    let i = s; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l] < a[m]) m = l; if (r < a.length && a[r] < a[m]) m = r; if (m === i) break; [a[i], a[m]] = [a[m], a[i]]; swaps++; i = m; }
  }
  return { a, swaps };
}

/** Top-k largest from a stream using a size-k min-heap: O(n log k) instead of sorting everything. */
export function topK(stream, k) {
  const h = new Heap(); for (const x of stream) { if (h.size < k) h.push(x); else if (x > h.peek()) { h.pop(); h.push(x); } }
  const out = []; while (h.size) out.push(h.pop()); return { top: out.reverse(), compares: h.compares };
}
