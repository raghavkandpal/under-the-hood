// The lossy core of JPEG: 8×8 DCT, quantisation, zig-zag, and reconstruction (grayscale). No DOM.

const C = Array.from({ length: 8 }, (_, u) => Array.from({ length: 8 }, (_, x) => (u ? Math.sqrt(2 / 8) : Math.sqrt(1 / 8)) * Math.cos((2 * x + 1) * u * Math.PI / 16)));

/** 2-D DCT-II of an 8×8 block (values centred around 0). */
export function dct(b) {
  const t = Array.from({ length: 8 }, () => new Float64Array(8)), out = Array.from({ length: 8 }, () => new Float64Array(8));
  for (let y = 0; y < 8; y++) for (let u = 0; u < 8; u++) { let s = 0; for (let x = 0; x < 8; x++) s += C[u][x] * b[y][x]; t[y][u] = s; }
  for (let v = 0; v < 8; v++) for (let u = 0; u < 8; u++) { let s = 0; for (let y = 0; y < 8; y++) s += C[v][y] * t[y][u]; out[v][u] = s; }
  return out;
}
export function idct(F) {
  const t = Array.from({ length: 8 }, () => new Float64Array(8)), out = Array.from({ length: 8 }, () => new Float64Array(8));
  for (let v = 0; v < 8; v++) for (let x = 0; x < 8; x++) { let s = 0; for (let u = 0; u < 8; u++) s += C[u][x] * F[v][u]; t[v][x] = s; }
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { let s = 0; for (let v = 0; v < 8; v++) s += C[v][y] * t[v][x]; out[y][x] = s; }
  return out;
}

// Standard JPEG luminance quantisation table (Annex K).
export const QT = [[16, 11, 10, 16, 24, 40, 51, 61], [12, 12, 14, 19, 26, 58, 60, 55], [14, 13, 16, 24, 40, 57, 69, 56], [14, 17, 22, 29, 51, 87, 80, 62],
  [18, 22, 37, 56, 68, 109, 103, 77], [24, 35, 55, 64, 81, 104, 113, 92], [49, 64, 78, 87, 103, 121, 120, 101], [72, 92, 95, 98, 112, 100, 103, 99]];
/** libjpeg-style quality scaling, quality 1..100. */
export function qtable(quality) {
  const q = Math.max(1, Math.min(100, quality)), s = q < 50 ? 5000 / q : 200 - 2 * q;
  return QT.map(r => r.map(v => Math.max(1, Math.floor((v * s + 50) / 100))));
}
export const ZIGZAG = (() => { const o = []; for (let s = 0; s < 15; s++) for (let i = 0; i <= s; i++) { const j = s - i; if (i < 8 && j < 8) o.push(s % 2 ? [i, j] : [j, i]); } return o; })();

/** Compress a w×h grayscale image (0..255, w,h multiples of 8). Returns reconstruction and stats. */
export function compress(img, w, h, quality) {
  const Q = qtable(quality), out = new Float32Array(w * h); let nonzero = 0, runBits = 0;
  for (let by = 0; by < h; by += 8) for (let bx = 0; bx < w; bx += 8) {
    const b = Array.from({ length: 8 }, (_, y) => Array.from({ length: 8 }, (_, x) => img[(by + y) * w + bx + x] - 128));
    const F = dct(b), q = F.map((r, v) => r.map((c, u) => Math.round(c / Q[v][u])));
    // rough size: ~ (4 + log2|c| bits) per non-zero coefficient plus an end-of-block code
    for (const [v, u] of ZIGZAG) if (q[v][u]) { nonzero++; runBits += 4 + Math.ceil(Math.log2(Math.abs(q[v][u]) + 1)) + 1; }
    runBits += 4;
    const rec = idct(q.map((r, v) => r.map((c, u) => c * Q[v][u])));
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) out[(by + y) * w + bx + x] = Math.max(0, Math.min(255, rec[y][x] + 128));
  }
  let se = 0; for (let i = 0; i < img.length; i++) se += (img[i] - out[i]) ** 2;
  const mse = se / img.length;
  return { out, nonzero, bytes: Math.ceil(runBits / 8), psnr: mse ? 10 * Math.log10(255 * 255 / mse) : Infinity };
}
