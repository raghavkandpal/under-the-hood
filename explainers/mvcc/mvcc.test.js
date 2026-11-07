import { test } from "node:test";
import assert from "node:assert/strict";
import { init, begin, read, write, end, vacuum } from "./mvcc.js";

test("a reader keeps its snapshot while a writer changes and commits the row", () => {
  let db = begin(begin(init(100), "A"), "B");
  db = write(db, "A", 150).db;
  assert.equal(read(db, "A"), 150, "sees its own write"); assert.equal(read(db, "B"), 100, "doesn't see uncommitted work");
  db = end(db, "A", "committed"); assert.equal(read(db, "B"), 100, "still its snapshot");
  db = begin(db, "C"); assert.equal(read(db, "C"), 150, "a new transaction sees the commit");
  assert.equal(db.versions.length, 2);
});

test("two writers: the second gets a serialization error, even after the first commits", () => {
  let db = begin(begin(init(), "A"), "B");
  db = write(db, "A", 120).db; const r = write(db, "B", 90); assert.match(r.error, /could not serialize/);
  db = end(db, "A", "committed"); assert.match(write(db, "B", 90).error, /could not serialize/);
});

test("an abort undoes nothing in place: its version just becomes invisible", () => {
  let db = begin(init(100), "A"); db = write(db, "A", 0).db; db = end(db, "A", "aborted");
  db = begin(db, "B"); assert.equal(read(db, "B"), 100); assert.equal(write(db, "B", 70).error, undefined);
});

test("vacuum drops only versions no one can see", () => {
  let db = begin(init(100), "R"); db = begin(db, "W"); db = write(db, "W", 1).db; db = end(db, "W", "committed");
  assert.equal(vacuum(db).removed, 0, "R's snapshot still needs the old version");
  db = end(db, "R", "committed"); const v = vacuum(db); assert.equal(v.removed, 1); assert.equal(v.db.versions[0].value, 1);
});
