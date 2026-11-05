import { test } from "node:test";
import assert from "node:assert/strict";
import { WORDS, cosine, nearest, analogy, pca2 } from "./embed.js";

test("cosine basics", () => {
  assert.ok(Math.abs(cosine([1, 0], [1, 0]) - 1) < 1e-12);
  assert.ok(Math.abs(cosine([1, 0], [0, 1])) < 1e-12);
  assert.ok(Math.abs(cosine([1, 2], [2, 4]) - 1) < 1e-12);
});

test("neighbours are semantically close", () => {
  assert.equal(nearest(WORDS.puppy, 2, ["puppy"])[0].w, "kitten");
  assert.ok(["cookie", "candy", "honey"].includes(nearest(WORDS.cake, 1, ["cake"])[0].w));
});

test("classic analogies", () => {
  assert.equal(analogy("man", "king", "woman")[0].w, "queen");
  assert.equal(analogy("man", "boy", "woman")[0].w, "girl");
  assert.equal(analogy("france", "paris", "japan")[0].w, "tokyo");
  assert.equal(analogy("france", "paris", "italy")[0].w, "rome");
  assert.equal(analogy("dog", "puppy", "cat")[0].w, "kitten");
});

test("PCA components are orthonormal and ordered", () => {
  const { comps, explained } = pca2();
  const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
  assert.ok(Math.abs(dot(comps[0], comps[0]) - 1) < 1e-6 && Math.abs(dot(comps[0], comps[1])) < 1e-4);
  assert.ok(explained[0] >= explained[1] && explained[0] + explained[1] <= 1 + 1e-9);
});
