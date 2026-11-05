import { test } from "node:test";
import assert from "node:assert/strict";
import { tokenize, evaluate, buildConcat, buildParam, inputBecameCode, USERS } from "./sql-injection.js";

const login = (build, u, p) => { const q = build(u, p); return evaluate(q.sql, USERS, q.params); };

test("tokenizer handles strings, escaped quotes and comments", () => {
  const { tokens } = tokenize("SELECT * FROM users WHERE username = 'O''Brien' -- hi");
  assert.equal(tokens.find(t => t.type === "string").value, "O'Brien");
  assert.equal(tokens.at(-1).type, "comment");
  assert.ok(tokenize("WHERE a = 'oops").error);
});

test("normal logins work both ways", () => {
  for (const b of [buildConcat, buildParam]) {
    assert.deepEqual(login(b, "bob", "hunter2").rows.map(r => r.id), [2]);
    assert.equal(login(b, "bob", "wrong").rows.length, 0);
  }
});

test("the classic injection logs in without a password, but only with concatenation", () => {
  const evil = "' OR '1'='1' --";
  assert.equal(login(buildConcat, evil, "x").rows.length, USERS.length);
  assert.equal(login(buildParam, evil, "x").rows.length, 0);
  assert.ok(inputBecameCode(buildConcat(evil, "x").sql, buildConcat(evil, "x").spans));
});

test("targeting one account by commenting out the password check", () => {
  assert.deepEqual(login(buildConcat, "alice' --", "anything").rows.map(r => r.role), ["admin"]);
  assert.equal(login(buildParam, "alice' --", "anything").rows.length, 0);
});

test("an innocent apostrophe breaks the concatenated query but not the parameterised one", () => {
  assert.ok(login(buildConcat, "O'Brien", "shamrock").error);
  assert.deepEqual(login(buildParam, "O'Brien", "shamrock").rows.map(r => r.id), [3]);
});

test("ordinary input stays data", () => {
  const q = buildConcat("bob", "hunter2"); assert.equal(inputBecameCode(q.sql, q.spans), false);
});
