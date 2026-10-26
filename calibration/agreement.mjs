// How well do the AI scorecards agree with people, and with themselves?
//
//   node calibration/agreement.mjs grades.csv [more.csv ...]
//
// CSV columns: session,grader,dimension,score. Scores are 1 to 4, or a verdict
// ("no hire"). Graders named ai... are the model (see regrade.mjs); anyone else
// is a person. For each dimension it reports quadratic weighted kappa with a
// bootstrap 95% interval over sessions, exact agreement and agreement within one
// point, for AI vs people, people vs people (the ceiling to aim for) and AI vs
// AI (does the model give the same session the same score twice).
import { readFileSync } from 'node:fs';
import { parseCsv, pairsBySession, weightedKappa, exact, withinOne, bootstrap } from './stats.js';
import { rng } from '../execute.js';

const files = process.argv.slice(2);
if (!files.length) { console.error('usage: node calibration/agreement.mjs grades.csv [...]'); process.exit(1); }
const rows = files.flatMap((f) => parseCsv(readFileSync(f, 'utf8')));
const fmt = (v) => (v == null ? '  -  ' : v.toFixed(2).padStart(5));
const pct = (v) => `${Math.round(100 * v)}%`.padStart(4);

console.log(`${rows.length} scores, ${new Set(rows.map((r) => r.session)).size} sessions, graders: ${[...new Set(rows.map((r) => r.grader))].join(', ')}\n`);
console.log('dimension            comparison     sessions  pairs  kappa  95% interval    exact  within 1');
for (const [dim, sessions] of Object.entries(pairsBySession(rows))) {
  for (const [kind, label] of [['aiHuman', 'AI vs people'], ['humanHuman', 'people vs people'], ['aiAi', 'AI vs AI']]) {
    const used = sessions.filter((s) => s[kind].length);
    const pairs = used.flatMap((s) => s[kind]);
    if (!pairs.length) continue;
    const [lo, hi] = bootstrap(used, (sample) => weightedKappa(sample.flatMap((s) => s[kind])), { rand: rng(7) });
    console.log(`${dim.padEnd(20)} ${label.padEnd(16)} ${String(used.length).padStart(6)} ${String(pairs.length).padStart(6)}  ${fmt(weightedKappa(pairs))}  [${fmt(lo)}, ${fmt(hi)}]  ${pct(exact(pairs))}   ${pct(withinOne(pairs))}`);
  }
}
