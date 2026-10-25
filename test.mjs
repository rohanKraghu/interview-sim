// Run: node test.mjs
import assert from 'node:assert/strict';
import { PROBLEMS, isEcho, quietEvent, numbered, turnRequest, scorecardRequest, parseJsonReply } from './interviewer.js';

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

// Prompt carries numbered code, notes and the event
assert.equal(numbered('a\nb'), '  1 | a\n  2 | b');
const s = { problem: PROBLEMS[0], code: 'x = 1', log: [{ who: 'candidate', text: 'It is O(n).', t: 65_000 }], elapsed: 70_000 };
const req = turnRequest(s, 'EVT');
const msg = req.messages[0].content;
for (const part of ['  1 | x = 1', '[1:05] CANDIDATE: It is O(n).', 'NEW EVENT: EVT', 'O(n log n)', '1:10 elapsed']) assert.ok(msg.includes(part), part);
assert.equal(req.output_config.format.type, 'json_schema');
assert.ok(scorecardRequest(s).messages[0].content.includes('FINAL CODE'));

// Reply parsing
assert.deepEqual(parseJsonReply({ stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: '{"say":"Hi","end":false}' }] }), { say: 'Hi', end: false });
assert.throws(() => parseJsonReply({ stop_reason: 'refusal', content: [] }));

console.log('ok');
