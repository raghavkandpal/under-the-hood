import { test } from "node:test";
import assert from "node:assert/strict";
import { DOCS, build, intersect, phrase, search, tokens } from "./inverted-index.js";

const index = build(DOCS), n = DOCS.length;

test("tokens are lowercased words", () => { assert.deepEqual(tokens("Reset your PASSWORD!"), ["reset", "your", "password"]); });

test("posting lists record documents and positions", () => {
  assert.deepEqual(index.get("password").map(p => p.doc), [0, 1, 3]);
  assert.deepEqual(index.get("your").find(p => p.doc === 4).positions, [1, 6]);
});

test("AND queries intersect posting lists with a merge walk", () => {
  const r = intersect([index.get("password"), index.get("login")]); assert.deepEqual(r.docs, [0, 3]);
  assert.ok(r.comparisons <= index.get("password").length + index.get("login").length);
  assert.deepEqual(search(index, "account settings", n).map(x => x.doc).sort(), [4, 5]);
});

test("phrase queries need the words next to each other", () => {
  assert.deepEqual(phrase(index, ["login", "page"]), [0, 3]); assert.deepEqual(phrase(index, ["page", "login"]), []);
  assert.deepEqual(search(index, "\"account page\"", n).map(x => x.doc), [2]);
});

test("rare words weigh more than common ones", () => {
  const r = search(index, "password wrong", n); assert.equal(r[0].doc, 3);
  assert.ok(Math.log(n / index.get("invoice").length) > Math.log(n / index.get("your").length));
});
