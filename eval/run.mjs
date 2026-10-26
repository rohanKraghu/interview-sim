// Interviewer eval: sends each scripted moment to the model several times and
// reports how often the reply passes its checks, plus a scorecard sanity check.
//
//   ANTHROPIC_API_KEY=... node eval/run.mjs [--repeat 3] [--only name] [--dry]
//
// Results go to eval/results/<timestamp>.json so runs can be compared.
import { mkdirSync, writeFileSync } from 'node:fs';
import { callClaude, parseJsonReply, turnRequest, scorecardRequest } from '../interviewer.js';
import { SCENARIOS, SCORE_SESSIONS } from './scenarios.js';

const arg = (name, d) => { const i = process.argv.indexOf(`--${name}`); return i < 0 ? d : process.argv[i + 1] ?? true; };
const repeat = Number(arg('repeat', 3));
const only = arg('only', '');
const dry = process.argv.includes('--dry');
const key = process.env.ANTHROPIC_API_KEY || process.env.INTERVIEW_SIM_API_KEY;
const picked = SCENARIOS.filter((s) => s.name.includes(only));

if (dry) {
  for (const s of picked) turnRequest(s.state, s.event);
  for (const s of Object.values(SCORE_SESSIONS)) scorecardRequest(s);
  console.log(`${picked.length} scenarios and ${Object.keys(SCORE_SESSIONS).length} scorecard sessions build requests.`);
  process.exit(0);
}
if (!key) { console.error('Set ANTHROPIC_API_KEY or INTERVIEW_SIM_API_KEY.'); process.exit(1); }

// A few calls at a time, retrying rate limits and overloads.
async function call(body) {
  for (let i = 0; ; i++) {
    try { return parseJsonReply(await callClaude(key, body)); } catch (e) {
      if (i >= 3 || !/rate|overload|529|5\d\d/i.test(e.message)) throw e;
      await new Promise((r) => setTimeout(r, 2000 * 2 ** i));
    }
  }
}
async function pool(jobs, n = 4) {
  const out = []; let next = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (next < jobs.length) { const i = next++; out[i] = await jobs[i](); } }));
  return out;
}

const jobs = picked.flatMap((s) => Array.from({ length: repeat }, () => async () => {
  try {
    const reply = await call(turnRequest(s.state, s.event));
    return { name: s.name, reply, fails: s.checks.map((c) => c(reply)).filter(Boolean) };
  } catch (e) { return { name: s.name, error: e.message, fails: [e.message] }; }
}));
const cardJobs = Object.entries(SCORE_SESSIONS).flatMap(([name, sess]) => Array.from({ length: repeat }, () => async () => {
  try { return { name, card: await call(scorecardRequest(sess)) }; } catch (e) { return { name, error: e.message }; }
}));

const runs = await pool([...jobs, ...cardJobs]);
const turns = runs.slice(0, jobs.length), cards = runs.slice(jobs.length);

let passed = 0;
console.log('\nInterviewer behaviour');
for (const s of picked) {
  const rs = turns.filter((r) => r.name === s.name);
  const ok = rs.filter((r) => !r.fails.length).length;
  passed += ok;
  console.log(`${ok === rs.length ? 'PASS' : 'FAIL'} ${ok}/${rs.length}  ${s.name.padEnd(24)} ${s.about}`);
  for (const r of rs) if (r.fails.length) console.log(`        ${r.fails.join('; ')}`);
}
console.log(`\n${passed}/${turns.length} replies passed (${Math.round((100 * passed) / turns.length)}%).`);

// Scorecard: the strong session must outscore the weak one on every run, and
// repeated grading of the same session should barely move.
const total = (c) => c.scores.reduce((a, x) => a + x.score, 0);
const by = (name) => cards.filter((c) => c.name === name && c.card).map((c) => c.card);
const strong = by('strong'), weak = by('weak');
if (strong.length && weak.length) {
  console.log('\nScorecard');
  for (const [name, cs] of [['strong', strong], ['weak', weak]]) {
    console.log(`${name.padEnd(7)} totals ${cs.map(total).join(', ')} of 20; verdicts ${cs.map((c) => c.verdict).join(', ')}`);
  }
  const ordered = Math.min(...strong.map(total)) > Math.max(...weak.map(total));
  const verdicts = strong.every((c) => /hire/.test(c.verdict) && !/no hire/.test(c.verdict)) && weak.every((c) => /no hire/.test(c.verdict));
  console.log(`${ordered ? 'PASS' : 'FAIL'} every strong total above every weak total`);
  console.log(`${verdicts ? 'PASS' : 'FAIL'} verdicts: strong hires, weak does not`);
}
for (const c of cards) if (c.error) console.log(`scorecard error (${c.name}): ${c.error}`);

mkdirSync(new URL('./results/', import.meta.url), { recursive: true });
const file = new URL(`./results/${new Date().toISOString().replace(/[:.]/g, '-')}.json`, import.meta.url);
writeFileSync(file, JSON.stringify({ repeat, turns, cards }, null, 1));
console.log(`\nSaved ${file.pathname}`);
