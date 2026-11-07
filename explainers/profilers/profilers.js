// A sampling profiler: interrupt a program at random moments, record its call stack, and add the stacks up. No DOM.

/** A made-up program: each call has its own (self) time in ms and the calls it makes. */
export const PROGRAM = ["main", 2, [
  ["loadConfig", 3, [["parseJson", 6, []]]],
  ["handleRequests", 4, [
    ["routeRequest", 2, [
      ["renderPage", 18, [["escapeHtml", 9, []]]],
      ["queryDb", 5, [["parseJson", 22, []]]]]],
    ["logRequest", 3, [["formatTime", 6, []]]]]],
]];

/** Flatten into time segments, each with the full stack that is running during it. */
export function segments(node = PROGRAM, stack = []) {
  const [name, self, kids] = node, s = [...stack, name];
  return [{ stack: s, ms: self }, ...kids.flatMap(k => segments(k, s))];
}
export const totalMs = () => segments().reduce((a, x) => a + x.ms, 0);
/** True share of time each function spends running its own code. */
export function trueSelf() { const out = {}, T = totalMs(); for (const { stack, ms } of segments()) out[stack.at(-1)] = (out[stack.at(-1)] ?? 0) + ms / T; return out; }

/** Take n samples at random moments. */
export function sample(n, rnd) {
  const segs = segments(), T = totalMs();
  return Array.from({ length: n }, () => { let t = rnd() * T; for (const s of segs) { if (t < s.ms) return s.stack; t -= s.ms; } return segs.at(-1).stack; });
}
/** Merge stacks into a flame graph tree: { name, count, children }. */
export function flame(stacks) {
  const root = { name: "all", count: 0, children: [] };
  for (const st of stacks) { root.count++; let n = root; for (const f of st) { let c = n.children.find(x => x.name === f); if (!c) n.children.push(c = { name: f, count: 0, children: [] }); c.count++; n = c; } }
  return root;
}
/** Samples whose top frame is each function: where the time is actually spent. */
export function selfCounts(stacks) { const out = {}; for (const s of stacks) out[s.at(-1)] = (out[s.at(-1)] ?? 0) + 1; return out; }
