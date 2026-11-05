// Retrieval-augmented generation: chunk documents, embed them, retrieve the closest chunks, build the prompt. No DOM.
// Embeddings here are TF-IDF word vectors: transparent, but blind to synonyms (real systems use learned embeddings).

/** A small, made-up company handbook (written for this page). */
export const DOCS = [
  { title: "Returns", text: "You can return any bike within 30 days of delivery for a full refund. The bike must be unridden and in its original box. Return shipping is free for members and costs 25 dollars for everyone else. Refunds reach your card within 5 business days after the warehouse inspects the bike." },
  { title: "Warranty", text: "Every frame has a lifetime warranty against cracks for the original owner. Components such as brakes, gears and wheels are covered for 2 years. Damage from crashes, racing or missing maintenance is not covered. To claim, send photos of the damage and your order number to the support team." },
  { title: "Shipping", text: "Orders ship from our warehouse in Leeds within 2 working days. Delivery takes 3 to 5 days in the UK and 7 to 12 days to the rest of Europe. We do not ship outside Europe. Bikes arrive 90 percent assembled and need the handlebars and pedals fitted." },
  { title: "Membership", text: "Membership costs 40 dollars a year. Members get free return shipping, a free annual service at any partner shop, and early access to sales. You can cancel membership at any time and the unused months are refunded." },
  { title: "Servicing", text: "We recommend a service every 6 months or 2000 kilometres. Partner shops are listed on the website. A standard service costs 60 dollars and includes brake and gear adjustment, chain cleaning and a safety check." },
];

const STOP = new Set("a an and are as at be by can do does for from has have how i if in is it its my of on or our so such the their them there this to we what when where which who will with within you your any after every".split(" "));
const stem = w => w.replace(/(ing|ed|es|s)$/, "").replace(/(.)\1$/, "$1");
export const words = text => text.toLowerCase().match(/[a-z0-9]+/g) || [];
const terms = text => words(text).filter(w => !STOP.has(w)).map(stem);

/** Split each document into chunks of `size` words, each overlapping the previous by `overlap` words. */
export function chunk(docs, size = 30, overlap = 0) {
  const out = [], step = Math.max(1, size - overlap);
  for (const d of docs) { const w = d.text.split(/\s+/); for (let i = 0; i < w.length; i += step) { out.push({ doc: d.title, text: w.slice(i, i + size).join(" "), start: i }); if (i + size >= w.length) break; } }
  return out;
}

/** Fit TF-IDF on the chunks; returns embed(text) → sparse vector (Map term → weight, unit length). */
export function fit(chunks) {
  const df = new Map(); for (const c of chunks) for (const t of new Set(terms(c.text))) df.set(t, (df.get(t) || 0) + 1);
  const N = chunks.length;
  return text => {
    const tf = new Map(); for (const t of terms(text)) tf.set(t, (tf.get(t) || 0) + 1);
    const v = new Map(); let norm = 0;
    for (const [t, f] of tf) { const w = f * Math.log(1 + N / (df.get(t) || N)); v.set(t, w); norm += w * w; }
    norm = Math.sqrt(norm) || 1; for (const [t, w] of v) v.set(t, w / norm); return v;
  };
}
export const cosine = (a, b) => { let s = 0; for (const [t, w] of a) s += w * (b.get(t) || 0); return s; };

/** Top-k chunks for a question, with similarity scores. */
export function retrieve(question, chunks, k = 2) {
  const embed = fit(chunks), q = embed(question);
  return chunks.map((c, i) => ({ ...c, i, score: cosine(q, embed(c.text)) })).sort((a, b) => b.score - a.score).slice(0, k);
}

/** The text actually sent to the language model. */
export const prompt = (question, hits) => `Answer using only the context below. If the answer isn't there, say you don't know.\n\n${hits.map((h, i) => `[${i + 1}] (${h.doc}) ${h.text}`).join("\n")}\n\nQuestion: ${question}`;

/** Does the retrieved context contain every fact the answer needs? */
export const covers = (hits, facts) => facts.map(f => hits.some(h => h.text.toLowerCase().includes(f.toLowerCase())));

export const QUESTIONS = [
  { q: "How long do I have to return a bike?", facts: ["within 30 days of delivery"] },
  { q: "Is a cracked frame covered by the warranty?", facts: ["lifetime warranty against cracks"] },
  { q: "Do you ship to Canada?", facts: ["We do not ship outside Europe"] },
  { q: "As a member, what does returning a bike cost and how soon is my refund?", facts: ["free for members", "within 5 business days"] },
  { q: "How much is a yearly tune-up?", facts: ["costs 60 dollars"], note: "Uses “tune-up”, which never appears in the handbook (it says “service”). Word-matching retrieval misses it; learned embeddings know they mean the same." },
];
