import { test } from "node:test";
import assert from "node:assert/strict";
import { PROGRAMS, SHUFFLES, parse, infer, agreement, view, orderLabel, show } from "./type-inference.js";

const ty = (src, o) => infer(src, o).type, err = (src, o) => infer(src, o).error;
const prog = name => PROGRAMS.find(p => p.name === name).src;

test("fact 1: the printed types, renamed in order of first appearance", () => {
  assert.equal(ty("fun x -> x"), "'a -> 'a");
  assert.equal(ty("fun x -> fun y -> x"), "'a -> 'b -> 'a");
  assert.equal(ty("fun f -> fun g -> fun x -> f (g x)"), "('a -> 'b) -> ('c -> 'a) -> 'c -> 'b");
  assert.deepEqual(show([{ t: "v", id: 9 }, { t: "v", id: 3 }, { t: "v", id: 9 }]), ["'a", "'b", "'a"]);
});

test("fact 2: + takes ints; if branches must agree", () => {
  assert.equal(ty("fun x -> x + 1"), "int -> int");
  assert.equal(ty("fun x -> x + x"), "int -> int");
  assert.equal(err("if true then 1 else false"), "cannot unify int with bool");
  assert.equal(err("1 + true"), "cannot unify int with bool");
  assert.equal(err("if 1 then 2 else 3"), "cannot unify int with bool");
  assert.equal(ty("if true then 1 else 2"), "int");
});

test("fact 3: occurs check, and the unchecked binding", () => {
  const a = infer("fun x -> x x");
  assert.equal(a.ok, false);
  assert.equal(a.error, "occurs check: 'a would have to equal 'a -> 'b");
  assert.deepEqual(a.bindings, []);
  const b = infer("fun x -> x x", { occurs: false });
  assert.equal(b.ok, false);
  assert.deepEqual(b.bindings, ["t1 := t1 -> t2"]);
  assert.equal(b.error, "unchecked: t1 is now bound to a type containing t1");
  assert.equal(ty("fun x -> x", { occurs: false }), "'a -> 'a");
});

test("fact 4: let generalises, a parameter does not", () => {
  assert.equal(ty("let id = fun x -> x in let a = id 0 in id true"), "bool");
  assert.equal(err("(fun id -> let a = id 0 in id true) (fun x -> x)"), "cannot unify int with bool");
  assert.equal(ty("let f = fun x -> x in f f"), "'a -> 'a");
  // a let-bound name tied to a parameter stays monomorphic
  assert.equal(err("fun y -> let g = fun x -> y in if g 0 then g 1 + 1 else 2"), "cannot unify int with bool");
  assert.equal(ty("fun y -> let g = fun x -> y in g 0"), "'a -> 'a");
});

test("fact 5: 20 shuffled orders agree for every built-in program, checked on and off", () => {
  assert.equal(SHUFFLES, 20);
  assert.equal(PROGRAMS.length, 8);
  for (const p of PROGRAMS) for (const occurs of [true, false]) assert.equal(agreement(p.src, occurs), 20, p.name);
  const key = r => r.ok ? r.type : r.error;
  for (const p of PROGRAMS) for (let seed = 0; seed <= 20; seed++) assert.equal(key(infer(p.src, { seed })), key(infer(p.src)), `${p.name} ${seed}`);
});

test("the order changes the lists, not the answer", () => {
  const base = infer(prog("compose")).constraints;
  const other = [...Array(20).keys()].map(i => infer(prog("compose"), { seed: i + 1 }).constraints);
  assert.ok(other.some(c => c.join() !== base.join()));
  assert.ok(other.every(c => c.length === base.length));
});

test("what the page displays for each built-in program", () => {
  const v = n => view(prog(n));
  assert.deepEqual(v("add one").constraints, ["t1 = int", "int = int"]);
  assert.deepEqual(v("add one").bindings, ["t1 := int"]);
  assert.deepEqual(v("add one").tiles, [["int -> int", "type"], [2, "constraints tried"], [1, "variables bound"], ["20 of 20", "orders agree"]]);
  assert.equal(v("add one").status, "");
  assert.equal(v("compose").constraints.length, 2);
  assert.equal(v("identity").tiles[0][0], "'a -> 'a");
  assert.equal(v("identity").constraints.length, 0);
  const bad = v("bad if");
  assert.deepEqual(bad.tiles[0], ["none", "type"]);
  assert.equal(bad.status, "cannot unify int with bool");
  assert.deepEqual(bad.constraints, ["bool = bool", "int = bool"]);
  const self = view(prog("self-apply"), { occurs: false });
  assert.deepEqual(self.constraints, ["t1 = t1 -> t2"]);
  assert.deepEqual(self.tiles, [["none", "type"], [1, "constraints tried"], [1, "variables bound"], ["20 of 20", "orders agree"]]);
  assert.match(view(prog("self-apply")).status, /^occurs check: 'a would have to equal 'a -> 'b$/);
  assert.equal(view(prog("let")).tiles[0][0], "bool");
  assert.equal(view(prog("parameter")).status, "cannot unify int with bool");
});

test("the order slider label and the shuffled view", () => {
  assert.equal(orderLabel(0), "as generated");
  assert.equal(orderLabel(7), "shuffle 7");
  const a = view(prog("compose")), b = view(prog("compose"), { seed: 5 });
  assert.equal(a.tiles[0][0], b.tiles[0][0]);
});

test("a program edited by the reader: parse errors show as status, nothing throws", () => {
  assert.match(err(""), /^parse error/);
  assert.match(err("fun x ->"), /^parse error/);
  assert.match(err("fun -> x"), /^parse error/);
  assert.match(err("(1"), /^parse error/);
  assert.match(err("1 2 )"), /^parse error/);
  assert.match(err("@"), /^parse error/);
  assert.equal(err("y"), "unbound variable y");
  assert.equal(view("").tiles[0][0], "none");
  assert.equal(view("y").status, "unbound variable y");
  assert.deepEqual(parse("1 + 2 + 3").k, "add");
  assert.equal(ty("(fun x -> x) 1"), "int");
  assert.equal(err("1 2"), "cannot unify int with int -> 'a");
});
