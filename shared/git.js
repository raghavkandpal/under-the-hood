// A tiny in-memory Git that uses Git's real object formats and SHA-1,
// so blob/tree/commit hashes match real `git` for the same content and metadata.

// ---------- SHA-1 (sync, small) ----------
export function sha1(bytes) {
  const ml = bytes.length;
  const withPad = new Uint8Array(((ml + 9 + 63) >> 6) << 6);
  withPad.set(bytes); withPad[ml] = 0x80;
  const dv = new DataView(withPad.buffer);
  const bits = ml * 8;
  dv.setUint32(withPad.length - 8, Math.floor(bits / 2 ** 32));
  dv.setUint32(withPad.length - 4, bits >>> 0);
  let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;
  const w = new Uint32Array(80);
  for (let off = 0; off < withPad.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
    for (let i = 16; i < 80; i++) { const x = w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16]; w[i] = (x << 1) | (x >>> 31); }
    let a = h0, b = h1, c = h2, d = h3, e = h4;
    for (let i = 0; i < 80; i++) {
      let f, k;
      if (i < 20) { f = (b & c) | (~b & d); k = 0x5a827999; }
      else if (i < 40) { f = b ^ c ^ d; k = 0x6ed9eba1; }
      else if (i < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8f1bbcdc; }
      else { f = b ^ c ^ d; k = 0xca62c1d6; }
      const t = (((a << 5) | (a >>> 27)) + f + e + k + w[i]) >>> 0;
      e = d; d = c; c = (b << 30) | (b >>> 2); b = a; a = t;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0;
  }
  return [h0, h1, h2, h3, h4].map(x => x.toString(16).padStart(8, "0")).join("");
}

const enc = new TextEncoder();
const concat = parts => { const n = parts.reduce((s, p) => s + p.length, 0); const o = new Uint8Array(n); let i = 0; for (const p of parts) { o.set(p, i); i += p.length; } return o; };
const hexToBytes = h => Uint8Array.from(h.match(/../g), x => parseInt(x, 16));

export function hashObject(type, body) {
  const b = typeof body === "string" ? enc.encode(body) : body;
  return sha1(concat([enc.encode(`${type} ${b.length}\0`), b]));
}

// ---------- shell-ish tokenizer ----------
export function tokenize(line) {
  const out = []; let cur = "", q = null, has = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === q) q = null; else if (ch === "\\" && q === '"' && i + 1 < line.length) cur += line[++i]; else cur += ch; continue; }
    if (ch === '"' || ch === "'") { q = ch; has = true; continue; }
    if (/\s/.test(ch)) { if (cur || has) out.push(cur); cur = ""; has = false; continue; }
    if (ch === ">") { if (cur || has) out.push(cur); cur = ""; has = false; if (line[i + 1] === ">") { out.push(">>"); i++; } else out.push(">"); continue; }
    cur += ch;
  }
  if (q) throw new Error("unterminated quote");
  if (cur || has) out.push(cur);
  return out;
}

// ---------- the repo ----------
export class Repo {
  constructor({ author = "You <you@example.com>", startTime = 1767225600 } = {}) {
    this.objects = new Map();        // sha -> { type, text, data }
    this.order = [];                 // creation order of shas
    this.work = new Map();           // path -> content
    this.index = new Map();          // path -> blob sha
    this.refs = new Map([["main", null]]);
    this.head = { ref: "main" };     // or { sha }
    this.mergeHead = null;
    this.author = author;
    this.time = startTime;
  }

