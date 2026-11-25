import { test } from "node:test";
import assert from "node:assert/strict";
import { newShell, setPath, hashReset, addFile, resolve, run, hashRows, fileRows, pathDirs, tiles, PATH_PRESETS, COMMANDS, NEW_FILE, CWD, DEFAULT_PATH, HOME } from "./command-lookup.js";

const sh0 = newShell();

test("python: the first PATH directory that has it wins", () => {
  assert.equal(DEFAULT_PATH, "/home/me/bin:/usr/local/bin:/usr/bin");
  const a = resolve(sh0, "python");
  assert.equal(a.file, "/usr/local/bin/python");
  assert.equal(a.searched, 2);
  const b = resolve(setPath(sh0, PATH_PRESETS["/usr/bin first"]), "python");
  assert.equal(b.file, "/usr/bin/python");
  assert.equal(b.searched, 1);
});

test("a function and a builtin beat PATH, and PATH is never searched for them", () => {
  const f = resolve(sh0, "ls"), c = resolve(sh0, "cd");
  assert.deepEqual([f.via, f.searched, f.status, f.file], ["function", 0, 0, null]);
  assert.deepEqual([c.via, c.searched, c.status, c.file], ["builtin", 0, 0, null]);
  assert.equal(f.steps.length, 1);
  assert.equal(c.steps.length, 2); // not a function, then builtin
});

test("deploy in the current directory: not found without ./", () => {
  const a = resolve(sh0, "deploy");
  assert.deepEqual([a.via, a.status, a.file, a.searched], ["nowhere", 127, null, 3]);
  assert.match(a.steps.at(-1), /command not found \(status 127\)/);
  const b = resolve(sh0, "./deploy");
  assert.deepEqual([b.via, b.status, b.file, b.searched], ["slash", 0, `${CWD}/deploy`, 0]);
  assert.equal(resolve(sh0, "./nothing").status, 127);
  assert.equal(resolve(sh0, "/usr/bin/python").file, "/usr/bin/python");
});

test("a trailing colon adds the current directory", () => {
  const sh = setPath(sh0, PATH_PRESETS["Trailing colon"]);
  assert.deepEqual(pathDirs(sh.path), ["/usr/bin", CWD]);
  const r = resolve(sh, "deploy");
  assert.equal(r.file, `${CWD}/deploy`);
  assert.equal(r.searched, 2);
  assert.match(r.steps.at(-1), /project \(empty entry\): runs\./);
  assert.equal(resolve(setPath(sh0, ""), "deploy").file, `${CWD}/deploy`);
  assert.equal(resolve(setPath(sh0, `/usr/bin:${CWD}`), "deploy").steps.at(-1), `${CWD}: runs.`);
});

test("a file without the executable bit is skipped", () => {
  const r = resolve(sh0, "tool");
  assert.equal(r.file, "/usr/bin/tool");
  assert.equal(r.searched, 3);
  assert.equal(r.steps.at(-3), "/home/me/bin: not executable, skipped.");
  // only the unrunnable one on PATH: status 126, not 127
  const only = resolve(setPath(sh0, "/home/me/bin"), "tool");
  assert.deepEqual([only.via, only.status, only.file], ["nowhere", 126, "/home/me/bin/tool"]);
});

test("the hash table remembers a location until hash -r", () => {
  let { sh, file } = run(sh0, "python");
  assert.equal(file, "/usr/local/bin/python");
  assert.deepEqual(hashRows(sh), ["python → /usr/local/bin/python"]);
  sh = addFile(sh, NEW_FILE);
  const stale = run(sh, "python");
  assert.equal(stale.file, "/usr/local/bin/python");
  assert.equal(stale.via, "hash table");
  assert.equal(stale.searched, 0);
  assert.equal(stale.steps.at(-1), "python is in the hash table: /usr/local/bin/python.");
  const fresh = resolve(hashReset(sh), "python");
  assert.equal(fresh.file, NEW_FILE);
  assert.equal(fresh.searched, 1);
  assert.deepEqual(hashRows(hashReset(sh)), []);
});

