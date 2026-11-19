import { test } from "node:test";
import assert from "node:assert/strict";
import { expand, args, DIR, VARS } from "./shell-expansion.js";

const a = line => args(line).args;

test("fact 1: unquoted $file splits into 2 arguments, quoted stays 1", () => {
  assert.equal(VARS.file, "my notes.txt");
  assert.deepEqual(a("rm $file"), ["my", "notes.txt"]);
  assert.deepEqual(a('rm "$file"'), ["my notes.txt"]);
});

test("fact 2: single quotes keep $file literal, double quotes give its value", () => {
  assert.deepEqual(a("echo '$file'"), ["$file"]);
  assert.deepEqual(a('echo "$file"'), ["my notes.txt"]);
});

test("fact 3: unset unquoted is 0 arguments, quoted is 1 empty argument", () => {
  assert.deepEqual(a("echo $empty"), []);
  assert.deepEqual(a('echo "$empty"'), [""]);
  assert.deepEqual(a("echo ''"), [""]);
});

test("fact 4: *.txt skips the dot file, quoted stays literal, no match stays as typed", () => {
  assert.deepEqual(a("ls *.txt"), ["a.txt", "b.txt"]);
  assert.deepEqual(a('ls "*.txt"'), ["*.txt"]);
  assert.deepEqual(a("ls '*.txt'"), ["*.txt"]);
  assert.deepEqual(a("ls *.csv"), ["*.csv"]);
});

test("fact 5: ls * passes -l as an option, ls ./* passes ./-l", () => {
  assert.ok(a("ls *").includes("-l"));
  assert.ok(a("ls ./*").includes("./-l"));
  assert.ok(!a("ls ./*").includes("-l"));
});

test("rm * passes 4 names (5 arguments with rm) and leaves .hidden.txt out", () => {
  const r = expand("rm *").argv;
  assert.equal(r.length, 5);
  assert.deepEqual(r, ["rm", "-l", "a.txt", "b.txt", "notes.md"]);
  assert.ok(!r.includes(".hidden.txt"));
  assert.equal(DIR.length, 5);
});

test("? matches one character, an explicit dot matches a dot file", () => {
  assert.deepEqual(a("ls ?.txt"), ["a.txt", "b.txt"]);
  assert.deepEqual(a("ls .*.txt"), [".hidden.txt"]);
  assert.deepEqual(a("ls ???.md"), ["???.md"]);
});

test("a glob character that comes from an unquoted variable still globs, a quoted one does not", () => {
  assert.deepEqual(args("ls $p", { p: "*.md" }).args, ["notes.md"]);
  assert.deepEqual(args('ls "$p"', { p: "*.md" }).args, ["*.md"]);
});

test("an unclosed quote is an error, not an argument list", () => {
  assert.equal(expand('echo "oops').error, "missing closing \"");
  assert.equal(expand("echo 'oops").argv, undefined);
});

test("the program name is argv[0]", () => {
  assert.equal(expand("rm $file").argv.length, 3);
  assert.equal(expand('rm "$file"').argv.length, 2);
});
