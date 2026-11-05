// 2-D convolution on grayscale images (values 0..1), with the classic kernels. No DOM.

export function gaussian(size = 5, sigma = 1) {
  const r = size >> 1, k = [];
  for (let y = -r; y <= r; y++) { const row = []; for (let x = -r; x <= r; x++) row.push(Math.exp(-(x * x + y * y) / (2 * sigma * sigma))); k.push(row); }
  const s = k.flat().reduce((a, b) => a + b, 0);
  return k.map(row => row.map(v => v / s));
}

export const KERNELS = {
  identity: { label: "Identity", k: [[0, 0, 0], [0, 1, 0], [0, 0, 0]] },
  box: { label: "Box blur", k: [[1, 1, 1], [1, 1, 1], [1, 1, 1]].map(r => r.map(v => v / 9)) },
  gauss: { label: "Gaussian blur (5×5)", k: gaussian(5, 1.2) },
  sharpen: { label: "Sharpen", k: [[0, -1, 0], [-1, 5, -1], [0, -1, 0]] },
  sobelX: { label: "Edges: vertical (Sobel x)", k: [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]], signed: true },
  sobelY: { label: "Edges: horizontal (Sobel y)", k: [[-1, -2, -1], [0, 0, 0], [1, 2, 1]], signed: true },
  laplace: { label: "Edges: all directions (Laplacian)", k: [[0, 1, 0], [1, -4, 1], [0, 1, 0]], signed: true },
  emboss: { label: "Emboss", k: [[-2, -1, 0], [-1, 1, 1], [0, 1, 2]] },
};

/** Correlate image with kernel (what image libraries and CNNs call convolution). Edges are clamped. */
export function convolve(img, w, h, k) {
  const kh = k.length, kw = k[0].length, ry = kh >> 1, rx = kw >> 1, out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0;
    for (let j = 0; j < kh; j++) { const yy = Math.min(h - 1, Math.max(0, y + j - ry)); for (let i = 0; i < kw; i++) { const xx = Math.min(w - 1, Math.max(0, x + i - rx)); s += img[yy * w + xx] * k[j][i]; } }
    out[y * w + x] = s;
  }
  return out;
}

export function sobelMagnitude(img, w, h) {
  const gx = convolve(img, w, h, KERNELS.sobelX.k), gy = convolve(img, w, h, KERNELS.sobelY.k), out = new Float32Array(w * h);
  for (let i = 0; i < out.length; i++) out[i] = Math.hypot(gx[i], gy[i]);
  return out;
}

/** The products for one output pixel, so a UI can show the arithmetic. */
export function explainPixel(img, w, h, k, x, y) {
  const kh = k.length, kw = k[0].length, ry = kh >> 1, rx = kw >> 1, cells = [];
  let sum = 0;
  for (let j = 0; j < kh; j++) for (let i = 0; i < kw; i++) {
    const yy = Math.min(h - 1, Math.max(0, y + j - ry)), xx = Math.min(w - 1, Math.max(0, x + i - rx)), v = img[yy * w + xx];
    cells.push({ v, k: k[j][i], p: v * k[j][i] }); sum += v * k[j][i];
  }
  return { cells, sum, kw, kh };
}
