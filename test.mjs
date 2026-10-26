// Run: node test.mjs
import assert from 'node:assert/strict';
import {
  PROBLEMS, FORMATS, PERSONAS, isEcho, quietEvent, numbered, turnRequest, scorecardRequest,
  parseJsonReply, pickProblems, sessionStats, timePlan, parseClock,
} from './interviewer.js';

// Echo filter
assert.equal(isEcho('talk me through what you are thinking', 'Can you talk me through what you are thinking?'), true);
assert.equal(isEcho('I think the heap version is O(n)', 'Can you talk me through what you are thinking?'), false);
assert.equal(isEcho('', 'anything'), true);

// Quiet nudges back off: 30s, then 45s, then 60s
const t0 = 1_000_000;
assert.equal(quietEvent(t0 + 29_000, t0, t0, 0, 0), null);
assert.match(quietEvent(t0 + 31_000, t0, t0, 0, 0), /not typing either/);
assert.equal(quietEvent(t0 + 40_000, t0, t0, t0, 1), null);
assert.match(quietEvent(t0 + 46_000, t0, t0 + 40_000, t0, 1), /typing .* but not talking/);

// Problem picking: chosen first, no repeats, random fill
const two = pickProblems('lru-cache', 2, () => 0);
assert.equal(two[0].id, 'lru-cache');
assert.notEqual(two[1].id, 'lru-cache');
assert.equal(pickProblems('', 1, () => 0).length, 1);
assert.equal(new Set(pickProblems('', 6).map((p) => p.id)).size, 6);
for (const p of PROBLEMS) for (const f of ['statement', 'notes', 'followup', 'curveball']) assert.ok(p[f], `${p.id}.${f}`);

// Time plan for the second problem of a 35-minute screen starts at 17:30
assert.equal(timePlan({ format: FORMATS.screen, problemStart: 17.5 * 60000 }),
  'approach agreed by 21:52, code written by 29:45, tested with complexity by 32:22, follow-ups until 35:00');
assert.equal(parseClock('12:05'), 725_000);
assert.equal(parseClock('soon'), null);

// Prompt carries numbered code, notes, plan, persona and the event
assert.equal(numbered('a\nb'), '  1 | a\n  2 | b');
const s = {
  format: FORMATS.screen, persona: PERSONAS.skeptical, problems: pickProblems('meeting-rooms', 2, () => 0), idx: 0,
  code: 'x = 1', codes: ['x = 1'], problemStart: 0, elapsed: 70_000, maxQuiet: 12_000,
  log: [
    { who: 'interviewer', kind: 'pushback', text: 'Are you sure about that?', t: 60_000 },
    { who: 'candidate', text: 'It is O(n) because one loop', t: 65_000 },
  ],
};
const req = turnRequest(s, 'EVT');
const msg = req.messages[0].content;
for (const part of ['  1 | x = 1', '[1:05] CANDIDATE: It is O(n) because one loop', '[1:00] INTERVIEWER (pushback)', 'NEW EVENT: EVT',
  'O(n log n)', '1:10 elapsed of 35:00', 'PROBLEM 1 OF 2', 'set move_on', 'Curveball:']) assert.ok(msg.includes(part), part);
assert.ok(req.system[0].text.includes('skeptical'));
assert.equal(req.output_config.format.type, 'json_schema');
const card = scorecardRequest(s).messages[0].content;
assert.ok(card.includes('FINAL CODE') && card.includes('PROBLEM 2') && card.includes('"pushback":1'));

// Stats
const st = sessionStats(s);
assert.equal(st.talkShare, 55); // 6 candidate words of 11
assert.equal(st.pushbacks, 1);
assert.equal(st.longestSilence, 12);

// Reply parsing
assert.deepEqual(parseJsonReply({ stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: '{"say":"Hi","end":false}' }] }), { say: 'Hi', end: false });
assert.throws(() => parseJsonReply({ stop_reason: 'refusal', content: [] }));

console.log('ok');

