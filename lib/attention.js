// Scaled dot-product attention with small, hand-built embeddings so every head is interpretable. No DOM.

export const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
export const matvec = (M, v) => M.map(row => dot(row, v));
export function softmax(xs, temp = 1) {
  const fin = xs.filter(Number.isFinite);
  if (!fin.length) return xs.map(() => 0);
  const m = Math.max(...fin), e = xs.map(x => (Number.isFinite(x) ? Math.exp((x - m) / temp) : 0)), s = e.reduce((a, b) => a + b, 0);
  return e.map(v => v / s);
}

/** Q, K, V: arrays of vectors. Returns { scores, weights, out }. causal: query i sees keys ≤ i. */
export function attend(Q, K, V, { causal = false, temp = 1, scale = true } = {}) {
  const d = K[0]?.length || 1, sc = scale ? Math.sqrt(d) : 1;
  const scores = Q.map((q, i) => K.map((k, j) => (causal && j > i ? -Infinity : dot(q, k) / sc)));
  const weights = scores.map(row => softmax(row, temp));
  const out = weights.map(w => V[0].map((_, c) => w.reduce((s, wj, j) => s + wj * V[j][c], 0)));
  return { scores, weights, out };
}

// ---- a tiny interpretable vocabulary ----
// Feature dims: 0 det, 1 animate noun, 2 object noun, 3 pronoun, 4 verb, 5 adjective, 6 preposition, 7 punctuation/other
export const FEATURES = ["determiner", "animate noun", "object noun", "pronoun", "verb", "adjective", "preposition", "other"];
const F = (...on) => { const v = Array(8).fill(0); for (const i of on) v[i] = 1; return v; };
export const LEXICON = {
  the: F(0), a: F(0), an: F(0), this: F(0), that: F(0),
  cat: F(1), dog: F(1), girl: F(1), boy: F(1), robot: F(1), teacher: F(1), bird: F(1), chef: F(1), student: F(1),
  ball: F(2), box: F(2), bridge: F(2), car: F(2), street: F(2), book: F(2), table: F(2), river: F(2), cake: F(2), soup: F(2), window: F(2),
  it: F(3), she: F(3), he: F(3), they: F(3), her: F(3), him: F(3),
  sat: F(4), chased: F(4), was: F(4), crossed: F(4), dropped: F(4), read: F(4), ate: F(4), saw: F(4), baked: F(4), opened: F(4), is: F(4), likes: F(4), tasted: F(4),
  tired: F(5), heavy: F(5), red: F(5), old: F(5), happy: F(5), big: F(5), wide: F(5), sweet: F(5), hot: F(5), small: F(5),
  on: F(6), over: F(6), under: F(6), with: F(6), in: F(6), because: F(6), and: F(6), near: F(6),
};
export const MAX_POS = 16;

export function tokenize(text) {
  return (text.toLowerCase().match(/[a-z']+|[.,!?]/g) || []).slice(0, MAX_POS);
}
/** Embedding = [8 feature dims, MAX_POS position one-hot]. Unknown words get "other". */
export function embed(tokens) {
  return tokens.map((t, i) => {
    const f = LEXICON[t] ?? F(7);
    const p = Array(MAX_POS).fill(0); p[i] = 1;
    return [...f, ...p];
  });
}
export const known = t => t in LEXICON;

// Each head is a pair of projection matrices (dims → small head space) built from readable rules.
const DIM = 8 + MAX_POS;
const zeros = (r, c) => Array.from({ length: r }, () => Array(c).fill(0));
function featureHead(rules, strength = 4) {
  // rules: [[queryFeature, keyFeature, weight], ...]; one head dimension per rule
  const WQ = zeros(rules.length, DIM), WK = zeros(rules.length, DIM);
  rules.forEach(([qf, kf, w], r) => { WQ[r][qf] = strength * w; WK[r][kf] = strength; });
  return { WQ, WK };
}
function prevTokenHead(strength = 7) {
  const WQ = zeros(MAX_POS, DIM), WK = zeros(MAX_POS, DIM);
  for (let p = 1; p < MAX_POS; p++) { WQ[p - 1][8 + p] = strength; WK[p - 1][8 + p - 1] = strength; }
  return { WQ, WK };
}
function selfHead(strength = 2) { // weak "attend to yourself" baseline so tokens with no rule don't spread uniformly
  const WQ = zeros(MAX_POS, DIM), WK = zeros(MAX_POS, DIM);
  for (let p = 0; p < MAX_POS; p++) { WQ[p][8 + p] = strength; WK[p][8 + p] = strength; }
  return { WQ, WK };
}
const combine = (...hs) => ({ WQ: hs.flatMap(h => h.WQ), WK: hs.flatMap(h => h.WK) });

export const HEADS = {
  coref: { label: "Pronoun → noun", about: "Pronouns look for the nouns they might refer to.",
    ...combine(featureHead([[3, 1, 1], [3, 2, 0.8]]), selfHead()) },
  subject: { label: "Verb → who did it", about: "Verbs look for animate nouns and pronouns, their likely subjects.",
    ...combine(featureHead([[4, 1, 1], [4, 3, 0.9]]), selfHead()) },
  adjective: { label: "Adjective → noun", about: "Adjectives look for the nouns and pronouns they could describe.",
    ...combine(featureHead([[5, 1, 1], [5, 2, 1], [5, 3, 0.9]]), selfHead()) },
  previous: { label: "Previous word", about: "Purely positional: every token looks one step back. Real models learn heads like this.",
    ...prevTokenHead() },
};

export function runHead(tokens, headId, opts = {}) {
  const X = embed(tokens), H = HEADS[headId];
  const Q = X.map(x => matvec(H.WQ, x)), K = X.map(x => matvec(H.WK, x));
  return { X, Q, K, ...attend(Q, K, X, opts) };
}
