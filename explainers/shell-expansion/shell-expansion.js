// Shell quoting and globs: a toy expander for $var, "...", '...', * and ?, with no DOM so Node can test it.

export const DIR = ["-l", ".hidden.txt", "a.txt", "b.txt", "notes.md"]; // C-locale order: "-" < "." < letters
export const VARS = { file: "my notes.txt" }; // `empty` and anything else is unset
const IFS = " \t\n"; // default IFS; changing it is out of scope

/** Does name match pattern? pat is [{ch, q}]: only unquoted * and ? are wild, and a leading dot needs a literal dot. */
function matches(pat, name) {
  if (name[0] === "." && !(pat[0] && pat[0].ch === "." )) return false;
  const go = (p, i) => {
    if (p === pat.length) return i === name.length;
    const { ch, q } = pat[p];
    if (!q && ch === "*") return [...name.slice(i)].some((_, k) => go(p + 1, i + k)) || go(p + 1, name.length);
    if (!q && ch === "?") return i < name.length && go(p + 1, i + 1);
    return name[i] === ch && go(p + 1, i + 1);
  };
  return go(0, 0);
}

/** Expand one command line to the argument list the program receives, or { error }. */
export function expand(line, vars = VARS, dir = DIR) {
  const argv = [];
  let word = [], quoted = false; // quoted: the word has a quote pair, so it survives even if empty
  const flush = () => {
    if (word.length || quoted) argv.push(globWord(word, dir));
    word = []; quoted = false;
  };
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === "'" || c === '"') {
      const end = line.indexOf(c, i + 1);
      if (end < 0) return { error: `missing closing ${c}` };
      quoted = true;
      let body = line.slice(i + 1, end);
      if (c === '"') body = body.replace(/\$(\w+)/g, (_, n) => vars[n] ?? "");
      for (const ch of body) word.push({ ch, q: true });
      i = end;
    } else if (c === "$" && /\w/.test(line[i + 1] ?? "")) {
      const name = /^\w+/.exec(line.slice(i + 1))[0];
      i += name.length;
      for (const ch of vars[name] ?? "") { // word splitting: unquoted results only
        if (IFS.includes(ch)) flush(); else word.push({ ch, q: false });
      }
    } else if (IFS.includes(c)) flush();
    else word.push({ ch: c, q: false });
  }
  flush();
  return { argv: argv.flat() };
}

// shortcut: only a leading "./" directory part is understood, upgrade when the page needs paths
function globWord(word, dir) {
  const wild = word.some(w => !w.q && (w.ch === "*" || w.ch === "?"));
  const text = word.map(w => w.ch).join("");
  if (!wild) return [text];
  const dot = text.startsWith("./") && !word[0].q && !word[1].q;
  const hits = dir.filter(n => matches(dot ? word.slice(2) : word, n)).map(n => (dot ? "./" : "") + n);
  return hits.length ? hits : [text]; // no match: the pattern stays as typed
}

/** Arguments of a command: argv without the program name. */
export const args = (line, vars, dir) => { const r = expand(line, vars, dir); return r.error ? r : { args: r.argv.slice(1) }; };
