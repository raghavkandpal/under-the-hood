// Simpson's paradox on 2×2×k tables. No DOM.

/** data: { groups: [name...], arms: [name...], cells: [[{s, n} per arm] per group] } */
export function analyse(data) {
  const per = data.cells.map(row => row.map(c => (c.n ? c.s / c.n : 0)));
  const tot = data.arms.map((_, a) => { const s = data.cells.reduce((x, r) => x + r[a].s, 0), n = data.cells.reduce((x, r) => x + r[a].n, 0); return { s, n, r: n ? s / n : 0 }; });
  const winnerIn = row => (row[0] > row[1] ? 0 : row[1] > row[0] ? 1 : -1);
  const groupWinners = per.map(winnerIn), overall = winnerIn(tot.map(t => t.r));
  const paradox = groupWinners.every(w => w !== -1 && w === groupWinners[0]) && overall !== -1 && overall !== groupWinners[0];
  // share of each arm's patients that fall in each group (the confounder's footprint)
  const mix = data.arms.map((_, a) => data.cells.map(r => r[a].n / (tot[a].n || 1)));
  return { per, tot, groupWinners, overall, paradox, mix };
}

export const EXAMPLES = {
  stones: {
    label: "Kidney-stone treatments (published 1986 study)",
    groups: ["Small stones", "Large stones"], arms: ["Treatment A", "Treatment B"], outcome: "success",
    cells: [[{ s: 81, n: 87 }, { s: 234, n: 270 }], [{ s: 192, n: 263 }, { s: 55, n: 80 }]],
    note: "Doctors gave the more invasive treatment A to the harder, large-stone cases. Case severity is the hidden third variable.",
  },
  courses: {
    label: "Two online courses (made-up numbers)",
    groups: ["Beginners", "Experienced"], arms: ["Course X", "Course Y"], outcome: "pass",
    cells: [[{ s: 30, n: 100 }, { s: 5, n: 20 }], [{ s: 18, n: 20 }, { s: 85, n: 100 }]],
    note: "Course Y is mostly taken by experienced students, who pass anything. Course X is better for both groups.",
  },
};
