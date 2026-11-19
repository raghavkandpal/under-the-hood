import { test } from "node:test";
import assert from "node:assert/strict";
import { link, patch, hex, message, OBJECTS, ARCHIVES, BASE } from "./linkers.js";

const msgs = r => r.errors.map(message);

test("fact 1: undefined references, then a clean link, then a duplicate", () => {
  assert.deepEqual(msgs(link(["main.o"])), ["main.o: undefined reference to `area'", "main.o: undefined reference to `print'"]);
  const ok = link(["main.o", "geom.o", "io.o"]);
  assert.ok(ok.ok); assert.deepEqual(ok.errors, []);
  const dup = link(["main.o", "geom.o", "io.o", "fast.o"]);
  assert.ok(!dup.ok);
  assert.deepEqual(msgs(dup), ["multiple definition of `area': geom.o and fast.o"]);
  assert.deepEqual(dup.errors[0].objects, ["geom.o", "fast.o"]);
});

test("model constants the page states", () => {
  assert.equal(BASE, 0x1000);
  assert.equal(Object.keys(OBJECTS).length, 9);
  const size = n => OBJECTS[n].size;
  assert.deepEqual(["main.o", "geom.o", "fast.o", "io.o", "shape.o", "sq.o"].map(size), [32, 24, 24, 16, 24, 8]);
  assert.deepEqual(OBJECTS["main.o"].relocs.map(r => [r.symbol, r.offset, r.addend]), [["area", 8, -4], ["print", 20, -4]]);
  assert.deepEqual(ARCHIVES["libgeom.a"], ["str.o", "shape.o", "fmt.o", "sq.o", "log.o"]);
});

test("fact 2: the archive must come after the object that needs it", () => {
  const after = link(["main.o", "io.o", "libgeom.a"]);
  assert.ok(after.ok);
  const before = link(["libgeom.a", "main.o", "io.o"]);
  assert.ok(!before.ok);
  assert.deepEqual(msgs(before), ["main.o: undefined reference to `area'"]);
  assert.deepEqual(before.linked, ["main.o", "io.o"]); // nothing was pulled from the archive
});

test("fact 3: an archive of 5 members contributes exactly the 2 needed, in any member order", () => {
  assert.equal(ARCHIVES["libgeom.a"].length, 5);
  assert.deepEqual(link(["main.o", "io.o", "libgeom.a"]).linked, ["main.o", "io.o", "shape.o", "sq.o"]);
  const reversed = { "libgeom.a": [...ARCHIVES["libgeom.a"]].reverse() };
  const r = link(["main.o", "io.o", "libgeom.a"], OBJECTS, reversed);
  assert.deepEqual(r.linked.slice(2).sort(), ["shape.o", "sq.o"]);
});

test("layout: objects are placed in order from the base", () => {
  const r = link(["main.o", "geom.o", "io.o"]);
  assert.deepEqual([r.symbols.main, r.symbols.area, r.symbols.print].map(a => hex(a, 4)), ["0x1000", "0x1020", "0x1038"]);
  assert.deepEqual(r.patches.map(p => [p.object, p.symbol, hex(p.P, 4), hex(p.value)]),
    [["main.o", "area", "0x1008", "0x00000014"], ["main.o", "print", "0x1014", "0x00000020"]]);
});

test("fact 4: PC-relative patch is S + A - P, Eli's worked example", () => {
  assert.equal(hex(patch(0x0012e49c, -4, 0x0012e4b4)), "0xffffffe4");
  assert.equal(0xffffffe4 - 2 ** 32, -0x1c);
});

test("fact 4: moving the callee changes only the caller's patched field for it", () => {
  const a = link(["main.o", "io.o", "geom.o"]), b = link(["main.o", "io.o", "sq.o", "geom.o"]);
  const val = (r, s) => hex(r.patches.find(p => p.symbol === s).value);
  assert.equal(hex(a.symbols.area, 4), "0x1030"); assert.equal(hex(b.symbols.area, 4), "0x1038");
  assert.deepEqual([val(a, "area"), val(b, "area")], ["0x00000024", "0x0000002c"]);
  assert.equal(val(a, "print"), val(b, "print"));
  assert.equal(val(a, "print"), "0x00000008");
});
