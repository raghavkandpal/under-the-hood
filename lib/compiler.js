// A tiny compiler for arithmetic with variables: tokens → AST (recursive descent) → stack bytecode → VM. No DOM.
// Grammar:  program := (stmt ';'?)*   stmt := IDENT '=' expr | expr
//           expr := term (('+'|'-') term)*   term := unary (('*'|'/'|'%') unary)*
//           unary := '-' unary | power       power := atom ('^' unary)?
//           atom := NUMBER | IDENT | '(' expr ')'

export function tokenize(src) {
  const out = []; let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.]/.test(c)) { let j = i; while (j < src.length && /[0-9.]/.test(src[j])) j++; const t = src.slice(i, j); if (isNaN(+t)) throw new SyntaxError(`bad number '${t}' at ${i}`); out.push({ t: "num", v: +t, at: i }); i = j; continue; }
    if (/[A-Za-z_]/.test(c)) { let j = i; while (j < src.length && /\w/.test(src[j])) j++; out.push({ t: "id", v: src.slice(i, j), at: i }); i = j; continue; }
    if ("+-*/%^()=;".includes(c)) { out.push({ t: c, at: i }); i++; continue; }
    throw new SyntaxError(`unexpected '${c}' at position ${i}`);
  }
  out.push({ t: "eof", at: src.length });
  return out;
}

export function parse(tokens) {
  let p = 0; const peek = () => tokens[p], next = () => tokens[p++];
  const expect = t => { if (peek().t !== t) throw new SyntaxError(`expected '${t}' at position ${peek().at}, got '${peek().t === "eof" ? "end" : peek().v ?? peek().t}'`); return next(); };
  function program() { const body = []; while (peek().t !== "eof") { body.push(stmt()); if (peek().t === ";") next(); } return { k: "prog", body }; }
  function stmt() { if (peek().t === "id" && tokens[p + 1].t === "=") { const name = next().v; next(); return { k: "assign", name, value: expr() }; } return { k: "exprstmt", value: expr() }; }
  function expr() { let n = term(); while (["+", "-"].includes(peek().t)) { const op = next().t; n = { k: "bin", op, l: n, r: term() }; } return n; }
  function term() { let n = unary(); while (["*", "/", "%"].includes(peek().t)) { const op = next().t; n = { k: "bin", op, l: n, r: unary() }; } return n; }
  function unary() { if (peek().t === "-") { next(); return { k: "neg", a: unary() }; } return power(); }
  function power() { const b = atom(); if (peek().t === "^") { next(); return { k: "bin", op: "^", l: b, r: unary() }; } return b; } // right-associative
  function atom() {
    const t = peek();
    if (t.t === "num") { next(); return { k: "num", v: t.v }; }
    if (t.t === "id") { next(); return { k: "var", name: t.v }; }
    if (t.t === "(") { next(); const e = expr(); expect(")"); return e; }
    throw new SyntaxError(`expected a number, name or '(' at position ${t.at}`);
  }
  return program();
}

/** Constant folding: evaluate sub-trees with no variables at compile time. */
export function fold(n) {
  if (n.k === "prog") return { ...n, body: n.body.map(fold) };
  if (n.k === "assign" || n.k === "exprstmt") return { ...n, value: fold(n.value) };
  if (n.k === "neg") { const a = fold(n.a); return a.k === "num" ? { k: "num", v: -a.v } : { ...n, a }; }
  if (n.k === "bin") { const l = fold(n.l), r = fold(n.r); return l.k === "num" && r.k === "num" ? { k: "num", v: OPS[n.op](l.v, r.v) } : { ...n, l, r }; }
  return n;
}
export const OPS = { "+": (a, b) => a + b, "-": (a, b) => a - b, "*": (a, b) => a * b, "/": (a, b) => a / b, "%": (a, b) => a % b, "^": (a, b) => a ** b };

export function compile(ast) {
  const code = [];
  (function emit(n) {
    switch (n.k) {
      case "prog": n.body.forEach(emit); break;
      case "assign": emit(n.value); code.push(["STORE", n.name]); break;
      case "exprstmt": emit(n.value); code.push(["PRINT"]); break;
      case "num": code.push(["PUSH", n.v]); break;
      case "var": code.push(["LOAD", n.name]); break;
      case "neg": emit(n.a); code.push(["NEG"]); break;
      case "bin": emit(n.l); emit(n.r); code.push([{ "+": "ADD", "-": "SUB", "*": "MUL", "/": "DIV", "%": "MOD", "^": "POW" }[n.op]]); break;
    }
  })(ast);
  return code;
}

/** Run bytecode; returns printed values, final variables and a step-by-step trace of the stack. */
export function run(code, vars = {}) {
  const stack = [], out = [], env = { ...vars }, trace = [];
  const bin = { ADD: OPS["+"], SUB: OPS["-"], MUL: OPS["*"], DIV: OPS["/"], MOD: OPS["%"], POW: OPS["^"] };
  for (const [op, arg] of code) {
    if (op === "PUSH") stack.push(arg);
    else if (op === "LOAD") { if (!(arg in env)) throw new ReferenceError(`'${arg}' is not defined`); stack.push(env[arg]); }
    else if (op === "STORE") env[arg] = stack.pop();
    else if (op === "PRINT") out.push(stack.pop());
    else if (op === "NEG") stack.push(-stack.pop());
    else { const b = stack.pop(), a = stack.pop(); stack.push(bin[op](a, b)); }
    trace.push({ op, arg, stack: stack.slice() });
  }
  return { out, env, trace };
}
