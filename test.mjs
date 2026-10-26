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