// Running code: reference solutions pass every hidden test in both languages,
// planted bugs fail the cases they should, and timing separates fast from slow.
import { RUNS, grade, runJsTests, loadJs, measureGrowth, fitSlope, pySource, rng, starter, evidenceText } from './execute.js';
import { JS, JS_SLOW, JS_BUGGY, PY, PY_SLOW } from './fixtures/solutions.js';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

assert.deepEqual(Object.keys(RUNS).sort(), PROBLEMS.map((p) => p.id).sort());
for (const [id, code] of Object.entries(JS)) assert.equal(grade(RUNS[id], runJsTests(code, RUNS[id])).failed.length, 0, `js ${id}`);
assert.deepEqual(grade(RUNS['meeting-rooms'], runJsTests(JS_BUGGY['meeting-rooms'], RUNS['meeting-rooms'])).failed.map((f) => f.expected), [1, 3]);
assert.deepEqual(grade(RUNS['longest-substring'], runJsTests(JS_BUGGY['longest-substring'], RUNS['longest-substring'])).failed.map((f) => f.args[0]), ['abba', 'tmmzuxt']);
assert.match(grade(RUNS.islands, runJsTests('function numIslands(g) { return g[5].length }', RUNS.islands)).failed[0].error, /TypeError/);
assert.throws(() => runJsTests('function nope() {}', RUNS.islands), /numIslands is not defined/);

const jsTime = (code, run) => { const call = loadJs(code, run); return (a) => { const t = performance.now(); call(a); return performance.now() - t; }; };
for (const id of Object.keys(JS_SLOW)) {
  const fast = measureGrowth(jsTime(JS[id], RUNS[id]), RUNS[id]).slope;
  const slow = measureGrowth(jsTime(JS_SLOW[id], RUNS[id]), RUNS[id]).slope;
  assert.ok(fast < 1.6 && slow > 1.7, `${id}: fast n^${fast?.toFixed(2)}, slow n^${slow?.toFixed(2)}`);
}
assert.equal(fitSlope([{ n: 1, ms: 1 }, { n: 2, ms: 4 }, { n: 4, ms: 16 }]).toFixed(2), '2.00');
assert.equal(fitSlope([{ n: 1, ms: 0.1 }, { n: 2, ms: 0.2 }]), null);
assert.match(evidenceText('islands', { tests: { passed: 6, total: 7, failed: [{ args: [[['1']]], expected: 1, got: 0 }] }, points: [{ n: 256, ms: 2 }, { n: 512, ms: 8 }, { n: 1024, ms: 32 }], slope: 2 }),
  /6 of 7 hidden tests passed \(failed: input .* expected 1, got 0\).*n\^2\.00: about quadratic/);
for (const p of PROBLEMS) for (const lang of ['python', 'javascript']) assert.ok(starter(p.id, lang).includes(lang === 'python' ? RUNS[p.id].py : RUNS[p.id].js));

// Python adapters, run with the local interpreter when there is one.
let py = true;
try { execFileSync('python3', ['--version']); } catch { py = false; console.log('skipped Python checks: no python3'); }
if (py) {
  const dir = mkdtempSync(join(tmpdir(), 'sim-'));
  const pyRun = (code, run, n) => {
    writeFileSync(join(dir, 'cases.json'), JSON.stringify(run.tests.map(([a]) => a)));
    writeFileSync(join(dir, 'args.json'), JSON.stringify(run.gen(n, rng(n))));
    writeFileSync(join(dir, 'p.py'), `${pySource(code, run)}\nprint(__tests(open('cases.json').read()))\nprint(__timed(open('args.json').read()))\n`);
    const [tests, ms] = execFileSync('python3', ['p.py'], { cwd: dir }).toString().trim().split('\n');
    return { results: JSON.parse(tests), ms: Number(ms) };
  };
  for (const [id, code] of Object.entries(PY)) assert.equal(grade(RUNS[id], pyRun(code, RUNS[id], 256).results).failed.length, 0, `py ${id}`);
  // Counting each distinct value with list.count is quadratic; Counter is linear.
  const ratio = (code) => pyRun(code, RUNS['top-k'], 16384).ms / pyRun(code, RUNS['top-k'], 4096).ms;
  assert.ok(ratio(PY_SLOW['top-k']) > 8 && ratio(PY['top-k']) < 8, 'python top-k timing');
}

