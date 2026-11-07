import { test } from "node:test";
import assert from "node:assert/strict";
import { build, height, inorder, avgDepth } from "./balanced-trees.js";
import { mulberry } from "../../shared/random.js";

const range = n => Array.from({ length: n }, (_, i) => i + 1);

test("sorted input turns a plain BST into a linked list", () => {
  const { root } = build(range(31), false);
  assert.equal(height(root), 31); assert.equal(avgDepth(root), 16);
});

test("AVL keeps sorted input perfectly balanced: 31 keys, height 5", () => {
  const { root } = build(range(31), true);
  assert.equal(height(root), 5); assert.deepEqual(inorder(root), range(31));
});

test("the four rotation cases", () => {
  assert.deepEqual(build([3, 2, 1], true).rotations, ["LL"]); assert.deepEqual(build([1, 2, 3], true).rotations, ["RR"]);
  assert.deepEqual(build([3, 1, 2], true).rotations, ["LR"]); assert.deepEqual(build([1, 3, 2], true).rotations, ["RL"]);
});

test("AVL height stays under 1.44 log2(n + 2) for random input; random BSTs are taller", () => {
  const rnd = mulberry(1), keys = range(1000).sort(() => rnd() - 0.5);
  const avl = height(build(keys, true).root), bst = height(build(keys, false).root);
  assert.ok(avl <= 1.44 * Math.log2(1002), `${avl}`); assert.ok(bst > avl, `${bst} vs ${avl}`);
});
