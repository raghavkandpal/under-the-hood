// Hamming(7,4): 4 data bits + 3 parity bits; corrects any single flipped bit. No DOM.
// Positions 1..7; parity bits at 1, 2, 4. Parity p covers every position whose index has bit p set.
import { mulberry } from "./autograd.js";

export function encode(d) { // d: [d1, d2, d3, d4]
  const c = [0, 0, d[0], 0, d[1], d[2], d[3]]; // index 0 = position 1
  for (const p of [1, 2, 4]) { let x = 0; for (let pos = 1; pos <= 7; pos++) if (pos & p && pos !== p) x ^= c[pos - 1]; c[p - 1] = x; }
  return c;
}

/** Syndrome = XOR of the positions of all 1-bits; 0 means "looks fine", otherwise it IS the bad position. */
export function syndrome(c) { let s = 0; for (let pos = 1; pos <= 7; pos++) if (c[pos - 1]) s ^= pos; return s; }

export function decode(c) {
  const s = syndrome(c), fixed = c.slice();
  if (s) fixed[s - 1] ^= 1;
  return { data: [fixed[2], fixed[4], fixed[5], fixed[6]], syndrome: s, fixed };
}

export const covers = p => [1, 2, 3, 4, 5, 6, 7].filter(pos => pos & p);

const bitsOf = bytes => bytes.flatMap(b => [7, 6, 5, 4, 3, 2, 1, 0].map(i => (b >> i) & 1));
const bytesOf = bits => { const out = []; for (let i = 0; i + 8 <= bits.length; i += 8) out.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0)); return out; };

/** Send text through a channel that flips each bit with probability p, with and without Hamming protection. */
export function transmit(text, p, seed = 1) {
  const r = mulberry(seed), bytes = [...new TextEncoder().encode(text)], bits = bitsOf(bytes);
  const noisy = b => b.map(x => (r() < p ? x ^ 1 : x));
  const rawOut = bytesOf(noisy(bits));
  const coded = []; for (let i = 0; i < bits.length; i += 4) coded.push(...encode(bits.slice(i, i + 4)));
  const recv = noisy(coded), dec = [];
  let corrected = 0;
  for (let i = 0; i < recv.length; i += 7) { const d = decode(recv.slice(i, i + 7)); if (d.syndrome) corrected++; dec.push(...d.data); }
  const td = new TextDecoder("utf-8", { fatal: false });
  const bitErr = (a, b) => a.reduce((s, x, i) => s + (x !== b[i]), 0);
  return {
    raw: td.decode(new Uint8Array(rawOut)), coded: td.decode(new Uint8Array(bytesOf(dec))),
    rawBitErrors: bitErr(bitsOf(rawOut), bits), codedBitErrors: bitErr(dec, bits),
    sentBits: bits.length, codedBits: coded.length, corrected,
  };
}
