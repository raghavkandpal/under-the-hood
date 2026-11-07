// Coverage-guided fuzzing vs blind random inputs, on a toy parser with a bug behind a 4-byte magic header. No DOM.
// Inputs are arrays of byte values.

/** The target: each check that passes is a new branch. It crashes only on "FUZ!" followed by a length byte over 200. */
export function target(input) {
  const cov = new Set(["start"]), b = input;
  if (b.length < 5) return { cov, crash: false };
  cov.add("long enough");
  if (b[0] !== 70) return { cov, crash: false }; cov.add("F");
  if (b[1] !== 85) return { cov, crash: false }; cov.add("FU");
  if (b[2] !== 90) return { cov, crash: false }; cov.add("FUZ");
  if (b[3] !== 33) return { cov, crash: false }; cov.add("FUZ!");
  if (b[4] <= 200) return { cov, crash: false }; cov.add("length > 200");
  return { cov, crash: true };
}
export const BRANCHES = 7;

const randomBytes = (n, rnd) => Array.from({ length: n }, () => Math.floor(rnd() * 256));
/** Small random edits: overwrite a byte, insert one, delete one, or flip a bit. */
export function mutate(input, rnd) {
  const b = [...input], i = Math.floor(rnd() * Math.max(1, b.length)), k = Math.floor(rnd() * 4);
  if (k === 0 && b.length) b[i] = Math.floor(rnd() * 256);
  else if (k === 1) b.splice(i, 0, Math.floor(rnd() * 256));
  else if (k === 2 && b.length > 1) b.splice(i, 1);
  else if (b.length) b[i] ^= 1 << Math.floor(rnd() * 8);
  return b;
}

/**
 * guided: keep a corpus of inputs that reached new branches. Like AFL, each new entry first gets a deterministic pass
 * (every value at every byte position), then random edits ("havoc"). random: a fresh random input every time.
 * Returns coverage after each run (sampled), the corpus, and the first crashing input.
 */
export function fuzz({ guided, runs = 20000, rnd, every = 100, start = [104, 105, 33, 33, 33] }) {
  const seen = new Set(target(start).cov), corpus = [{ input: start, found: [...seen], at: 0 }], curve = [[0, seen.size]];
  let crash = null; const walks = [{ input: corpus[0].input, pos: 0, val: 0 }];
  const next = () => {
    const w = walks.at(-1);
    if (!w) return mutate(corpus[Math.floor(rnd() * corpus.length)].input, rnd);
    const b = [...w.input]; b[w.pos] = w.val;
    if (++w.val === 256) { w.val = 0; if (++w.pos === w.input.length) walks.pop(); }
    return b;
  };
  for (let r = 1; r <= runs && !crash; r++) {
    const input = guided ? next() : randomBytes(5 + Math.floor(rnd() * 4), rnd);
    const { cov, crash: c } = target(input), fresh = [...cov].filter(x => !seen.has(x));
    if (fresh.length) { fresh.forEach(x => seen.add(x)); if (guided) { corpus.push({ input, found: fresh, at: r }); walks.push({ input, pos: 0, val: 0 }); } }
    if (c) crash = { input, at: r };
    if (r % every === 0 || crash) curve.push([r, seen.size]);
  }
  return { curve, corpus, crash, covered: seen.size };
}
export const show = b => b.map(x => (x >= 33 && x < 127 ? String.fromCharCode(x) : "·")).join("");