test("only a successful PATH search is remembered; assigning PATH empties the table", () => {
  assert.deepEqual(hashRows(run(sh0, "ls").sh), []);
  assert.deepEqual(hashRows(run(sh0, "cd").sh), []);
  assert.deepEqual(hashRows(run(sh0, "./deploy").sh), []);
  assert.deepEqual(hashRows(run(sh0, "deploy").sh), []);
  const { sh } = run(sh0, "python");
  assert.equal(hashRows(sh).length, 1);
  assert.deepEqual(hashRows(setPath(sh, "/usr/bin:/home/me/bin")), []);
  assert.equal(resolve(setPath(sh, "/usr/bin"), "python").file, "/usr/bin/python");
  assert.equal(sh0.hash.python, undefined); // run leaves the old state alone
});

test("displayed rows follow the state", () => {
  assert.equal(fileRows(sh0).length, 6);
  assert.ok(fileRows(sh0).includes("/home/me/bin/tool –"));
  assert.ok(fileRows(addFile(sh0, NEW_FILE)).includes(`${NEW_FILE} x`));
  assert.equal(fileRows(addFile(sh0, NEW_FILE)).length, 7);
});

test("presets are the facts, and every tile says what it shows", () => {
  assert.equal(PATH_PRESETS.Default, DEFAULT_PATH);
  assert.deepEqual(COMMANDS.map(c => resolve(sh0, c).status), [0, 0, 0, 127, 0, 0]);
  assert.deepEqual(tiles("python", resolve(sh0, "python")), [["PATH", "found by"], ["/usr/local/bin/python", "runs"], [2, "directories searched"], [0, "exit status"]]);
  assert.deepEqual(tiles("ls", resolve(sh0, "ls")).slice(0, 2), [["function", "found by"], ["ls (function)", "runs"]]);
  assert.deepEqual(tiles("deploy", resolve(sh0, "deploy")), [["nowhere", "found by"], ["–", "runs"], [3, "directories searched"], [127, "exit status"]]);
  const refused = tiles("tool", resolve(setPath(sh0, "/home/me/bin"), "tool"));
  assert.deepEqual(refused.slice(1, 2).concat(refused.slice(3)), [["/home/me/bin/tool", "refused"], [126, "exit status"]]);
});

test("a slash name that is not there is found by nowhere, not by slash", () => {
  for (const n of ["./nothing", "../bin/nothing", "~/bin/nothing"]) {
    const t = tiles(n, resolve(sh0, n));
    assert.deepEqual([t[0], t[3]], [["nowhere", "found by"], [127, "exit status"]], n);
  }
  assert.equal(tiles("./deploy", resolve(sh0, "./deploy"))[0][0], "slash");
  assert.deepEqual(tiles("~/bin/tool", resolve(sh0, "~/bin/tool")).map(t => t[0]), ["slash", `${HOME}/bin/tool`, 0, 126]);
});

test("PATH entries: dot, double and trailing slashes, and ~ are read as bash reads them", () => {
  assert.deepEqual(pathDirs(".:/usr//bin/:~/bin:~:./sub/..:../x"), [CWD, "/usr/bin", "/home/me/bin", HOME, CWD, "/home/me/x"]);
  assert.equal(resolve(setPath(sh0, ".:/usr/bin"), "deploy").file, `${CWD}/deploy`);
  const slash = resolve(setPath(sh0, "/usr/bin/:/x"), "python");
  assert.deepEqual([slash.file, slash.status], ["/usr/bin/python", 0]);
  const tilde = resolve(setPath(addFile(sh0, NEW_FILE), "~/bin:/usr/bin"), "python");
  assert.deepEqual([tilde.file, tilde.searched], [NEW_FILE, 1]);
});

test("the tiles of a Run keep their numbers after the hash table fills", () => {
  const ran = run(sh0, "python");
  assert.deepEqual(tiles("python", ran).map(t => t[0]), ["PATH", "/usr/local/bin/python", 2, 0]);
  const next = resolve(ran.sh, "python"); // what the page's steps show next
  assert.deepEqual(tiles("python", next).map(t => t[0]), ["hash table", "/usr/local/bin/python", 0, 0]);
});
