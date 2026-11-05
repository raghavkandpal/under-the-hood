// Virtual memory: page table, TLB, page faults and replacement (FIFO / LRU / optimal). No DOM.

export class VM {
  constructor({ pageSize = 256, frames = 4, tlbSize = 2, policy = "lru" } = {}) {
    Object.assign(this, { pageSize, frames, tlbSize, policy });
    this.pt = new Map();      // vpn -> frame
    this.frameOwner = new Array(frames).fill(null); // frame -> vpn
    this.tlb = [];            // [vpn], most recent last
    this.order = [];          // FIFO load order / LRU use order of resident vpns
    this.future = null;       // for "opt": remaining reference string
    this.stats = { accesses: 0, tlbHits: 0, faults: 0 };
  }
  translate(vaddr) {
    const vpn = Math.floor(vaddr / this.pageSize), offset = vaddr % this.pageSize;
    this.stats.accesses++;
    const r = { vaddr, vpn, offset, tlbHit: false, fault: false, evicted: null };
    const ti = this.tlb.indexOf(vpn);
    if (ti >= 0) { r.tlbHit = true; this.stats.tlbHits++; this.tlb.splice(ti, 1); this.tlb.push(vpn); }
    else {
      if (!this.pt.has(vpn)) { r.fault = true; this.stats.faults++; this.load(vpn, r); }
      this.tlb.push(vpn); if (this.tlb.length > this.tlbSize) this.tlb.shift();
    }
    if (this.policy === "lru") { this.order = this.order.filter(v => v !== vpn); this.order.push(vpn); }
    r.frame = this.pt.get(vpn); r.paddr = r.frame * this.pageSize + offset;
    if (this.future) this.future.shift();
    return r;
  }
  load(vpn, r) {
    let f = this.frameOwner.indexOf(null);
    if (f < 0) {
      let victim;
      if (this.policy === "opt" && this.future) {
        // evict the page used furthest in the future (or never)
        const nextUse = v => { const i = this.future.slice(1).indexOf(v); return i < 0 ? Infinity : i; };
        victim = [...this.pt.keys()].reduce((a, b) => (nextUse(b) > nextUse(a) ? b : a));
      } else victim = this.order[0];
      f = this.pt.get(victim); this.pt.delete(victim); this.order = this.order.filter(v => v !== victim);
      this.tlb = this.tlb.filter(v => v !== victim); r.evicted = victim;
    }
    this.pt.set(vpn, f); this.frameOwner[f] = vpn;
    if (this.policy !== "lru") this.order.push(vpn);
  }
}

/** Count faults for a reference string of page numbers. */
export function faults(refs, frames, policy) {
  const vm = new VM({ frames, policy, pageSize: 1, tlbSize: 0 });
  if (policy === "opt") vm.future = refs.slice();
  for (const p of refs) vm.translate(p);
  return vm.stats.faults;
}

export const PATTERNS = {
  loop: { label: "Loop over 3 pages", gen: n => Array.from({ length: n }, (_, i) => (Math.floor(i / 4) % 3) * 256 + (i % 4) * 16) },
  sequential: { label: "Scan through 8 pages", gen: n => Array.from({ length: n }, (_, i) => Math.floor(i * 8 / n) * 256 + (i * 16) % 256) },
  thrash: { label: "Loop over 5 pages (more than fit)", gen: n => Array.from({ length: n }, (_, i) => (i % 5) * 256 + 8) },
  belady: { label: "Belady's sequence", gen: () => [1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5].map(p => p * 256 + 12) },
};
