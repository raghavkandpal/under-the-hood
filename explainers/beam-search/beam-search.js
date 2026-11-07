// Greedy decoding vs beam search over a tiny made-up next-word model. No DOM.

/** Next-word probabilities after each prefix. "." ends the sentence. */
export const MODEL = {
  "": { the: 0.5, a: 0.4, my: 0.1 },
  "the": { cat: 0.4, dog: 0.35, plan: 0.25 },
  "a": { quiet: 0.9, cat: 0.1 },
  "my": { dog: 0.9, plan: 0.1 },
  "the cat": { sat: 0.35, ran: 0.3, ".": 0.35 },
  "the dog": { barked: 0.5, ".": 0.5 },
  "the plan": { worked: 0.6, ".": 0.4 },
  "a quiet": { night: 0.85, cat: 0.15 },
  "a cat": { ".": 1 },
  "my dog": { ".": 1 },
  "my plan": { ".": 1 },
  "the cat sat": { ".": 1 }, "the cat ran": { ".": 1 }, "the dog barked": { ".": 1 }, "the plan worked": { ".": 1 },
  "a quiet night": { ".": 1 }, "a quiet cat": { ".": 1 },
};
const next = prefix => MODEL[prefix.trim()] ?? { ".": 1 };
const extend = (seq, w) => (seq ? seq + " " + w : w);
const done = seq => seq.endsWith(".");

/**
 * Keep the k most probable partial sentences at each step (k = 1 is greedy). Returns the best finished sentence,
 * every step's kept and dropped candidates, and how many candidates were scored.
 */
export function beam(k, maxLen = 6) {
  let beams = [{ seq: "", p: 1 }], steps = [], scored = 0;
  for (let t = 0; t < maxLen && beams.some(b => !done(b.seq)); t++) {
    const cands = beams.flatMap(b => (done(b.seq) ? [b] : Object.entries(next(b.seq)).map(([w, q]) => (scored++, { seq: extend(b.seq, w), p: b.p * q }))));
    cands.sort((a, b) => b.p - a.p);
    beams = cands.slice(0, k); steps.push({ kept: beams, dropped: cands.slice(k) });
  }
  const best = beams.filter(b => done(b.seq)).sort((a, b) => b.p - a.p)[0];
  return { best, steps, scored };
}

/** Every finished sentence the model can produce, most probable first. */
export function all(seq = "", p = 1) {
  if (done(seq)) return [{ seq, p }];
  return Object.entries(next(seq)).flatMap(([w, q]) => all(extend(seq, w), p * q)).sort((a, b) => b.p - a.p);
}
