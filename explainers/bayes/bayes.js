// Bayes' theorem for a binary test, as probabilities and as natural frequencies. No DOM.

/** P(condition | positive) */
export function posterior(prior, sensitivity, falsePositiveRate) {
  const tp = prior * sensitivity, fp = (1 - prior) * falsePositiveRate;
  return tp + fp ? tp / (tp + fp) : 0;
}
/** P(condition | negative) */
export function posteriorNeg(prior, sensitivity, falsePositiveRate) {
  const fn = prior * (1 - sensitivity), tn = (1 - prior) * (1 - falsePositiveRate);
  return fn + tn ? fn / (fn + tn) : 0;
}

/** Whole-number breakdown of a population of n, rounded so the four cells add up to n. */
export function counts(n, prior, sensitivity, falsePositiveRate) {
  const sick = Math.round(n * prior), well = n - sick;
  const tp = Math.round(sick * sensitivity), fp = Math.round(well * falsePositiveRate);
  return { sick, well, tp, fn: sick - tp, fp, tn: well - fp };
}

export const SCENARIOS = {
  screening: { label: "Screening for a rare condition", thing: "have the condition", test: "test positive", prior: 0.01, sens: 0.9, fpr: 0.09 },
  spam: { label: "Spam filter", thing: "are spam", test: "get flagged", prior: 0.5, sens: 0.95, fpr: 0.02 },
  fraud: { label: "Card-fraud alert", thing: "are fraud", test: "trigger an alert", prior: 0.001, sens: 0.99, fpr: 0.01 },
  scanner: { label: "Airport scanner", thing: "carry something banned", test: "set off the alarm", prior: 0.0005, sens: 0.98, fpr: 0.03 },
};
