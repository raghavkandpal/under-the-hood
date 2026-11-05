// A tiny interpolated trigram language model and the decoding strategies used with real LLMs. No DOM.

export function tokenizeWords(text) { return (text.toLowerCase().match(/[a-z']+|[.,!?]/g) || []); }

export class NGram {
  constructor(text, { l3 = 0.7, l2 = 0.25, l1 = 0.05 } = {}) {
    this.l = [l1, l2, l3];
    this.uni = new Map(); this.bi = new Map(); this.tri = new Map(); this.total = 0;
    const sents = text.split(/(?<=[.!?])\s+/).map(tokenizeWords).filter(s => s.length);
    for (const s of sents) {
      const t = ["<s>", "<s>", ...s];
      for (let i = 2; i < t.length; i++) {
        this.bump(this.uni, "", t[i]); this.total++;
        this.bump(this.bi, t[i - 1], t[i]);
        this.bump(this.tri, t[i - 2] + " " + t[i - 1], t[i]);
      }
    }
    this.vocab = [...this.uni.get("").keys()].sort();
  }
  bump(m, ctx, w) { if (!m.has(ctx)) m.set(ctx, new Map()); const c = m.get(ctx); c.set(w, (c.get(w) || 0) + 1); }
  /** Next-word distribution after `ctx` (array of previous words). Returns [{tok, p}] sorted desc. */
  dist(ctx) {
    const a = ctx.at(-2) ?? "<s>", b = ctx.at(-1) ?? "<s>";
    const tri = this.tri.get(a + " " + b), bi = this.bi.get(b), uni = this.uni.get("");
    const sum = m => (m ? [...m.values()].reduce((x, y) => x + y, 0) : 0);
    const st = sum(tri), sb = sum(bi);
    // renormalise interpolation weights over the levels that have data
    const w3 = st ? this.l[2] : 0, w2 = sb ? this.l[1] : 0, w1 = this.l[0], W = w1 + w2 + w3;
    const out = this.vocab.map(tok => {
      const p = (w3 * (st ? (tri.get(tok) || 0) / st : 0) + w2 * (sb ? (bi.get(tok) || 0) / sb : 0) + w1 * (uni.get(tok) || 0) / this.total) / W;
      return { tok, p };
    });
    return out.sort((x, y) => y.p - x.p || (x.tok < y.tok ? -1 : 1));
  }
}

/** Apply temperature, then top-k, then top-p. Returns [{tok, p, q, kept}] where q is the final sampling prob. */
export function decode(dist, { temp = 1, topK = 0, topP = 1 } = {}) {
  let rows;
  if (temp <= 1e-6) rows = dist.map((d, i) => ({ ...d, t: i === 0 ? 1 : 0 }));
  else {
    const logits = dist.map(d => Math.log(Math.max(d.p, 1e-300)) / temp);
    const m = Math.max(...logits), e = logits.map(l => Math.exp(l - m)), s = e.reduce((a, b) => a + b, 0);
    rows = dist.map((d, i) => ({ ...d, t: e[i] / s }));
  }
  rows.sort((a, b) => b.t - a.t);
  let cum = 0;
  rows.forEach((r, i) => {
    const inK = !topK || i < topK;
    const inP = cum < topP - 1e-12 || i === 0;
    r.kept = inK && inP && r.t > 0;
    cum += r.t;
  });
  const S = rows.reduce((s, r) => s + (r.kept ? r.t : 0), 0);
  rows.forEach(r => (r.q = r.kept ? r.t / S : 0));
  return rows;
}

export function pick(rows, rnd) {
  let u = rnd(), acc = 0;
  for (const r of rows) { if (!r.kept) continue; acc += r.q; if (u < acc) return r.tok; }
  return rows.find(r => r.kept).tok;
}

export function generate(model, prompt, opts, rnd, maxLen = 30) {
  const ctx = tokenizeWords(prompt), out = [];
  for (let i = 0; i < maxLen; i++) {
    const tok = pick(decode(model.dist([...ctx, ...out]), opts), rnd);
    out.push(tok);
    if (tok === "." || tok === "!" || tok === "?") break;
  }
  return out;
}

export const detok = toks => toks.join(" ").replace(/ ([.,!?])/g, "$1");
