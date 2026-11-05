import { test } from "node:test";
import assert from "node:assert/strict";
import { LSM } from "./lsm.js";
import { mulberry } from "../../shared/random.js";

test("behaves like a Map under random puts, deletes and gets", () => {
  const db = new LSM({ memLimit: 3, compactAt: 3 }), ref = new Map(), r = mulberry(5);
  for (let i = 0; i < 500; i++) {
    const k = "k" + Math.floor(r() * 20), x = r();
    if (x < 0.6) { db.put(k, i); ref.set(k, i); } else if (x < 0.8) { db.del(k); ref.delete(k); }
    else assert.equal(db.get(k).value, ref.get(k), k);
  }
  for (let i = 0; i < 20; i++) assert.equal(db.get("k" + i).value, ref.get("k" + i));
});

test("newest version wins across tables; tombstones hide older values", () => {
  const db = new LSM({ memLimit: 2, compactAt: 99 });
  db.put("a", 1); db.put("b", 1); db.put("a", 2); db.put("c", 1); db.del("a"); db.put("d", 1);
  assert.equal(db.get("a").value, undefined); assert.ok(db.get("a").deleted);
  assert.equal(db.tables.length, 3);
});

test("compaction merges to one table and drops tombstones and old versions", () => {
  const db = new LSM({ memLimit: 2, compactAt: 99 });
  for (const [k, v] of [["a", 1], ["b", 1], ["a", 2], ["c", 1]]) db.put(k, v);
  db.del("b"); db.put("z", 0); db.compact();
  assert.equal(db.tables.length, 1);
  assert.deepEqual(db.tables[0].rows, [["a", 2], ["c", 1], ["z", 0]]);
  assert.ok(db.writeAmp > 1);
});

test("reads get more expensive as uncompacted tables pile up", () => {
  const db = new LSM({ memLimit: 2, compactAt: 99 });
  for (let i = 0; i < 20; i++) db.put("k" + i, i);
  assert.equal(db.get("k0").checked.length, 1 + db.tables.length);
  db.compact();
  assert.equal(db.get("k0").checked.length, 2);
});
