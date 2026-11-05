// Grid-world reinforcement learning: tabular Q-learning and value iteration. No DOM.
import { mulberry } from "../../shared/random.js";

export const ACTIONS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // up, right, down, left
export const ARROWS = ["↑", "→", "↓", "←"];

/** layout: array of strings. S start, G goal, X pit, # wall, . empty */
export class Grid {
  constructor(layout, { step = -1, goal = 20, pit = -20, slip = 0 } = {}) {
    this.h = layout.length; this.w = layout[0].length; this.cells = layout.map(r => [...r]);
    this.rew = { step, goal, pit }; this.slip = slip;
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (this.cells[y][x] === "S") this.start = y * this.w + x;
  }
  at(s) { return this.cells[Math.floor(s / this.w)][s % this.w]; }
  terminal(s) { const c = this.at(s); return c === "G" || c === "X"; }
  move(s, a) {
    const x = s % this.w, y = Math.floor(s / this.w), [dx, dy] = ACTIONS[a], nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= this.w || ny >= this.h || this.cells[ny][nx] === "#") return s;
    return ny * this.w + nx;
  }
  reward(s2) { const c = this.at(s2); return c === "G" ? this.rew.goal : c === "X" ? this.rew.pit : this.rew.step; }
  /** Stochastic step: with prob `slip` the agent moves in a random perpendicular direction. */
  step(s, a, rnd) {
    if (this.slip && rnd() < this.slip) a = (a + (rnd() < 0.5 ? 1 : 3)) % 4;
    const s2 = this.move(s, a); return { s2, r: this.reward(s2), done: this.terminal(s2) };
  }
  get n() { return this.w * this.h; }
}

export class QLearner {
  /** init: starting Q-value. A high ("optimistic") value makes untried moves look attractive, which drives exploration. */
  constructor(grid, { alpha = 0.5, gamma = 0.95, epsilon = 0.2, seed = 1, init = 0 } = {}) {
    Object.assign(this, { grid, alpha, gamma, epsilon }); this.rnd = mulberry(seed);
    this.Q = Array.from({ length: grid.n }, () => [init, init, init, init]); this.episodes = 0; this.history = [];
  }
  greedy(s) { const q = this.Q[s], m = Math.max(...q); const best = q.map((v, i) => [v, i]).filter(([v]) => v === m); return best[Math.floor(this.rnd() * best.length)][1]; }
  act(s) { return this.rnd() < this.epsilon ? Math.floor(this.rnd() * 4) : this.greedy(s); }
  /** Run one episode, return {path, total}. */
  episode(maxSteps = 200) {
    let s = this.grid.start, total = 0; const path = [s];
    for (let t = 0; t < maxSteps; t++) {
      const a = this.act(s), { s2, r, done } = this.grid.step(s, a, this.rnd);
      const target = r + (done ? 0 : this.gamma * Math.max(...this.Q[s2]));
      this.Q[s][a] += this.alpha * (target - this.Q[s][a]);
      total += r; s = s2; path.push(s);
      if (done) break;
    }
    this.episodes++; this.history.push(total);
    return { path, total };
  }
  policyPath(maxSteps = 100) { const p = [this.grid.start]; let s = this.grid.start; for (let t = 0; t < maxSteps && !this.grid.terminal(s); t++) { s = this.grid.move(s, this.greedy(s)); if (p.includes(s)) { p.push(s); break; } p.push(s); } return p; }
}

/** Exact planning when the model is known (deterministic moves, or expected over slip). */
export function valueIteration(grid, gamma = 0.95, iters = 500) {
  const V = new Array(grid.n).fill(0), policy = new Array(grid.n).fill(0);
  const outcomes = (s, a) => grid.slip ? [[a, 1 - grid.slip], [(a + 1) % 4, grid.slip / 2], [(a + 3) % 4, grid.slip / 2]] : [[a, 1]];
  for (let it = 0; it < iters; it++) {
    let delta = 0;
    for (let s = 0; s < grid.n; s++) {
      if (grid.terminal(s) || grid.at(s) === "#") continue;
      let best = -Infinity, ba = 0;
      for (let a = 0; a < 4; a++) {
        const q = outcomes(s, a).reduce((sum, [aa, p]) => { const s2 = grid.move(s, aa); return sum + p * (grid.reward(s2) + (grid.terminal(s2) ? 0 : gamma * V[s2])); }, 0);
        if (q > best) { best = q; ba = a; }
      }
      delta = Math.max(delta, Math.abs(best - V[s])); V[s] = best; policy[s] = ba;
    }
    if (delta < 1e-9) break;
  }
  return { V, policy };
}
