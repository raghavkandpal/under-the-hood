import { test } from "node:test";
import assert from "node:assert/strict";
import { mkfs, run, read, resolve, list, plan, recover, fsck } from "../lib/file-systems.js";

const ok = (fs, op) => run(fs, op).fs;
const base = () => ok(ok(mkfs(), { kind: "create", path: "/notes.txt", data: "buy milk and eggs" }), { kind: "create", path: "/todo.txt", data: "ship it" });

test("files are stored in blocks and read back", () => {
  const fs = base(); assert.equal(read(fs, "/notes.txt"), "buy milk and eggs"); assert.deepEqual(list(fs).sort(), ["notes.txt", "todo.txt"]);
  assert.equal(fs.inodes[resolve(fs, "/notes.txt")].blocks.length, 3); assert.deepEqual(fsck(fs), []);
});

test("a hard link is a second name for the same inode; data survives deleting the first name", () => {
  let fs = ok(base(), { kind: "link", target: "/notes.txt", path: "/copy.txt" });
  assert.equal(resolve(fs, "/copy.txt"), resolve(fs, "/notes.txt")); assert.equal(fs.inodes[resolve(fs, "/notes.txt")].links, 2);
  fs = ok(fs, { kind: "unlink", path: "/notes.txt" });
  assert.equal(read(fs, "/copy.txt"), "buy milk and eggs"); assert.deepEqual(fsck(fs), []);
});

test("a symbolic link stores a path, and dangles when the target goes", () => {
  let fs = ok(base(), { kind: "symlink", target: "/todo.txt", path: "/shortcut" });
  assert.equal(read(fs, "/shortcut"), "ship it");
  fs = ok(fs, { kind: "unlink", path: "/todo.txt" });
  assert.equal(read(fs, "/shortcut"), null); assert.ok(fs.inodes[fs.inodes[1].entries.shortcut]); // the link itself still exists
});

test("blocks are freed only when the last link goes", () => {
  let fs = ok(base(), { kind: "link", target: "/todo.txt", path: "/t2" });
  const used = fs.bitmap.filter(Boolean).length;
  fs = ok(fs, { kind: "unlink", path: "/todo.txt" }); assert.equal(fs.bitmap.filter(Boolean).length, used);
  fs = ok(fs, { kind: "unlink", path: "/t2" }); assert.equal(fs.bitmap.filter(Boolean).length, used - 1); assert.deepEqual(fsck(fs), []);
});

test("without a journal, crashing mid-operation leaves inconsistencies that fsck finds", () => {
  const fs = base(), op = { kind: "create", path: "/big.txt", data: "x".repeat(20) }, n = plan(fs, op).length;
  const found = []; for (let c = 1; c < n; c++) found.push(fsck(run(fs, op, { crashAfter: c }).fs).length);
  assert.ok(found.some(x => x > 0));
  const del = run(base(), { kind: "unlink", path: "/notes.txt" }, { crashAfter: 1 }).fs; // name removed, nothing freed
  assert.ok(fsck(del).some(p => /orphan/.test(p)));
});

test("with a journal, every crash point recovers to a clean all-or-nothing state", () => {
  const fs = base(), op = { kind: "create", path: "/big.txt", data: "x".repeat(20) }, n = plan(fs, op).length;
  for (let c = 0; c <= 2 * n + 1; c++) {
    const after = recover(run(fs, op, { crashAfter: c, journal: true }).fs).fs;
    assert.deepEqual(fsck(after), [], `crash after ${c}`);
    const present = read(after, "/big.txt"); assert.ok(present === null || present === "x".repeat(20));
  }
});
