// A tiny regex engine: parser, Thompson NFA construction and simulation, plus a naive backtracking matcher
// for comparison. Supports literals, ., |, *, +, ?, and ( ). Full-string matching. No DOM.

export function parse(src) {
  let i = 0;
  const peek = () => src[i], eat = c => { if (src[i] !== c) throw new Error(`expected '${c}' at ${i}`); i++; };
  function alt() { let n = cat(); while (peek() === "|") { i++; n = { t: "alt", a: n, b: cat() }; } return n; }
  function cat() {
    const parts = [];
    while (i < src.length && peek() !== "|" && peek() !== ")") parts.push(rep());
    if (!parts.length) return { t: "empty" };
    return parts.reduce((a, b) => ({ t: "cat", a, b }));
  }
  function rep() {
    let n = atom();
    while ("*+?".includes(peek() ?? "x")) { const op = src[i++]; n = { t: op === "*" ? "star" : op === "+" ? "plus" : "opt", a: n }; }
    return n;
  }
  function atom() {
    const c = src[i];
    if (c === "(") { i++; const n = alt(); eat(")"); return n; }
    if (c === undefined || "*+?)|".includes(c)) throw new Error(`unexpected '${c ?? "end"}' at ${i}`);
    i++;
    if (c === "\\") { const d = src[i++]; if (d === undefined) throw new Error("trailing backslash"); return { t: "lit", c: d }; }
    return c === "." ? { t: "any" } : { t: "lit", c };
  }
  const ast = alt();
  if (i !== src.length) throw new Error(`unexpected '${src[i]}' at ${i}`);
  return ast;
}

/** Thompson construction. Edges: {on: char | "any" | null(ε), to}. */
export function compile(ast) {
  const states = [];
  const S = () => { const s = { id: states.length, edges: [] }; states.push(s); return s; };
  const edge = (a, on, b) => a.edges.push({ on, to: b.id });
  function build(n) {
    switch (n.t) {
      case "empty": { const s = S(), e = S(); edge(s, null, e); return [s, e]; }
      case "lit": case "any": { const s = S(), e = S(); edge(s, n.t === "any" ? "any" : n.c, e); return [s, e]; }
      case "cat": { const [s1, e1] = build(n.a), [s2, e2] = build(n.b); edge(e1, null, s2); return [s1, e2]; }
      case "alt": { const s = S(), [s1, e1] = build(n.a), [s2, e2] = build(n.b), e = S(); edge(s, null, s1); edge(s, null, s2); edge(e1, null, e); edge(e2, null, e); return [s, e]; }
      case "star": { const s = S(), [s1, e1] = build(n.a), e = S(); edge(s, null, s1); edge(s, null, e); edge(e1, null, s1); edge(e1, null, e); return [s, e]; }
      case "plus": { const s = S(), [s1, e1] = build(n.a), e = S(); edge(s, null, s1); edge(e1, null, s1); edge(e1, null, e); return [s, e]; }
      case "opt": { const s = S(), [s1, e1] = build(n.a), e = S(); edge(s, null, s1); edge(s, null, e); edge(e1, null, e); return [s, e]; }
    }
  }
  const [start, accept] = build(ast);
  return { states, start: start.id, accept: accept.id };
}

export function closure(nfa, set) {
  const out = new Set(set), stack = [...set];
  while (stack.length) { const s = stack.pop(); for (const e of nfa.states[s].edges) if (e.on === null && !out.has(e.to)) { out.add(e.to); stack.push(e.to); } }
  return out;
}

/** Run the NFA, keeping the set of all states it could be in. Returns each step so a UI can replay it. */
export function simulate(nfa, input) {
  let cur = closure(nfa, [nfa.start]); const steps = [{ i: 0, ch: null, active: [...cur] }]; let work = cur.size;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i], next = new Set();
    for (const s of cur) for (const e of nfa.states[s].edges) if (e.on !== null && (e.on === "any" || e.on === ch)) next.add(e.to);
    cur = closure(nfa, next); work += cur.size;
    steps.push({ i: i + 1, ch, active: [...cur] });
    if (!cur.size) break;
  }
  return { matched: cur.has(nfa.accept) && steps.at(-1).i === input.length, steps, work };
}

/** Naive recursive backtracking over the AST (how many real-world engines work). Counts every attempt. */
export function backtrack(ast, input, limit = 2e6) {
  let steps = 0;
  const over = () => { if (++steps > limit) throw new Error("limit"); };
  // m(node, i, k): try to match node at i, then call continuation k(j)
  function m(n, i, k) {
    over();
    switch (n.t) {
      case "empty": return k(i);
      case "lit": return i < input.length && input[i] === n.c && k(i + 1);
      case "any": return i < input.length && k(i + 1);
      case "cat": return m(n.a, i, j => m(n.b, j, k));
      case "alt": return m(n.a, i, k) || m(n.b, i, k);
      case "opt": return m(n.a, i, k) || k(i);
      case "star": { const loop = j => m(n.a, j, j2 => j2 > j && loop(j2)) || k(j); return loop(i); }
      case "plus": return m(n.a, i, j => m({ t: "star", a: n.a }, j, k));
    }
  }
  try { return { matched: !!m(ast, 0, j => j === input.length), steps, gaveUp: false }; }
  catch { return { matched: null, steps, gaveUp: true }; }
}
