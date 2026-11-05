import { test } from "node:test";
import assert from "node:assert/strict";
import { table, bytesRead, rle, compress, revenueByCountry, revenueByCountryColumns, toColumns, ROW_BYTES } from "../lib/columnar.js";
import { mulberry } from "../lib/autograd.js";

const rows = table(5000, mulberry(1));

test("both layouts give the same answer", () => { assert.deepEqual(revenueByCountryColumns(toColumns(rows)), revenueByCountry(rows)); });

test("an analytics query reads a fraction of the bytes from a column store", () => {
  const cols = ["country", "price", "quantity"];
  assert.equal(bytesRead(1000, cols, "row"), 1000 * ROW_BYTES); assert.equal(bytesRead(1000, cols, "column"), 8000);
  assert.ok(bytesRead(1000, cols, "row") / bytesRead(1000, cols, "column") > 10);
});

test("run-length encoding", () => { assert.deepEqual(rle(["a", "a", "b", "a"]), [["a", 2], ["b", 1], ["a", 1]]); });

test("columns compress well, each in its own way", () => {
  const c = toColumns(rows);
  assert.equal(compress(c.date, 4).method, "run-length");      // sorted by time: long runs
  assert.equal(compress(c.country, 2).method, "dictionary");   // few distinct values
  assert.ok(compress(c.notes, 64).best < compress(c.notes, 64).plain / 20); // mostly empty
  assert.equal(compress(c.order_id, 8).method, "plain");       // all distinct
});
