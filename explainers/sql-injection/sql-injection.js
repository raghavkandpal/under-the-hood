// SQL injection: a tiny SQL subset, evaluated against an in-memory table, built two ways. No DOM.
// Supported: SELECT * FROM users WHERE <expr>, with = and != comparisons, AND, OR, parentheses,
// 'string' literals ('' escapes a quote), numbers, ? placeholders, and -- comments.

const KEYWORDS = new Set(["SELECT", "FROM", "WHERE", "AND", "OR"]);

/** Split SQL into tokens with their character positions. Returns { tokens } or { error }. */
export function tokenize(sql) {
  const tokens = []; let i = 0;
  while (i < sql.length) {
    const c = sql[i];
    if (/\s/.test(c)) { i++; continue; }
    if (sql.startsWith("--", i)) { tokens.push({ type: "comment", text: sql.slice(i), start: i, end: sql.length }); break; }
    if (c === "'") {
      let j = i + 1, val = "";
      for (;;) {
        if (j >= sql.length) return { error: `unterminated string starting at character ${i + 1}`, tokens };
        if (sql[j] === "'" && sql[j + 1] === "'") { val += "'"; j += 2; continue; }
        if (sql[j] === "'") break;
        val += sql[j++];
      }
      tokens.push({ type: "string", value: val, text: sql.slice(i, j + 1), start: i, end: j + 1 }); i = j + 1; continue;
    }
    if (/[0-9]/.test(c)) { let j = i; while (/[0-9]/.test(sql[j] || "")) j++; tokens.push({ type: "number", value: +sql.slice(i, j), text: sql.slice(i, j), start: i, end: j }); i = j; continue; }
    if (/[A-Za-z_*]/.test(c)) {
      let j = i; while (/[A-Za-z0-9_*]/.test(sql[j] || "")) j++;
      const w = sql.slice(i, j); tokens.push({ type: KEYWORDS.has(w.toUpperCase()) ? "keyword" : "ident", value: w, text: w, start: i, end: j }); i = j; continue;
    }
    if (sql.startsWith("!=", i)) { tokens.push({ type: "op", value: "!=", text: "!=", start: i, end: i + 2 }); i += 2; continue; }
    if ("=(),;?".includes(c)) { tokens.push({ type: c === "?" ? "param" : "op", value: c, text: c, start: i, end: i + 1 }); i++; continue; }
    return { error: `unexpected character "${c}" at ${i + 1}`, tokens };
  }
  return { tokens };
}

/** Run a query against `table`. `params` fill ? placeholders in order, always as values, never as SQL. */
export function evaluate(sql, table, params = []) {
  const t = tokenize(sql); if (t.error) return { error: t.error };
  const toks = t.tokens.filter(x => x.type !== "comment" && !(x.type === "op" && x.value === ";"));
  let p = 0, pi = 0;
  const peek = () => toks[p], kw = w => peek()?.type === "keyword" && peek().value.toUpperCase() === w;
  const expect = (cond, what) => { if (!cond) throw new Error(`expected ${what} near "${peek()?.text ?? "end of query"}"`); return toks[p++]; };
  try {
    expect(kw("SELECT"), "SELECT"); expect(peek()?.value === "*", "*"); expect(kw("FROM"), "FROM");
    const tbl = expect(peek()?.type === "ident", "table name").value;
    if (tbl !== "users") throw new Error(`no such table: ${tbl}`);
    let where = () => true;
    if (kw("WHERE")) { p++; where = parseOr(); }
    if (p < toks.length) throw new Error(`unexpected "${peek().text}"`);
    return { rows: table.filter(row => where(row)) };
  } catch (e) { return { error: e.message }; }

  function parseOr() { let l = parseAnd(); while (kw("OR")) { p++; const a = l, b = parseAnd(); l = r => a(r) || b(r); } return l; }
  function parseAnd() { let l = parseCmp(); while (kw("AND")) { p++; const a = l, b = parseCmp(); l = r => a(r) && b(r); } return l; }
  function parseCmp() {
    if (peek()?.value === "(") { p++; const e = parseOr(); expect(peek()?.value === ")", ")"); return e; }
    const a = operand(), op = expect(peek()?.type === "op" && (peek().value === "=" || peek().value === "!="), "= or !=").value, b = operand();
    return r => (op === "=" ? a(r) === b(r) : a(r) !== b(r));
  }
  function operand() {
    const tk = toks[p++]; if (!tk) throw new Error("query ended too early");
    if (tk.type === "string" || tk.type === "number") return () => String(tk.value);
    if (tk.type === "param") { if (pi >= params.length) throw new Error("not enough parameters"); const v = String(params[pi++]); return () => v; }
    if (tk.type === "ident") return r => { if (!(tk.value in r)) throw new Error(`no such column: ${tk.value}`); return String(r[tk.value]); };
    throw new Error(`unexpected "${tk.text}"`);
  }
}

/** The vulnerable way: paste user input straight into the SQL text. Also returns where the input landed. */
export function buildConcat(user, pass) {
  const a = "SELECT * FROM users WHERE username = '", b = "' AND password = '", c = "'";
  const sql = a + user + b + pass + c;
  return { sql, params: [], spans: [[a.length, a.length + user.length], [a.length + user.length + b.length, a.length + user.length + b.length + pass.length]] };
}

/** The safe way: the SQL text is fixed; input travels separately as parameters. */
export function buildParam(user, pass) { return { sql: "SELECT * FROM users WHERE username = ? AND password = ?", params: [user, pass], spans: [] }; }

/** Did any part of the user's input get read as SQL syntax rather than inside a string literal? */
export function inputBecameCode(sql, spans) {
  const t = tokenize(sql);
  for (const tk of t.tokens) {
    if (tk.type === "string") continue;
    if (spans.some(([s, e]) => tk.start < e && tk.end > s)) return true;
  }
  return !!t.error && spans.some(([s, e]) => e > s);
}

export const USERS = [
  { id: 1, username: "alice", password: "correct-horse", role: "admin" },
  { id: 2, username: "bob", password: "hunter2", role: "user" },
  { id: 3, username: "O'Brien", password: "shamrock", role: "user" },
];