  // --- objects ---
  put(type, bytes, text, data) {
    const sha = hashObject(type, bytes);
    if (!this.objects.has(sha)) { this.objects.set(sha, { type, text, data, size: bytes.length }); this.order.push(sha); }
    return sha;
  }
  blob(content) { const b = enc.encode(content); return this.put("blob", b, content, { content }); }
  tree(entries) {
    // entries: [{ mode, name, sha, type }]
    const sorted = entries.slice().sort((a, b) => {
      const ka = a.type === "tree" ? a.name + "/" : a.name, kb = b.type === "tree" ? b.name + "/" : b.name;
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
    const bytes = concat(sorted.flatMap(e => [enc.encode(`${e.mode} ${e.name}\0`), hexToBytes(e.sha)]));
    const text = sorted.map(e => `${e.mode.padStart(6, "0")} ${e.type} ${e.sha}\t${e.name}`).join("\n");
    return this.put("tree", bytes, text, { entries: sorted });
  }
  commitObj(tree, parents, message) {
    this.time += 60;
    const who = `${this.author} ${this.time} +0000`;
    const text = `tree ${tree}\n` + parents.map(p => `parent ${p}\n`).join("") + `author ${who}\ncommitter ${who}\n\n${message}\n`;
    return this.put("commit", enc.encode(text), text, { tree, parents, message, time: this.time });
  }

  // --- helpers ---
  headSha() { return this.head.ref ? this.refs.get(this.head.ref) : this.head.sha; }
  resolveRev(rev) {
    if (rev === "HEAD") return this.headSha();
    if (this.refs.has(rev)) return this.refs.get(rev);
    if (/^[0-9a-f]{4,40}$/.test(rev)) {
      const m = [...this.objects.keys()].filter(s => s.startsWith(rev));
      if (m.length === 1) return m[0];
      if (m.length > 1) throw new Error(`short SHA ${rev} is ambiguous`);
    }
    throw new Error(`unknown revision '${rev}'`);
  }
  flatten(treeSha, prefix = "", out = new Map()) {
    if (!treeSha) return out;
    for (const e of this.objects.get(treeSha).data.entries) {
      const p = prefix + e.name;
      if (e.type === "tree") this.flatten(e.sha, p + "/", out); else out.set(p, e.sha);
    }
    return out;
  }
  commitFiles(sha) { return sha ? this.flatten(this.objects.get(sha).data.tree) : new Map(); }
  treeFromIndex(index = this.index) {
    const root = new Map();
    for (const [path, sha] of index) {
      const parts = path.split("/"); let node = root;
      for (const dir of parts.slice(0, -1)) { if (!node.has(dir + "/")) node.set(dir + "/", new Map()); node = node.get(dir + "/"); }
      node.set(parts.at(-1), sha);
    }
    const build = node => this.tree([...node].map(([k, v]) => k.endsWith("/")
      ? { mode: "40000", name: k.slice(0, -1), sha: build(v), type: "tree" }
      : { mode: "100644", name: k, sha: v, type: "blob" }));
    return build(root);
  }
  ancestors(sha) {
    const seen = new Set(), stack = sha ? [sha] : [];
    while (stack.length) { const s = stack.pop(); if (seen.has(s)) continue; seen.add(s); stack.push(...this.objects.get(s).data.parents); }
    return seen;
  }
  mergeBase(a, b) {
    const A = this.ancestors(a);
    // BFS from b; first commit also in A whose descendants-in-A aren't closer. Good enough: newest by time.
    const common = [...this.ancestors(b)].filter(s => A.has(s));
    common.sort((x, y) => this.objects.get(y).data.time - this.objects.get(x).data.time);
    return common[0] ?? null;
  }
  status() {
    const headFiles = this.commitFiles(this.headSha());
    const staged = [], unstaged = [], untracked = [];
    for (const p of new Set([...headFiles.keys(), ...this.index.keys()])) {
      const h = headFiles.get(p), i = this.index.get(p);
      if (h !== i) staged.push(!h ? `new file:   ${p}` : !i ? `deleted:    ${p}` : `modified:   ${p}`);
    }
    for (const p of new Set([...this.index.keys(), ...this.work.keys()])) {
      const i = this.index.get(p), w = this.work.has(p) ? hashObject("blob", this.work.get(p)) : null;
      if (!i) { untracked.push(p); continue; }
      if (w !== i) unstaged.push(!w ? `deleted:    ${p}` : `modified:   ${p}`);
    }
    return { staged: staged.sort(), unstaged: unstaged.sort(), untracked: untracked.sort() };
  }
  isDirty() { const s = this.status(); return s.staged.length + s.unstaged.length > 0; }
  setHeadTo(sha) { if (this.head.ref) this.refs.set(this.head.ref, sha); else this.head.sha = sha; }
  loadCommit(sha) {
    const files = this.commitFiles(sha);
    this.index = new Map(files);
    for (const p of [...this.work.keys()]) if (!this.index.has(p) && this.wasTracked(p)) this.work.delete(p);
    for (const [p, b] of files) this.work.set(p, this.objects.get(b).data.content);
  }
  wasTracked(p) { return this.commitFiles(this.headSha()).has(p) || this.index.has(p); }

  // --- commands ---
  run(line) {
    const t = tokenize(line.trim());
    if (!t.length) return "";
    const [cmd, ...a] = t;
    if (cmd === "echo") {
      const op = a.findIndex(x => x === ">" || x === ">>");
      if (op < 0) return a.join(" ");
      const text = a.slice(0, op).join(" ") + "\n", file = a[op + 1];
      if (!file) throw new Error("echo: missing file after " + a[op]);
      this.work.set(file, (a[op] === ">>" ? this.work.get(file) ?? "" : "") + text);
      return "";
    }
    if (cmd === "cat") { if (!this.work.has(a[0])) throw new Error(`cat: ${a[0]}: No such file`); return this.work.get(a[0]).replace(/\n$/, ""); }
    if (cmd === "rm") { if (!this.work.delete(a[0])) throw new Error(`rm: ${a[0]}: No such file`); return ""; }
    if (cmd === "ls") return [...this.work.keys()].sort().join("\n");
    if (cmd !== "git") throw new Error(`${cmd}: command not found (try echo, cat, rm, ls, git)`);
    const [sub, ...r] = a;
    switch (sub) {
      case "add": return this.add(r);
      case "commit": {
        const mi = r.indexOf("-m"); if (r.includes("-a") || r.includes("-am")) this.add(["-u"]);
        const ami = r.indexOf("-am");
        const msg = mi >= 0 ? r[mi + 1] : ami >= 0 ? r[ami + 1] : null;
        if (!msg) throw new Error('commit needs a message: git commit -m "..."');
        return this.commit(msg);
      }
      case "branch": return r.length ? this.branch(r[0]) : [...this.refs.keys()].sort().map(b => (b === this.head.ref ? "* " : "  ") + b).join("\n");
      case "checkout": case "switch":
        if (r[0] === "-b" || r[0] === "-c") { this.branch(r[1]); return this.checkout(r[1]); }
        return this.checkout(r[0]);
      case "merge": return this.merge(r[0]);
      case "status": return this.statusText();
      case "log": return this.log();
      case "cat-file": { const sha = this.resolveRev(r.at(-1)); const o = this.objects.get(sha); return r[0] === "-t" ? o.type : o.text; }
      case "hash-object": { if (!this.work.has(r.at(-1))) throw new Error(`cannot open '${r.at(-1)}'`); return hashObject("blob", this.work.get(r.at(-1))); }
      default: throw new Error(`git: '${sub ?? ""}' isn't supported here. Try add, commit, status, log, branch, checkout, switch, merge, cat-file, hash-object`);
    }
  }
  add(paths) {
    if (!paths.length) throw new Error("Nothing specified, nothing added.");
    let targets;
    if (paths.includes(".") || paths.includes("-A")) targets = new Set([...this.work.keys(), ...this.index.keys()]);
    else if (paths.includes("-u")) targets = new Set(this.index.keys());
    else targets = new Set(paths);
    for (const p of targets) {
      if (this.work.has(p)) this.index.set(p, this.blob(this.work.get(p)));
      else if (this.index.has(p)) this.index.delete(p);
      else throw new Error(`pathspec '${p}' did not match any files`);
    }
    return "";
  }
  commit(msg) {
    if (!this.index.size && !this.headSha()) throw new Error("nothing to commit (create a file and git add it)");
    const tree = this.treeFromIndex();
    const parent = this.headSha();
    if (!this.mergeHead && parent && this.objects.get(parent).data.tree === tree) throw new Error("nothing to commit, working tree clean (did you git add?)");
    if (this.mergeHead && [...this.work.values()].some(c => c.includes("<<<<<<<"))) throw new Error("fix the conflict markers first, then git add and commit");
    const parents = [parent, this.mergeHead].filter(Boolean);
    const sha = this.commitObj(tree, parents, msg);
    this.setHeadTo(sha); this.mergeHead = null;
    return `[${this.head.ref ?? "detached HEAD"} ${sha.slice(0, 7)}] ${msg}`;
  }
  branch(name) {
    if (!name || !/^[\w./-]+$/.test(name)) throw new Error("invalid branch name");
    if (this.refs.has(name)) throw new Error(`a branch named '${name}' already exists`);
    const h = this.headSha(); if (!h) throw new Error("make a commit first. A branch has to point at something.");
    this.refs.set(name, h); return "";
  }
  checkout(rev) {
    if (!rev) throw new Error("checkout what?");
    if (this.mergeHead) throw new Error("finish or abort the merge first");
    const sha = this.resolveRev(rev);
    if (this.isDirty()) throw new Error("your local changes would be overwritten. Commit them first.");
    if (this.objects.get(sha)?.type !== "commit") throw new Error(`${rev} is not a commit`);
    this.loadCommit(sha);
    if (this.refs.has(rev)) { this.head = { ref: rev }; return `Switched to branch '${rev}'`; }
    this.head = { sha }; return `HEAD is now at ${sha.slice(0, 7)} (detached HEAD)`;
  }
  merge(rev) {
    if (!rev) throw new Error("merge what?");
    if (this.mergeHead) throw new Error("you're already in the middle of a merge");
    if (this.isDirty()) throw new Error("commit your changes before merging");
    const ours = this.headSha(), theirs = this.resolveRev(rev);
    if (!ours) throw new Error("nothing to merge into yet");
    if (this.ancestors(ours).has(theirs)) return "Already up to date.";
    if (this.ancestors(theirs).has(ours)) { this.loadCommit(theirs); this.setHeadTo(theirs); return `Fast-forward to ${theirs.slice(0, 7)}. No merge commit needed, the branch label just slid forward.`; }
    const base = this.mergeBase(ours, theirs);
    const B = this.commitFiles(base), O = this.commitFiles(ours), T = this.commitFiles(theirs);
    const result = new Map(), conflicts = [];
    for (const p of new Set([...B.keys(), ...O.keys(), ...T.keys()])) {
      const b = B.get(p), o = O.get(p), t = T.get(p);
      if (o === t) { if (o) result.set(p, o); }
      else if (o === b) { if (t) result.set(p, t); }
      else if (t === b) { if (o) result.set(p, o); }
      else conflicts.push(p);
    }
    if (!conflicts.length) {
      this.index = result;
      for (const [p, s] of result) this.work.set(p, this.objects.get(s).data.content);
      for (const p of O.keys()) if (!result.has(p)) this.work.delete(p);
      this.mergeHead = theirs;
      const msg = this.commit(`Merge ${rev}`);
      return `Merge made by three-way merge (base ${base?.slice(0, 7) ?? "none"}).\n${msg}`;
    }
    for (const [p, s] of result) { this.index.set(p, s); this.work.set(p, this.objects.get(s).data.content); }
    const content = s => s ? this.objects.get(s).data.content : "";
    for (const p of conflicts) this.work.set(p, `<<<<<<< HEAD\n${content(O.get(p))}=======\n${content(T.get(p))}>>>>>>> ${rev}\n`);
    this.mergeHead = theirs;
    return `CONFLICT in ${conflicts.join(", ")}. Both sides changed it differently.\nEdit the file (e.g. echo "resolved" > ${conflicts[0]}), then git add . && git commit -m "Merge ${rev}"`;
  }
  statusText() {
    const s = this.status(), lines = [this.head.ref ? `On branch ${this.head.ref}` : `HEAD detached at ${this.head.sha.slice(0, 7)}`];
    if (this.mergeHead) lines.push("You are in the middle of a merge.");
    if (s.staged.length) lines.push("Changes to be committed:", ...s.staged.map(x => "  " + x));
    if (s.unstaged.length) lines.push("Changes not staged for commit:", ...s.unstaged.map(x => "  " + x));
    if (s.untracked.length) lines.push("Untracked files:", ...s.untracked.map(x => "  " + x));
    if (lines.length === 1) lines.push("nothing to commit, working tree clean");
    return lines.join("\n");
  }
  log() {
    const out = []; let s = this.headSha(); const seen = new Set();
    const q = s ? [s] : [];
    while (q.length) {
      q.sort((a, b) => this.objects.get(b).data.time - this.objects.get(a).data.time);
      s = q.shift(); if (seen.has(s)) continue; seen.add(s);
      const c = this.objects.get(s).data;
      out.push(`${s.slice(0, 7)} ${c.message}${c.parents.length > 1 ? "  (merge)" : ""}`);
      q.push(...c.parents);
    }
    return out.join("\n") || "no commits yet";
  }
}
