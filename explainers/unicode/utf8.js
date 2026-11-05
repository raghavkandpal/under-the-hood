// UTF-8 and UTF-16 encoders/decoders written out by hand, for display. No DOM.

/** Bytes for one code point, plus which bits are the fixed prefix. */
export function encodeCP(cp) {
  if (cp < 0 || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) throw new Error("not a Unicode scalar value");
  if (cp < 0x80) return [cp];
  if (cp < 0x800) return [0xc0 | (cp >> 6), 0x80 | (cp & 63)];
  if (cp < 0x10000) return [0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63)];
  return [0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63)];
}
export const prefixLen = (byte, idx, n) => (n === 1 ? 1 : idx === 0 ? n + 1 : 2);

export function encode(str) { const out = []; for (const ch of str) out.push(...encodeCP(ch.codePointAt(0))); return out; }

/** Strict decoder; invalid sequences become U+FFFD with a reason. */
export function decode(bytes) {
  const out = [], errors = [];
  for (let i = 0; i < bytes.length;) {
    const b = bytes[i]; let n, cp, min;
    if (b < 0x80) { out.push(b); i++; continue; }
    if ((b & 0xe0) === 0xc0) { n = 2; cp = b & 31; min = 0x80; }
    else if ((b & 0xf0) === 0xe0) { n = 3; cp = b & 15; min = 0x800; }
    else if ((b & 0xf8) === 0xf0) { n = 4; cp = b & 7; min = 0x10000; }
    else { errors.push({ at: i, why: (b & 0xc0) === 0x80 ? "continuation byte with no lead byte" : "invalid lead byte" }); out.push(0xfffd); i++; continue; }
    let ok = true;
    for (let k = 1; k < n; k++) { const c = bytes[i + k]; if (c === undefined || (c & 0xc0) !== 0x80) { ok = false; break; } cp = (cp << 6) | (c & 63); }
    if (!ok) { errors.push({ at: i, why: "sequence cut short" }); out.push(0xfffd); i++; continue; }
    if (cp < min) { errors.push({ at: i, why: "overlong encoding" }); out.push(0xfffd); i += n; continue; }
    if (cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) { errors.push({ at: i, why: "not a valid code point" }); out.push(0xfffd); i += n; continue; }
    out.push(cp); i += n;
  }
  return { text: String.fromCodePoint(...out), errors };
}

export function utf16(cp) { if (cp < 0x10000) return [cp]; const v = cp - 0x10000; return [0xd800 | (v >> 10), 0xdc00 | (v & 0x3ff)]; }
/** What a decoder that wrongly assumes Windows-1252/Latin-1 would show. */
export function mojibake(bytes) {
  const cp1252 = { 0x80: 0x20ac, 0x82: 0x201a, 0x83: 0x192, 0x84: 0x201e, 0x85: 0x2026, 0x86: 0x2020, 0x87: 0x2021, 0x88: 0x2c6, 0x89: 0x2030, 0x8a: 0x160, 0x8b: 0x2039, 0x8c: 0x152, 0x8e: 0x17d, 0x91: 0x2018, 0x92: 0x2019, 0x93: 0x201c, 0x94: 0x201d, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014, 0x98: 0x2dc, 0x99: 0x2122, 0x9a: 0x161, 0x9b: 0x203a, 0x9c: 0x153, 0x9e: 0x17e, 0x9f: 0x178 };
  return String.fromCodePoint(...bytes.map(b => cp1252[b] ?? b));
}
export const hex = (n, w = 2) => n.toString(16).toUpperCase().padStart(w, "0");
