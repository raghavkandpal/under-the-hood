// Expected tree height, shared by the B-tree and index pages. No DOM.

/** Expected height for n keys with fan-out f: about log_f(n). */
export const heightFor = (n, fanout) => Math.max(1, Math.ceil(Math.log(n + 1) / Math.log(fanout)));
