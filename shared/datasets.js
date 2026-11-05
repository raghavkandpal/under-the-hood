// Seeded 2-D toy datasets for classification. Labels are ±1. No DOM.
import { mulberry } from "./random.js";

const gauss = rnd => Math.sqrt(-2 * Math.log(rnd() || 1e-12)) * Math.cos(2 * Math.PI * rnd());

export const DATASETS = {
  blobs: { label: "Two blobs", gen: (n, rnd, noise) => Array.from({ length: n }, (_, i) => {
    const c = i % 2 ? 1 : -1; return { x: [c * 1.1 + gauss(rnd) * (0.45 + noise), c * 0.9 + gauss(rnd) * (0.45 + noise)], y: c }; }) },
  xor: { label: "XOR", gen: (n, rnd, noise) => Array.from({ length: n }, () => {
    const a = rnd() * 4 - 2, b = rnd() * 4 - 2; const pad = v => v + Math.sign(v) * 0.15;
    return { x: [pad(a) + gauss(rnd) * noise, pad(b) + gauss(rnd) * noise], y: a * b > 0 ? 1 : -1 }; }) },
  circles: { label: "Circle in a ring", gen: (n, rnd, noise) => Array.from({ length: n }, (_, i) => {
    const inner = i % 2 === 0, r = inner ? rnd() * 0.9 : 1.4 + rnd() * 0.6, t = rnd() * 2 * Math.PI;
    return { x: [r * Math.cos(t) + gauss(rnd) * noise, r * Math.sin(t) + gauss(rnd) * noise], y: inner ? 1 : -1 }; }) },
  spiral: { label: "Spiral", gen: (n, rnd, noise) => Array.from({ length: n }, (_, i) => {
    const c = i % 2 ? 1 : -1, k = Math.floor(i / 2) / (n / 2), r = k * 2, t = 1.75 * k * 2 * Math.PI + (c > 0 ? 0 : Math.PI);
    return { x: [r * Math.sin(t) + gauss(rnd) * (0.08 + noise), r * Math.cos(t) + gauss(rnd) * (0.08 + noise)], y: c }; }) },
};

export function makeDataset(kind, { n = 160, seed = 1, noise = 0 } = {}) {
  return DATASETS[kind].gen(n, mulberry(seed), noise);
}
