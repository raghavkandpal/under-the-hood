// Proof of work with real SHA-256 (Web Crypto): find a nonce whose hash starts with k zero hex digits. No DOM.
const enc = new TextEncoder();
export async function sha256hex(s) { const b = await globalThis.crypto.subtle.digest("SHA-256", enc.encode(s)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join(""); }

export const blockText = (prev, data, nonce) => `${prev}|${data}|${nonce}`;
export const meets = (hash, zeros) => hash.startsWith("0".repeat(zeros));

/** Mine: try nonces until the hash has `zeros` leading hex zeros. onProgress(tries) every batch; shouldStop() aborts. */
export async function mine(prev, data, zeros, { start = 0, onProgress, shouldStop, batch = 500 } = {}) {
  for (let nonce = start; ; nonce++) {
    const h = await sha256hex(blockText(prev, data, nonce));
    if (meets(h, zeros)) return { nonce, hash: h, tries: nonce - start + 1 };
    if ((nonce - start) % batch === 0) { onProgress?.(nonce - start + 1); if (shouldStop?.()) return null; await new Promise(r => setTimeout(r, 0)); }
  }
}

/** Verify a chain: each block's hash meets difficulty and links to the previous. */
export async function verifyChain(blocks, zeros) {
  const bad = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i], h = await sha256hex(blockText(b.prev, b.data, b.nonce));
    const linkOk = i === 0 ? b.prev === "0".repeat(64) : b.prev === blocks[i - 1].hash;
    if (h !== b.hash || !meets(h, zeros) || !linkOk) bad.push(i);
  }
  return bad;
}
export const expectedTries = zeros => 16 ** zeros;
