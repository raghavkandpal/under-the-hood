// Hindley–Milner type inference for a toy language: generate constraints, solve them by unification. No DOM.
import { mulberry } from "../../shared/random.js";

export const PROGRAMS = [
  { name: "identity", src: "fun x -> x" },
  { name: "const", src: "fun x -> fun y -> x" },
  { name: "compose", src: "fun f -> fun g -> fun x -> f (g x)" },
  { name: "add one", src: "fun x -> x + 1" },
  { name: "bad if", src: "if true then 1 else false" },
  { name: "self-apply", src: "fun x -> x x" },
  { name: "let", src: "let id = fun x -> x in let a = id 0 in id true" },
  { name: "parameter", src: "(fun id -> let a = id 0 in id true) (fun x -> x)" },
];
export const SHUFFLES = 20;
export const MAX_SOURCE = 300, MAX_TYPE = 200; // the longest built-in is 62 characters; types can otherwise double with every let

class Fail extends Error {}

// ---------- parsing: fun/let/if reach as far right as they can; application binds tighter than +
const KEYWORDS = ["fun", "let", "in", "if", "then", "else", "true", "false"];
function lex(src) {
  const out = [], re = /\s*(->|[-+=()]|\d[\w']*|[a-z_][A-Za-z0-9_']*|\S)/gy;
  let m;
  while (re.lastIndex < src.length && (m = re.exec(src))) out.push(m[1]);
  return out;
}
export function parse(src) {
  const toks = lex(src.trim());
  let i = 0;
  const peek = () => toks[i], next = () => toks[i++];
  const want = t => { if (peek() !== t) throw new Fail(`parse error: expected ${t}, found ${peek() ?? "the end"}`); i++; };
  const ident = () => { const t = next(); if (!t || !/^[a-z_]/.test(t) || KEYWORDS.includes(t)) throw new Fail(`parse error: expected a name, found ${t ?? "the end"}`); return t; };
  function expr() {
    if (peek() === "fun") { i++; const x = ident(); want("->"); return { k: "fun", x, body: expr() }; }
    if (peek() === "let") { i++; const x = ident(); want("="); const e1 = expr(); want("in"); return { k: "let", x, e1, e2: expr() }; }
    if (peek() === "if") { i++; const c = expr(); want("then"); const t = expr(); want("else"); return { k: "if", c, t, e: expr() }; }
    let l = app();
    while (peek() === "+") { i++; l = { k: "add", l, r: app() }; }
    return l;
  }
  const startsAtom = t => t !== undefined && (/^(\d|[a-z_(])/.test(t)) && !["in", "then", "else", "fun", "let", "if"].includes(t);
  function app() { let f = atom(); while (startsAtom(peek())) f = { k: "app", f, a: atom() }; return f; }
  function atom() {
    const t = next();
    if (t === undefined) throw new Fail("parse error: the program ends too early");
    if (/^\d+$/.test(t)) return { k: "int", v: +t };
    if (t === "true" || t === "false") return { k: "bool", v: t === "true" };
    if (t === "(") { const e = expr(); want(")"); return e; }
    if (/^[a-z_]/.test(t) && !KEYWORDS.includes(t)) return { k: "var", name: t };
    throw new Fail(`parse error: unexpected ${t}`);
  }
  if (!toks.length) throw new Fail("parse error: the program is empty");
  const e = expr();
  if (i < toks.length) throw new Fail(`parse error: unexpected ${peek()}`);
  return e;
}

// ---------- types: {t:"int"} {t:"bool"} {t:"v", id} {t:"fn", a, b}
const INT = { t: "int" }, BOOL = { t: "bool" };
const fn = (a, b) => ({ t: "fn", a, b });

/** Print types sharing one renaming: variables become 'a, 'b, … in order of first appearance. */
export function show(types, raw = false) {
  const names = new Map();
  const name = id => raw ? `t${id}` : (names.has(id) || names.set(id, "'" + (names.size < 26 ? String.fromCharCode(97 + names.size) : `t${names.size}`)), names.get(id));
  const go = (t, left) => t.t === "v" ? name(t.id) : t.t === "fn" ? (left ? `(${go(t.a, true)} -> ${go(t.b, false)})` : `${go(t.a, true)} -> ${go(t.b, false)}`) : t.t;
  return types.map(t => go(t, false));
}
const showOne = t => show([t])[0];

// ---------- inference
/**
 * infer(src, { occurs, seed }): constraints are generated, then solved by unification in the generated order
 * (seed 0) or in a seeded shuffle. A let solves its own constraints first, so its name can be generalised.
 * With occurs false, the first binding that makes a variable contain itself stops the run.
 */
export function infer(src, { occurs = true, seed = 0 } = {}) {
  const res = { ok: false, type: null, error: null, constraints: [], bindings: [], shuffleable: false };
  if (src.length > MAX_SOURCE) { res.error = `too long: programs are limited to ${MAX_SOURCE} characters here`; return res; }
  let ast;
  try { ast = parse(src); } catch (e) { if (e instanceof Fail) { res.error = e.message; return res; } throw e; }
  const sub = new Map(), rnd = mulberry(seed);
  let n = 0;
  const fresh = () => ({ t: "v", id: ++n });
  const walk = t => { while (t.t === "v" && sub.has(t.id)) t = sub.get(t.id); return t; };
  const apply = t => { t = walk(t); return t.t === "fn" ? fn(apply(t.a), apply(t.b)) : t; };
  const occursIn = (id, t) => { t = walk(t); return t.t === "v" ? t.id === id : t.t === "fn" && (occursIn(id, t.a) || occursIn(id, t.b)); };
  const rank = t => ({ int: 0, bool: 1, fn: 2 })[t.t];
  const raw = t => show([t], true)[0];
  // Node count of t with substitutions applied, stopping once it passes MAX_TYPE so a huge type is never built.
  const tooBig = t => { let n = 0; const go = u => { u = walk(u); if (++n > MAX_TYPE) return true; return u.t === "fn" && (go(u.a) || go(u.b)); }; return go(t); };
  const bind = (v, t) => {
    if (tooBig(t)) throw new Fail(`type too large: more than ${MAX_TYPE} parts, so inference stops`);
    const cyclic = occursIn(v.id, t);
    if (cyclic && occurs) { const [a, b] = show([v, apply(t)]); throw new Fail(`occurs check: ${a} would have to equal ${b}`); }
    res.bindings.push(`${raw(v)} := ${raw(apply(t))}`);
    sub.set(v.id, t);
    if (cyclic) throw new Fail(`unchecked: ${raw(v)} is now bound to a type containing ${raw(v)}`);
  };
  function unify(a, b) {
    a = walk(a); b = walk(b);
    if (a.t === "v" && b.t === "v" && a.id === b.id) return;
    if (a.t === "v") return bind(a, b);
    if (b.t === "v") return bind(b, a);
    if (a.t === "fn" && b.t === "fn") { unify(a.a, b.a); return unify(a.b, b.b); }
    if (a.t === b.t) return;
    const [x, y] = rank(a) <= rank(b) ? [a, b] : [b, a], [p, q] = show([apply(x), apply(y)]);
    throw new Fail(`cannot unify ${p} with ${q}`);
  }
  const solve = list => {
    const order = list.map(([a, b]) => [a, b]);
    if (list.length > 1) res.shuffleable = true;
    if (seed) for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    for (const [a, b] of order) { res.constraints.push(`${raw(apply(a))} = ${raw(apply(b))}`); unify(a, b); }
  };
  const free = (t, out = new Set()) => { t = walk(t); if (t.t === "v") out.add(t.id); else if (t.t === "fn") { free(t.a, out); free(t.b, out); } return out; };
  const instantiate = ({ vars, type }) => {
    const m = new Map(vars.map(id => [id, fresh()]));
    const go = t => { t = walk(t); return t.t === "v" ? m.get(t.id) ?? t : t.t === "fn" ? fn(go(t.a), go(t.b)) : t; };
    return go(type);
  };
  function gen(env, e, cs) {
    switch (e.k) {
      case "int": return INT;
      case "bool": return BOOL;
      case "var": {
        if (!env.has(e.name)) throw new Fail(`unbound variable ${e.name}`);
        return instantiate(env.get(e.name));
      }
      case "add": { cs.push([gen(env, e.l, cs), INT], [gen(env, e.r, cs), INT]); return INT; }
      case "if": { const t = gen(env, e.t, cs); cs.push([gen(env, e.c, cs), BOOL], [t, gen(env, e.e, cs)]); return t; }
      case "fun": { const x = fresh(); return fn(x, gen(new Map(env).set(e.x, { vars: [], type: x }), e.body, cs)); }
      case "app": { const f = gen(env, e.f, cs), a = gen(env, e.a, cs), r = fresh(); cs.push([f, fn(a, r)]); return r; }
      case "let": {
        const inner = [], t1 = gen(env, e.e1, inner);
        solve(inner);
        const inEnv = new Set();
        for (const s of env.values()) for (const id of free(s.type)) if (!s.vars.includes(id)) inEnv.add(id);
        const vars = [...free(t1)].filter(id => !inEnv.has(id));
        return gen(new Map(env).set(e.x, { vars, type: apply(t1) }), e.e2, cs);
      }
    }
  }
  try {
    const outer = [], t = gen(new Map(), ast, outer);
    solve(outer);
    res.ok = true; res.type = showOne(apply(t));
  } catch (e) { if (e instanceof Fail) res.error = e.message; else throw e; }
  return res;
}

/** How many of the SHUFFLES seeded orders (seeds 1…20) agree with the generated order on succeeding and, if so, on the type. Failures agree with each other whatever their message. */
export function agreement(src, occurs = true) {
  const key = r => r.ok ? "type " + r.type : "fail", base = key(infer(src, { occurs }));
  let same = 0;
  for (let s = 1; s <= SHUFFLES; s++) if (key(infer(src, { occurs, seed: s })) === base) same++;
  return same;
}

/** Everything the page shows for one program: stat tiles, the two lists and the status line. */
export function view(src, opts = {}) {
  const r = infer(src, opts);
  return {
    r,
    tiles: [[r.ok ? r.type : "none", "type"], [r.constraints.length, "constraints tried"], [r.bindings.length, "variables bound"], [r.shuffleable ? `${agreement(src, opts.occurs ?? true)} of ${SHUFFLES}` : "n/a", "orders agree"]],
    constraints: r.constraints,
    bindings: r.bindings,
    status: r.error ?? "",
  };
}

export const orderLabel = seed => seed ? `shuffle ${seed}` : "as generated";
