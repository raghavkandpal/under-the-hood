// A tiny Unix-style file system: inodes, directory entries, a block bitmap, hard and symbolic links,
// and crash consistency with and without a journal. No DOM.
// Every operation is a list of small disk writes, so a "crash" can stop it after any one of them.

export const BLOCK = 8; // characters per block
const clone = x => JSON.parse(JSON.stringify(x));

export function mkfs(nblocks = 32) {
  return { bitmap: new Array(nblocks).fill(0), blocks: new Array(nblocks).fill(""), inodes: { 1: { type: "dir", links: 1, entries: {} } }, nextIno: 2, journal: [] };
}

const parent = path => { const parts = path.split("/").filter(Boolean); return { dir: "/" + parts.slice(0, -1).join("/"), name: parts.at(-1) }; };

/** Walk a path to an inode number. Follows symlinks (up to 8 deep). Returns null if missing or dangling. */
export function resolve(fs, path, depth = 0) {
  if (depth > 8) return null;
  let ino = 1;
  const parts = path.split("/").filter(Boolean);
  for (let i = 0; i < parts.length; i++) {
    const dir = fs.inodes[ino]; if (!dir || dir.type !== "dir") return null;
    ino = dir.entries[parts[i]]; if (ino == null || !fs.inodes[ino]) return null;
    const node = fs.inodes[ino];
    if (node.type === "symlink") { const rest = parts.slice(i + 1).join("/"); return resolve(fs, node.target + (rest ? "/" + rest : ""), depth + 1); }
  }
  return ino;
}
export function read(fs, path) { const ino = resolve(fs, path); const n = ino && fs.inodes[ino]; return n && n.type === "file" ? n.blocks.map(b => fs.blocks[b]).join("").slice(0, n.size) : null; }
export const list = (fs, dir = "/") => Object.keys(fs.inodes[resolve(fs, dir)]?.entries || {});

/** Plan the disk writes for an operation (does not apply them). */
export function plan(fs, op) {
  const W = [];
  if (op.kind === "create") {
    const { dir, name } = parent(op.path), d = resolve(fs, dir), need = Math.max(1, Math.ceil(op.data.length / BLOCK)), free = [];
    for (let b = 0; b < fs.bitmap.length && free.length < need; b++) if (!fs.bitmap[b]) free.push(b);
    if (free.length < need) throw new Error("disk full");
    const ino = fs.nextIno;
    free.forEach((b, i) => W.push({ t: "block", b, data: op.data.slice(i * BLOCK, (i + 1) * BLOCK), what: `write data block ${b}` }));
    free.forEach(b => W.push({ t: "bitmap", b, v: 1, what: `mark block ${b} used` }));
    W.push({ t: "inode", ino, node: { type: "file", links: 1, size: op.data.length, blocks: free }, what: `write inode ${ino}` });
    W.push({ t: "dirent", dir: d, name, ino, what: `add "${name}" → inode ${ino} to directory` });
  } else if (op.kind === "link") {
    const ino = resolve(fs, op.target), { dir, name } = parent(op.path);
    W.push({ t: "links", ino, delta: 1, what: `inode ${ino} link count +1` }, { t: "dirent", dir: resolve(fs, dir), name, ino, what: `add "${name}" → inode ${ino}` });
  } else if (op.kind === "symlink") {
    const { dir, name } = parent(op.path), ino = fs.nextIno;
    W.push({ t: "inode", ino, node: { type: "symlink", links: 1, target: op.target }, what: `write symlink inode ${ino} → ${op.target}` }, { t: "dirent", dir: resolve(fs, dir), name, ino, what: `add "${name}" → inode ${ino}` });
  } else if (op.kind === "unlink") {
    const { dir, name } = parent(op.path), d = resolve(fs, dir), ino = fs.inodes[d].entries[name], node = fs.inodes[ino];
    W.push({ t: "undirent", dir: d, name, what: `remove "${name}" from directory` }, { t: "links", ino, delta: -1, what: `inode ${ino} link count −1` });
    if (node.links === 1) { (node.blocks || []).forEach(b => W.push({ t: "bitmap", b, v: 0, what: `free block ${b}` })); W.push({ t: "free", ino, what: `free inode ${ino}` }); }
  }
  return W;
}

export function apply(fs, w) {
  if (w.t === "block") fs.blocks[w.b] = w.data;
  else if (w.t === "bitmap") fs.bitmap[w.b] = w.v;
  else if (w.t === "inode") { fs.inodes[w.ino] = clone(w.node); fs.nextIno = Math.max(fs.nextIno, w.ino + 1); }
  else if (w.t === "dirent") fs.inodes[w.dir].entries[w.name] = w.ino;
  else if (w.t === "undirent") delete fs.inodes[w.dir].entries[w.name];
  else if (w.t === "links") fs.inodes[w.ino].links += w.delta;
  else if (w.t === "free") delete fs.inodes[w.ino];
}

/**
 * Run an operation. crashAfter = number of writes that reach disk before power is lost (Infinity = no crash).
 * journal: first write the whole plan + a commit record to the journal, then apply ("checkpoint").
 */
export function run(fs, op, { crashAfter = Infinity, journal = false } = {}) {
  const W = plan(fs, op), out = clone(fs); let n = 0;
  if (journal) {
    for (const w of W) { if (n++ >= crashAfter) return { fs: out, writes: n - 1, planned: W.length, crashed: true }; out.journal.push(w); }
    if (n++ >= crashAfter) return { fs: out, writes: n - 1, planned: W.length, crashed: true };
    out.journal.push({ t: "commit" });
    for (const w of W) { if (n++ >= crashAfter) return { fs: out, writes: n - 1, planned: W.length, crashed: true }; apply(out, w); }
    out.journal = []; return { fs: out, writes: n, planned: W.length, crashed: false };
  }
  for (const w of W) { if (n++ >= crashAfter) return { fs: out, writes: n - 1, planned: W.length, crashed: true }; apply(out, w); }
  return { fs: out, writes: n, planned: W.length, crashed: false };
}

/** After a reboot with a journal: replay committed transactions, throw away uncommitted ones. */
export function recover(fs) {
  const out = clone(fs), c = out.journal.findIndex(w => w.t === "commit");
  if (c >= 0) for (const w of out.journal.slice(0, c)) apply(out, w);
  const replayed = c >= 0; out.journal = []; return { fs: out, replayed };
}

/** fsck: check that the bitmap, inodes and directories agree. */
export function fsck(fs) {
  const problems = [], used = new Set(), refs = {};
  for (const [ino, n] of Object.entries(fs.inodes)) {
    if (n.type === "dir") for (const [name, child] of Object.entries(n.entries)) { refs[child] = (refs[child] || 0) + 1; if (!fs.inodes[child]) problems.push(`directory entry "${name}" points to inode ${child}, which doesn't exist`); }
    for (const b of n.blocks || []) { used.add(b); if (!fs.bitmap[b]) problems.push(`inode ${ino} uses block ${b}, but the bitmap says it's free (it could be given to another file)`); }
  }
  fs.bitmap.forEach((v, b) => { if (v && !used.has(b)) problems.push(`block ${b} is marked used but no file owns it (leaked space)`); });
  for (const [ino, n] of Object.entries(fs.inodes)) if (+ino !== 1) {
    const r = refs[ino] || 0;
    if (r === 0) problems.push(`inode ${ino} exists but no directory points to it (orphan)`);
    else if (n.links !== r) problems.push(`inode ${ino} says ${n.links} link${n.links === 1 ? "" : "s"} but ${r} name${r === 1 ? "" : "s"} point to it`);
  }
  return problems;
}
