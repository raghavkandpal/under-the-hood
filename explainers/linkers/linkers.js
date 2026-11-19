// How linkers work: toy object files and a GNU-style static link, with no DOM so it can be tested in Node.

export const BASE = 0x1000; // where the output's code starts in this model

/** Toy object files: defined symbols, undefined symbols (derived from relocs), code size, relocations. */
const obj = (name, size, defines, relocs = []) => ({ name, size, defines, relocs }); // a reloc: { symbol, offset, addend }
const call = (symbol, offset) => ({ symbol, offset, addend: -4 }); // 4-byte PC-relative field, like x86-64 call

export const OBJECTS = {
  "main.o": obj("main.o", 32, ["main"], [call("area", 8), call("print", 20)]),
  "geom.o": obj("geom.o", 24, ["area"]),
  "shape.o": obj("shape.o", 24, ["area"], [call("square", 6)]),
  "fast.o": obj("fast.o", 24, ["area"]),
  "io.o": obj("io.o", 16, ["print"]),
  "sq.o": obj("sq.o", 8, ["square"]),
  "str.o": obj("str.o", 8, ["strlen"]),
  "fmt.o": obj("fmt.o", 12, ["format"]),
  "log.o": obj("log.o", 12, ["logmsg"]),
};
export const ARCHIVES = { "libgeom.a": ["str.o", "shape.o", "fmt.o", "sq.o", "log.o"] };

const undefinedOf = o => [...new Set(o.relocs.map(r => r.symbol))].filter(s => !o.defines.includes(s));

/** PC-relative patch: S + A - P as a 32-bit unsigned value. */
export const patch = (S, A, P) => (S + A - P) >>> 0;
export const hex = (n, w = 8) => "0x" + n.toString(16).padStart(w, "0");

/**
 * Link inputs left to right. A plain object is always included. An archive member is included only if it defines a
 * symbol that is undefined at that moment; the archive is rescanned until nothing new is pulled, then never revisited.
 * Returns { ok, errors, linked, symbols, patches }.
 */
export function link(inputs, objects = OBJECTS, archives = ARCHIVES) {
  const linked = [], defined = new Map(), errors = [];
  const add = o => {
    for (const s of o.defines) {
      if (defined.has(s)) errors.push({ kind: "duplicate", symbol: s, objects: [defined.get(s), o.name] });
      else defined.set(s, o.name);
    }
    linked.push(o.name);
  };
  const needed = () => linked.flatMap(n => undefinedOf(objects[n]).map(symbol => ({ symbol, from: n }))).filter(u => !defined.has(u.symbol));
  for (const input of inputs) {
    if (!archives[input]) { add(objects[input]); continue; }
    for (let pulled = true; pulled;) {
      pulled = false;
      for (const m of archives[input]) {
        if (linked.includes(m)) continue;
        if (objects[m].defines.some(s => needed().some(u => u.symbol === s))) { add(objects[m]); pulled = true; }
      }
    }
  }
  for (const u of needed()) errors.push({ kind: "undefined", symbol: u.symbol, objects: [u.from] });
  if (errors.length) return { ok: false, errors, linked, symbols: {}, patches: [] };
  const start = {}, symbols = {};
  let at = BASE;
  for (const n of linked) { start[n] = at; at += objects[n].size; }
  for (const [s, n] of defined) symbols[s] = start[n]; // every toy symbol sits at its object's offset 0
  const patches = linked.flatMap(n => objects[n].relocs.map(r => {
    const S = symbols[r.symbol], P = start[n] + r.offset;
    return { object: n, symbol: r.symbol, S, A: r.addend, P, value: patch(S, r.addend, P) };
  }));
  return { ok: true, errors: [], linked, symbols, patches };
}

/** The linker's message for one error. */
export const message = e => e.kind === "undefined" ? `${e.objects[0]}: undefined reference to \`${e.symbol}'`
  : `multiple definition of \`${e.symbol}': ${e.objects[0]} and ${e.objects[1]}`;
