import { test } from "node:test";
import assert from "node:assert/strict";
import { DOCS, chunk, retrieve, covers, prompt, QUESTIONS, words } from "../lib/rag.js";

const ok = (size, overlap, k, q) => covers(retrieve(q.q, chunk(DOCS, size, overlap), k), q.facts).every(Boolean);

test("chunking covers every word, and overlap repeats words", () => {
  const total = DOCS.reduce((n, d) => n + words(d.text).length, 0);
  const plain = chunk(DOCS, 30, 0), over = chunk(DOCS, 30, 10);
  assert.equal(plain.reduce((n, c) => n + c.text.split(" ").length, 0), DOCS.reduce((n, d) => n + d.text.split(/\s+/).length, 0));
  assert.ok(over.length > plain.length); assert.ok(total > 200);
});

test("sensible chunks and k=2 retrieve the facts for ordinary questions", () => {
  for (const q of QUESTIONS.slice(0, 4)) assert.ok(ok(30, 0, 2, q), q.q);
});

test("a question needing two facts fails with k=1", () => {
  assert.equal(ok(30, 0, 1, QUESTIONS[3]), false); assert.equal(ok(30, 0, 2, QUESTIONS[3]), true);
});

test("chunks that are too small cut facts in half", () => { assert.equal(ok(8, 0, 3, QUESTIONS[0]), false); });

test("word matching can't bridge synonyms", () => {
  const hits = retrieve(QUESTIONS[4].q, chunk(DOCS, 30, 0), 3); assert.ok(hits.every(h => h.score === 0));
});

test("the prompt contains the question and the numbered context", () => {
  const p = prompt("Q?", [{ doc: "A", text: "alpha" }, { doc: "B", text: "beta" }]);
  assert.ok(p.includes("[1] (A) alpha") && p.includes("[2] (B) beta") && p.endsWith("Question: Q?"));
});
