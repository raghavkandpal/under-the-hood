import { test } from "node:test";
import assert from "node:assert/strict";
import { sha256, pbkdf2, store, attack, DICTIONARY } from "../lib/pwhash.js";

test("known vectors", async () => {
  assert.equal(await sha256("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assert.equal(await pbkdf2("password", "salt", 1), "120fb6cffcf8b32c43e7225256c4f837a86548c92ccc35480805987cb70be17b");
});

const mk = async (scheme, iters = 50) => {
  const raw = [["u1", "sunshine", "aa"], ["u2", "sunshine", "bb"], ["u3", "Tr0ub4dor&3-horse-staple", "cc"], ["u4", "dragon1", "dd"]];
  return Promise.all(raw.map(async ([name, pw, salt]) => ({ name, salt, stored: await store(scheme, pw, salt, iters) })));
};

test("unsalted hashes leak shared passwords; salted ones don't", async () => {
  const a = await mk("sha"), b = await mk("salted");
  assert.equal(a[0].stored, a[1].stored);
  assert.notEqual(b[0].stored, b[1].stored);
});

test("dictionary attack cracks weak passwords in every scheme, never the strong one", async () => {
  for (const s of ["plain", "sha", "salted", "pbkdf2"]) {
    const r = await attack(s, await mk(s), DICTIONARY, { iterations: 50 });
    assert.deepEqual([...r.cracked.keys()].sort(), ["u1", "u2", "u4"], s);
  }
});

test("unsalted needs one pass over the dictionary; salted needs one per user", async () => {
  const a = await attack("sha", await mk("sha"), DICTIONARY), b = await attack("salted", await mk("salted"), DICTIONARY);
  assert.equal(a.guesses, DICTIONARY.length);
  assert.ok(b.guesses > DICTIONARY.length * 1.5);
});
