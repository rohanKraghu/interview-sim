// Agreement statistics for rubric scores on a 1 to 4 scale.

// Cohen's kappa with quadratic weights: 1 is perfect agreement, 0 is what
// chance alone would give. Near misses (3 vs 4) count less than far ones (1 vs 4).
export function weightedKappa(pairs, k = 4) {
  if (!pairs.length) return null;
  const w = (i, j) => ((i - j) ** 2) / ((k - 1) ** 2);
  const pa = Array(k + 1).fill(0), pb = Array(k + 1).fill(0);
  let observed = 0;
  for (const [a, b] of pairs) { pa[a]++; pb[b]++; observed += w(a, b); }
  let expected = 0;
  for (let i = 1; i <= k; i++) for (let j = 1; j <= k; j++) expected += (pa[i] * pb[j] * w(i, j)) / pairs.length;
  if (expected === 0) return observed === 0 ? 1 : null;
  return 1 - observed / expected;
}

export const exact = (pairs) => pairs.filter(([a, b]) => a === b).length / pairs.length;
export const withinOne = (pairs) => pairs.filter(([a, b]) => Math.abs(a - b) <= 1).length / pairs.length;

// 95% interval for stat(sample) by resampling sessions with replacement.
export function bootstrap(sessions, stat, { B = 2000, rand = Math.random } = {}) {
  const vals = [];
  for (let b = 0; b < B; b++) {
    const v = stat(Array.from(sessions, () => sessions[Math.floor(rand() * sessions.length)]));
    if (v != null && Number.isFinite(v)) vals.push(v);
  }
  vals.sort((a, b) => a - b);
  return vals.length ? [vals[Math.floor(0.025 * vals.length)], vals[Math.floor(0.975 * vals.length)]] : [null, null];
}

export const VERDICTS = ['strong no hire', 'no hire', 'hire', 'strong hire'];

// rows: [{session, grader, dimension, score}]. Graders whose name starts with
// "ai" are the model; everyone else is a person.
// Returns, per dimension, the score pairs for AI vs human, human vs human, and
// AI vs AI (the model grading the same session twice), keyed by session so the
// bootstrap can resample sessions.
export function pairsBySession(rows) {
  const isAi = (g) => /^ai/i.test(g);
  const grid = {}; // dimension -> session -> grader -> score
  for (const r of rows) ((grid[r.dimension] ||= {})[r.session] ||= {})[r.grader] = r.score;
  const out = {};
  for (const [dim, sessions] of Object.entries(grid)) {
    out[dim] = Object.entries(sessions).map(([session, g]) => {
      const names = Object.keys(g), pairs = { aiHuman: [], humanHuman: [], aiAi: [] };
      for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
        const [a, b] = [names[i], names[j]], kind = isAi(a) && isAi(b) ? 'aiAi' : isAi(a) || isAi(b) ? 'aiHuman' : 'humanHuman';
        pairs[kind].push(isAi(b) && !isAi(a) ? [g[b], g[a]] : [g[a], g[b]]);
      }
      return { session, ...pairs };
    });
  }
  return out;
}

export function parseCsv(text) {
  const [head, ...lines] = text.trim().split(/\r?\n/);
  const cols = head.split(',').map((c) => c.trim());
  return lines.filter((l) => l.trim()).map((l) => {
    const v = l.split(',').map((c) => c.trim());
    const row = Object.fromEntries(cols.map((c, i) => [c, v[i]]));
    const score = VERDICTS.includes(row.score) ? VERDICTS.indexOf(row.score) + 1 : Number(row.score);
    return { ...row, score };
  }).filter((r) => r.score >= 1 && r.score <= 4);
}