console.log('ok: execute');

// Eval scenarios: each one's good example passes its checks and its bad one fails.
import { SCENARIOS, SCORE_SESSIONS } from './eval/scenarios.js';
const fill = (r) => ({ kind: 'silent', phase: 'code', move_on: false, end: false, ...r });
for (const sc of SCENARIOS) {
  assert.deepEqual(sc.checks.map((c) => c(fill(sc.good))).filter(Boolean), [], `${sc.name} good`);
  assert.ok(sc.checks.some((c) => c(fill(sc.bad))), `${sc.name} bad`);
  assert.ok(turnRequest(sc.state, sc.event).messages[0].content.includes(sc.event));
}
for (const sess of Object.values(SCORE_SESSIONS)) assert.ok(scorecardRequest(sess).messages[0].content.includes('FINAL RUN: MEASURED'));
console.log('ok: eval scenarios');

// Calibration statistics and scripts.
import { weightedKappa, exact, withinOne, bootstrap, pairsBySession, parseCsv } from './calibration/stats.js';
assert.equal(weightedKappa([[1, 1], [2, 3], [3, 3], [4, 3], [2, 2], [1, 2], [4, 4], [3, 1]]).toFixed(6), '0.611111'); // checked by hand in Python
assert.equal(weightedKappa([[1, 1], [2, 2], [3, 3], [4, 4]]), 1);
assert.ok(weightedKappa([[1, 4], [4, 1], [2, 3], [3, 2]]) < 0);
assert.equal(exact([[1, 1], [2, 3]]), 0.5);
assert.equal(withinOne([[1, 1], [2, 3], [1, 4]]).toFixed(2), '0.67');
const csv = parseCsv('session,grader,dimension,score\ns1,ai-1,testing,3\ns1,ai-2,testing,3\ns1,ana,testing,4\ns1,ben,testing,2\ns1,ana,verdict,no hire\ns1,ben,testing,\n');
assert.equal(csv.length, 5);
assert.equal(csv[4].score, 2);
const bySess = pairsBySession(csv).testing[0];
assert.deepEqual([bySess.aiAi, bySess.humanHuman, bySess.aiHuman.length], [[[3, 3]], [[4, 2]], 4]);
const [lo, hi] = bootstrap([{ p: [[1, 1], [2, 2]] }, { p: [[3, 3], [4, 4]] }, { p: [[1, 2], [4, 3]] }], (s) => weightedKappa(s.flatMap((x) => x.p)), { B: 200, rand: rng(3) });
assert.ok(lo <= hi && hi <= 1);

// The packet and agreement scripts run end to end on an exported session.
{
  const dir = mkdtempSync(join(tmpdir(), 'cal-'));
  const { format, persona, problems, ...rest } = SCORE_SESSIONS.strong;
  writeFileSync(join(dir, 's1.json'), JSON.stringify({ version: 1, id: 's1', formatId: 'onsite', personaId: 'neutral', ...rest, problems: problems.map((p) => p.id) }));
  const out = execFileSync('node', ['calibration/transcripts.mjs', join(dir, 'packet'), join(dir, 's1.json')]).toString();
  assert.match(out, /Wrote 1 transcripts/);
  writeFileSync(join(dir, 'g.csv'), 'session,grader,dimension,score\ns1,ai-1,testing,3\ns1,ai-2,testing,4\ns1,ana,testing,4\ns1,ben,testing,3\n');
  assert.match(execFileSync('node', ['calibration/agreement.mjs', join(dir, 'g.csv')]).toString(), /testing\s+AI vs people/);
}
console.log('ok: calibration');
