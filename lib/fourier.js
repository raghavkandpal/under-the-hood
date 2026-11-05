// Discrete Fourier transform (naive and radix-2 FFT), inverse, and helpers. No DOM.

export function dft(re, im = new Array(re.length).fill(0)) {
  const N = re.length, R = new Float64Array(N), I = new Float64Array(N);
  for (let k = 0; k < N; k++) for (let n = 0; n < N; n++) { const a = -2 * Math.PI * k * n / N; R[k] += re[n] * Math.cos(a) - im[n] * Math.sin(a); I[k] += re[n] * Math.sin(a) + im[n] * Math.cos(a); }
  return { re: R, im: I };
}

/** In-place iterative Cooley–Tukey FFT; N must be a power of two. inverse=true for the inverse (scaled by 1/N). */
export function fft(reIn, imIn = null, inverse = false) {
  const N = reIn.length; if (N & (N - 1)) throw new Error("length must be a power of two");
  const re = Float64Array.from(reIn), im = imIn ? Float64Array.from(imIn) : new Float64Array(N);
  for (let i = 1, j = 0; i < N; i++) { let bit = N >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= N; len <<= 1) {
    const ang = (inverse ? 2 : -2) * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < N; i += len) {
      let cr = 1, ci = 0;
      for (let j = 0; j < len / 2; j++) {
        const ar = re[i + j], ai = im[i + j], br = re[i + j + len / 2] * cr - im[i + j + len / 2] * ci, bi = re[i + j + len / 2] * ci + im[i + j + len / 2] * cr;
        re[i + j] = ar + br; im[i + j] = ai + bi; re[i + j + len / 2] = ar - br; im[i + j + len / 2] = ai - bi;
        [cr, ci] = [cr * wr - ci * wi, cr * wi + ci * wr];
      }
    }
  }
  if (inverse) for (let i = 0; i < N; i++) { re[i] /= N; im[i] /= N; }
  return { re, im };
}

/** Amplitude of each frequency 0..N/2 for a real signal (so a sine of amplitude A shows as A). */
export function spectrum(x) {
  const { re, im } = fft(x), N = x.length;
  return Array.from({ length: N / 2 + 1 }, (_, k) => Math.hypot(re[k], im[k]) * (k === 0 || k === N / 2 ? 1 : 2) / N);
}

/** Keep only frequencies where keep(k) is true, then transform back. */
export function filter(x, keep) {
  const N = x.length, { re, im } = fft(x);
  for (let k = 0; k < N; k++) { const f = Math.min(k, N - k); if (!keep(f)) { re[k] = 0; im[k] = 0; } }
  return Array.from(fft(re, im, true).re);
}

export function synth(N, waves, noise = 0, rnd = Math.random) {
  return Array.from({ length: N }, (_, n) => waves.reduce((s, w) => s + w.amp * Math.sin(2 * Math.PI * w.freq * n / N + (w.phase || 0)), 0) + (noise ? (rnd() - 0.5) * 2 * noise : 0));
}
