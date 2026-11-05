import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sha1, hashObject, tokenize, Repo } from "./git.js";

test("sha1 known vectors", () => {
  const e = new TextEncoder();
  assert.equal(sha1(e.encode("")), "da39a3ee5e6b4b0d3255bfef95601890afd80709");
  assert.equal(sha1(e.encode("abc")), "a9993e364706816aba3e25717850c26c9cd0d89d");
  assert.equal(sha1(e.encode("a".repeat(1000))), "291e9a6c66994949b57ba5e650361e98fc36b1ba");
});

test("blob hash matches git's empty blob and hello", () => {
  assert.equal(hashObject("blob", ""), "e69de29bb2d1d6434b8b29ae775ad8c2e48c5391");
  assert.equal(hashObject("blob", "hello\n"), "ce013625030ba8dba906f756967f9e9ca394464a");
});

test("tokenize handles quotes and redirects", () => {
  assert.deepEqual(tokenize(`echo "hi there" >> a.txt`), ["echo", "hi there", ">>", "a.txt"]);
  assert.deepEqual(tokenize(`git commit -m 'first one'`), ["git", "commit", "-m", "first one"]);
  assert.deepEqual(tokenize(`echo hi>b`), ["echo", "hi", ">", "b"]);
});

const run = (r, ...cmds) => cmds.map(c => r.run(c));

test("commit, branch, fast-forward merge", () => {
  const r = new Repo();
  run(r, `echo hello > a.txt`, `git add .`, `git commit -m one`, `git checkout -b feat`, `echo more >> a.txt`, `git commit -am two`, `git checkout main`);
  assert.equal(r.work.get("a.txt"), "hello\n");
  assert.match(r.run("git merge feat"), /Fast-forward/);
  assert.equal(r.work.get("a.txt"), "hello\nmore\n");
  assert.equal(r.refs.get("main"), r.refs.get("feat"));
});

test("identical content is stored once", () => {
  const r = new Repo();
  run(r, `echo same > a.txt`, `echo same > b.txt`, `git add .`);
  assert.equal(r.index.get("a.txt"), r.index.get("b.txt"));
  assert.equal([...r.objects.values()].filter(o => o.type === "blob").length, 1);
});

test("three-way merge without conflict creates a two-parent commit", () => {
  const r = new Repo();
  run(r, `echo a > a.txt`, `echo b > b.txt`, `git add .`, `git commit -m base`, `git branch feat`,
    `echo a2 > a.txt`, `git commit -am main-change`, `git checkout feat`, `echo b2 > b.txt`, `git commit -am feat-change`, `git checkout main`);
  r.run("git merge feat");
  const c = r.objects.get(r.headSha()).data;
  assert.equal(c.parents.length, 2);
  assert.equal(r.work.get("a.txt"), "a2\n");
  assert.equal(r.work.get("b.txt"), "b2\n");
});

test("conflicting merge writes markers and requires resolution", () => {
  const r = new Repo();
  run(r, `echo base > f`, `git add .`, `git commit -m base`, `git branch other`, `echo ours > f`, `git commit -am ours`,
    `git checkout other`, `echo theirs > f`, `git commit -am theirs`, `git checkout main`);
  assert.match(r.run("git merge other"), /CONFLICT/);
  assert.match(r.work.get("f"), /<<<<<<< HEAD\nours\n=======\ntheirs\n>>>>>>> other/);
  assert.throws(() => run(r, "git add .", "git commit -m m"), /conflict markers/);
  run(r, `echo fixed > f`, `git add .`, `git commit -m merged`);
  assert.equal(r.objects.get(r.headSha()).data.parents.length, 2);
});

test("checkout refuses with dirty tree", () => {
  const r = new Repo();
  run(r, `echo a > a`, `git add .`, `git commit -m c`, `git branch x`, `echo b > a`);
  assert.throws(() => r.run("git checkout x"), /overwritten/);
});

test("commit and tree hashes match real git", { skip: !hasGit() }, () => {
  const dir = mkdtempSync(join(tmpdir(), "gitcheck-"));
  const env = { ...process.env, GIT_AUTHOR_NAME: "You", GIT_AUTHOR_EMAIL: "you@example.com", GIT_COMMITTER_NAME: "You", GIT_COMMITTER_EMAIL: "you@example.com",
    GIT_AUTHOR_DATE: "1767225660 +0000", GIT_COMMITTER_DATE: "1767225660 +0000", GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null" };
  const g = (...a) => execFileSync("git", a, { cwd: dir, env }).toString().trim();
  g("init", "-q", "-b", "main");
  writeFileSync(join(dir, "readme.md"), "hi\n");
  mkdirSync(join(dir, "src")); writeFileSync(join(dir, "src", "app.js"), "x\n");
  g("add", "."); g("commit", "-q", "-m", "first");
  const r = new Repo();
  run(r, `echo hi > readme.md`, `echo x > src/app.js`, `git add .`, `git commit -m first`);
  assert.equal(r.headSha(), g("rev-parse", "HEAD"));
});

function hasGit() { try { execFileSync("git", ["--version"]); return true; } catch { return false; } }
