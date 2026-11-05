// Classifier evaluation: confusion matrix at a threshold, ROC and precision-recall curves, AUC. No DOM.
import { mulberry } from "../../shared/random.js";

/** Scores for positives ~ N(sep, 1) and negatives ~ N(0, 1); prevalence = share of positives. */
export function makeScores({ n = 1000, sep = 1.5, prevalence = 0.3, seed = 1 } = {}) {
  const r = mulberry(seed), g = () => Math.sqrt(-2 * Math.log(r() || 1e-12)) * Math.cos(2 * Math.PI * r());
  const pos = Math.round(n * prevalence);
  return [...Array.from({ length: pos }, () => ({ s: sep + g(), y: 1 })), ...Array.from({ length: n - pos }, () => ({ s: g(), y: 0 }))];
}

export function confusion(data, t) {
  let tp = 0, fp = 0, tn = 0, fn = 0;
  for (const d of data) { if (d.s >= t) d.y ? tp++ : fp++; else d.y ? fn++ : tn++; }
  const precision = tp + fp ? tp / (tp + fp) : 1, recall = tp + fn ? tp / (tp + fn) : 0, fpr = fp + tn ? fp / (fp + tn) : 0;
  const accuracy = (tp + tn) / data.length, f1 = precision + recall ? 2 * precision * recall / (precision + recall) : 0;
  return { tp, fp, tn, fn, precision, recall, fpr, accuracy, f1 };
}

/** Sweep every threshold; returns points ordered from strictest to loosest. */
export function curves(data) {
  const sorted = data.slice().sort((a, b) => b.s - a.s), P = data.filter(d => d.y).length, N = data.length - P;
  let tp = 0, fp = 0; const roc = [{ fpr: 0, tpr: 0, t: Infinity }], pr = [];
  for (let i = 0; i < sorted.length; i++) {
    sorted[i].y ? tp++ : fp++;
    if (i < sorted.length - 1 && sorted[i + 1].s === sorted[i].s) continue;
    roc.push({ fpr: fp / N, tpr: tp / P, t: sorted[i].s });
    pr.push({ recall: tp / P, precision: tp / (tp + fp), t: sorted[i].s });
  }
  let auc = 0; for (let i = 1; i < roc.length; i++) auc += (roc[i].fpr - roc[i - 1].fpr) * (roc[i].tpr + roc[i - 1].tpr) / 2;
  return { roc, pr, auc, base: P / data.length };
}
