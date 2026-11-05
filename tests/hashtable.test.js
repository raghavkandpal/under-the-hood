import { test } from "node:test";
import assert from "node:assert/strict";
import { HashTable, HASHES } from "../lib/hashtable.js";

const words = "apple banana cherry date elderberry fig grape honeydew kiwi lemon mango nectarine orange papaya quince raspberry".split(" ");

for (const strategy of ["chaining", "probing"]) for (const hash of Object.keys(HASHES)) {
  test(`${strategy}/${hash}: behaves like a Map under random ops`, () => {
    const t = new HashTable({ strategy, hash, capacity: 4 }), m = new Map();
    let seed = 42; const rnd = n => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) % n;
    for (let i = 0; i < 600; i++) {
      const k = words[rnd(words.length)] + (rnd(3) ? "" : rnd(5)), op = rnd(10);
      if (op < 6) { t.set(k, i); m.set(k, i); }
      else if (op < 9) { assert.equal(t.delete(k).found, m.delete(k)); }
      else assert.equal(t.find(k).found, m.has(k));
      assert.equal(t.size, m.size);
    }
    for (const [k, v] of m) { const r = t.find(k); assert.ok(r.found, k); }
    assert.equal(t.entries().length, m.size);
  });
}

test("auto-resize keeps load at or below max", () => {
  const t = new HashTable({ capacity: 4, maxLoad: 0.75 });
  for (const w of words) { t.set(w, 1); assert.ok(t.load() <= 0.75 + 1e-9); }
  assert.ok(t.capacity >= 16);
});

test("terrible hash produces long chains, good hash doesn't", () => {
  const ks = ["aa", "ab", "ac", "ad", "ae", "af", "ag", "ah"];
  const bad = new HashTable({ hash: "first", capacity: 32, autoResize: false });
  const good = new HashTable({ hash: "fnv1a", capacity: 32, autoResize: false });
  for (const k of ks) { bad.set(k, 1); good.set(k, 1); }
  assert.equal(bad.stats().worst, 8);
  assert.ok(good.stats().worst <= 3);
});

test("probing: lookup continues past tombstones", () => {
  const t = new HashTable({ strategy: "probing", hash: "first", capacity: 8, autoResize: false });
  t.set("a1", 1); t.set("a2", 2); t.set("a3", 3);
  t.delete("a2");
  assert.ok(t.find("a3").found);
  t.set("a4", 4); // reuses tombstone
  assert.equal(t.tombstones, 0);
  assert.ok(t.find("a3").found && t.find("a4").found);
});
