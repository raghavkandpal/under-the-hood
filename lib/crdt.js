// State-based CRDTs: a PN-counter and an add-wins observed-remove set, plus a naive baseline. No DOM.

export const PNCounter = {
  empty: () => ({ p: {}, n: {} }),
  inc: (s, id, by = 1) => ({ p: { ...s.p, [id]: (s.p[id] || 0) + by }, n: { ...s.n } }),
  dec: (s, id, by = 1) => ({ p: { ...s.p }, n: { ...s.n, [id]: (s.n[id] || 0) + by } }),
  value: s => Object.values(s.p).reduce((a, b) => a + b, 0) - Object.values(s.n).reduce((a, b) => a + b, 0),
  merge: (a, b) => {
    const mx = (x, y) => Object.fromEntries([...new Set([...Object.keys(x), ...Object.keys(y)])].map(k => [k, Math.max(x[k] || 0, y[k] || 0)]));
    return { p: mx(a.p, b.p), n: mx(a.n, b.n) };
  },
};

/** OR-Set: each add gets a unique tag; remove deletes only the tags it has seen. Concurrent add + remove → add wins. */
export const ORSet = {
  empty: () => ({ adds: {}, removed: [] }), // adds: item -> [tags]; removed: [tags]
  add: (s, item, tag) => ({ adds: { ...s.adds, [item]: [...(s.adds[item] || []), tag] }, removed: s.removed.slice() }),
  remove: (s, item) => ({ adds: { ...s.adds }, removed: [...new Set([...s.removed, ...(s.adds[item] || [])])] }),
  value: s => Object.keys(s.adds).filter(item => s.adds[item].some(t => !s.removed.includes(t))).sort(),
  merge: (a, b) => {
    const items = new Set([...Object.keys(a.adds), ...Object.keys(b.adds)]), adds = {};
    for (const it of items) adds[it] = [...new Set([...(a.adds[it] || []), ...(b.adds[it] || [])])];
    return { adds, removed: [...new Set([...a.removed, ...b.removed])] };
  },
};

/** The naive way: each replica keeps a plain value with a timestamp; merge keeps the newer whole value. */
export const Naive = {
  empty: () => ({ count: 0, items: [], t: 0 }),
  inc: (s, by, t) => ({ ...s, count: s.count + by, t }),
  add: (s, item, t) => ({ ...s, items: [...new Set([...s.items, item])].sort(), t }),
  remove: (s, item, t) => ({ ...s, items: s.items.filter(x => x !== item), t }),
  merge: (a, b) => (b.t > a.t ? { ...b } : { ...a }),
};

export const equalState = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
function canon(x) { if (Array.isArray(x)) return x.map(canon).sort(); if (x && typeof x === "object") return Object.fromEntries(Object.keys(x).sort().map(k => [k, canon(x[k])])); return x; }
