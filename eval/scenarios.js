// Scripted moments from an interview, each with checks on what a good
// interviewer does next. run.mjs sends each one to the model several times and
// reports how often the reply passes. Every scenario carries a good and a bad
// example reply, which test.mjs uses to check the checks themselves.

import { FORMATS, PERSONAS, pickProblems } from '../interviewer.js';
import { PY } from '../fixtures/solutions.js';

const min = (m) => Math.round(m * 60000);
const L = (m, who, text, kind) => ({ t: min(m), who, text, kind });

export function state({ problem, persona = 'neutral', format = 'onsite', lang = 'python', at = 5, code = '', log = [], idx = 0, problemStart = 0 }) {
  const f = FORMATS[format];
  return {
    format: f, persona: PERSONAS[persona], lang,
    problems: pickProblems(problem, f.problems, () => 0), idx,
    code, codes: [], results: [], log, elapsed: min(at), problemStart: min(problemStart), maxQuiet: 0,
  };
}

// Checks return null when they pass, or a reason when they fail.
const kindIn = (...kinds) => (r) => (kinds.includes(r.kind) ? null : `kind was ${r.kind}, wanted ${kinds.join('/')}`);
const kindNot = (...kinds) => (r) => (kinds.includes(r.kind) ? `kind was ${r.kind}` : null);
const says = (re) => (r) => (re.test(r.say) ? null : `said "${r.say}", wanted ${re}`);
const saysNot = (re) => (r) => (re.test(r.say) ? `said "${r.say}", which matches ${re}` : null);
const short = (r) => ((r.say.match(/[.!?](\s|$)/g) || []).length <= 2 ? null : 'more than two sentences');
const flag = (name, want) => (r) => (r[name] === want ? null : `${name} was ${r[name]}`);

// Phrases that give the approach away, per problem.
const LEAK = {
  'meeting-rooms': /heap|priority queue|two pointers|sort(ed|ing)? (the )?(start|end)/i,
  'longest-substring': /sliding window|last (seen )?index/i,
};

const HEAP_ROOMS = PY['meeting-rooms'];
const WINDOW = PY['longest-substring'];
const BRUTE = `def length_of_longest_substring(s):
    best = 0
    for i in range(len(s)):
        seen = set()
        for j in range(i, len(s)):
            if s[j] in seen:
                break
            seen.add(s[j])
            best = max(best, j - i + 1)
    return best`;
const BUGGY_ROOMS = HEAP_ROOMS.replace('h[0] <= s', 'h[0] < s');
const MEASURED_BRUTE = 'MEASURED on their current code: 8 of 8 hidden tests passed. Timing (n = string length, almost no repeated characters): n=256 12.8ms, n=512 55.9ms, n=1024 240.3ms, n=2048 1057.4ms. Fitted growth n^2.12: about quadratic.';
const MEASURED_BUGGY = 'MEASURED on their current code: 6 of 8 hidden tests passed (failed: input [[[1,2],[2,3]]] expected 1, got 2; input [[[0,1],[0,2],[0,3],[1,4]]] expected 3, got 4). Timing (n = number of meetings): n=4096 3.1ms, n=8192 6.6ms, n=16384 14.0ms, n=32768 29.5ms. Fitted growth n^1.08: close to linear (n or n log n; timing cannot separate the two).';

const spoke = 'The candidate just spoke (last CANDIDATE line).';
const quiet = (secs, typing, nudges) => `The candidate has said nothing for ${secs} seconds.${typing ? ' They are typing (last keystroke 3s ago) but not talking.' : ' They are not typing either.'} Earlier nudges this stretch: ${nudges}.`;

export const SCENARIOS = [
  {
    name: 'opening',
    about: 'Opens briefly without giving the approach away',
    state: state({ problem: 'meeting-rooms', at: 0 }),
    event: 'The interview is starting. Greet the candidate in one sentence, say the problem title, and ask them to read the statement on screen and share their first thoughts out loud.',
    checks: [(r) => (r.say.trim() ? null : 'said nothing'), short, saysNot(LEAK['meeting-rooms'])],
    good: { say: 'Hi, thanks for joining. Today we will do meeting rooms; take a moment to read it and tell me your first thoughts.', kind: 'answer', phase: 'clarify' },
    bad: { say: 'Hi! Sort the meetings and use a min-heap of end times.', kind: 'hint', phase: 'clarify' },
  },
  {
    name: 'clarifying-question',
    about: 'Answers a clarifying question accurately and stops there',
    state: state({ problem: 'meeting-rooms', at: 1.5, log: [L(1.4, 'candidate', 'Can the list of meetings be empty, and what should I return then?')] }),
    event: spoke,
    checks: [kindIn('answer'), says(/\b(0|zero)\b/i), saysNot(LEAK['meeting-rooms'])],
    good: { say: 'Yes, it can be empty, and then you return zero.', kind: 'answer', phase: 'clarify' },
    bad: { say: 'Good question, it can be empty. Think about a heap.', kind: 'hint', phase: 'clarify' },
  },
  {
    name: 'on-track-listen',
    about: 'Stays out of the way while the candidate is on track',
    state: state({ problem: 'meeting-rooms', at: 4, log: [L(3.9, 'candidate', "So I'm thinking I sort by start time, and keep a min-heap of end times. When the earliest end is at or before the next start I can reuse that room. Let me think about the edge cases before I code.")] }),
    event: spoke,
    checks: [kindIn('silent', 'answer', 'question'), short],
    good: { say: '', kind: 'silent', phase: 'approach' },
    bad: { say: 'Have you considered that a heap gives you the earliest ending meeting?', kind: 'hint', phase: 'approach' },
  },
  {
    name: 'first-nudge',
    about: 'First silence gets a light check-in, not a hint',
    state: state({ problem: 'meeting-rooms', at: 2.5 }),
    event: quiet(32, false, 0),
    checks: [kindIn('nudge'), saysNot(LEAK['meeting-rooms']), short],
    good: { say: 'Can you talk me through what you are thinking so far?', kind: 'nudge', phase: 'approach' },
    bad: { say: 'Try sorting the start times and using two pointers.', kind: 'hint', phase: 'approach' },
  },
  {
    name: 'typing-not-talking',
    about: 'Asks a silent typist to narrate',
    state: state({ problem: 'meeting-rooms', at: 9, code: 'import heapq\ndef min_rooms(meetings):\n    meetings.sort()\n    h = []' }),
    event: quiet(35, true, 0),
    checks: [kindIn('nudge', 'question'), says(/talk|narrat|walk|thinking|explain|tell me/i)],
    good: { say: 'Can you narrate what you are writing as you go?', kind: 'nudge', phase: 'code' },
    bad: { say: '', kind: 'silent', phase: 'code' },
  },
  {
    name: 'stuck-small-hint',
    about: 'After two unanswered nudges, a small hint that still leaves the work to them',
    state: state({ problem: 'meeting-rooms', at: 8, log: [L(5.5, 'interviewer', 'Talk me through what you are thinking.', 'nudge'), L(6.4, 'candidate', 'I am not sure how to count the rooms.'), L(7, 'interviewer', 'What would you need to know at the moment a new meeting starts?', 'nudge')] }),
    event: quiet(65, false, 2),
    checks: [kindIn('hint', 'nudge', 'question'), saysNot(/two pointers|heap of end|sort (the )?(starts|ends|start times|end times)/i), short],
    good: { say: 'When a meeting starts, which room frees up soonest? That is the one you would check.', kind: 'hint', phase: 'approach' },
    bad: { say: 'Sort the starts and the ends and walk two pointers, counting rooms as you go.', kind: 'hint', phase: 'approach' },
  },
  {
    name: 'wrong-claim-pushback',
    about: 'Pushes back on "the heap version is O(n)"',
    state: state({ problem: 'meeting-rooms', at: 18, code: HEAP_ROOMS, log: [L(17.8, 'candidate', "It's O(n) time, because it's just one pass over the meetings.")] }),
    event: spoke,
    checks: [kindIn('pushback'), short],
    good: { say: "I'm not sure that's right. What does the sort on line 4 cost?", kind: 'pushback', phase: 'complexity' },
    bad: { say: 'Great, and what about space?', kind: 'question', phase: 'complexity' },
  },
  {
    name: 'measured-pushback',
    about: 'Cites the measured growth when a brute force is called linear',
    state: state({ problem: 'longest-substring', at: 16, code: BRUTE, log: [L(15.8, 'candidate', 'This runs in linear time, O(n).'), L(15.85, 'measure', MEASURED_BRUTE)] }),
    event: `The candidate just spoke (last CANDIDATE line) and made a complexity claim. ${MEASURED_BRUTE}`,
    checks: [kindIn('pushback'), says(/doubl|four|quadratic|grow|longer|squared|measur|ran/i)],
    good: { say: 'When I doubled the input, your code took about four times as long. Does that look linear to you?', kind: 'pushback', phase: 'complexity' },
    bad: { say: 'Okay, sounds good. Any edge cases?', kind: 'question', phase: 'test' },
  },
  {
    name: 'pessimistic-claim',
    about: 'Also pushes back when a linear solution is called quadratic',
    state: state({ problem: 'longest-substring', at: 17, code: WINDOW, log: [L(16.8, 'candidate', 'The loop inside the loop, well the max and the dictionary, I think this ends up O(n squared) worst case.')] }),
    event: spoke,
    checks: [kindIn('pushback', 'question'), saysNot(/^(right|yes|correct)/i)],
    good: { say: "I'm not sure it's quadratic. How many times can left move in total?", kind: 'pushback', phase: 'complexity' },
    bad: { say: 'Right, quadratic. What about space?', kind: 'question', phase: 'complexity' },
  },
  {
    name: 'correct-claim',
    about: 'Accepts a correct claim (neutral persona)',
    state: state({ problem: 'meeting-rooms', at: 18, code: HEAP_ROOMS, log: [L(17.8, 'candidate', "Time is O(n log n) because of the sort and the heap operations, and space is O(n) for the heap.")] }),
    event: spoke,
    checks: [kindNot('pushback', 'probe')],
    good: { say: 'That matches what I see.', kind: 'question', phase: 'followup' },
    bad: { say: "I'm not sure that's right.", kind: 'pushback', phase: 'complexity' },
  },
  {
    name: 'holds-the-point',
    about: 'Does not drop a wrong claim when the candidate repeats it',
    state: state({ problem: 'meeting-rooms', at: 19, code: HEAP_ROOMS, log: [
      L(17.8, 'candidate', "It's O(n) time, one pass over the meetings."),
      L(17.9, 'interviewer', "I'm not sure that's right. What does line 4 cost?", 'pushback'),
      L(18.6, 'candidate', "Line 4 is just setup. The loop runs n times so I'm pretty sure it's O(n)."),
    ] }),
    event: spoke,
    checks: [kindIn('pushback', 'question'), says(/sort|line 4|n log n|setup|cost/i)],
    good: { say: 'Setup still counts. How long does sorting n meetings take?', kind: 'pushback', phase: 'complexity' },
    bad: { say: 'Okay, fair enough. Let us move on to edge cases.', kind: 'followup', phase: 'test' },
  },
  {
    name: 'bug-leading-question',
    about: 'Leads to a failing edge case without stating the fix',
    state: state({ problem: 'meeting-rooms', at: 19, code: BUGGY_ROOMS, log: [L(18.8, 'candidate', "I think I'm done. Let me run it."), L(18.9, 'measure', MEASURED_BUGGY)] }),
    event: `The candidate ran their code. ${MEASURED_BUGGY}`,
    checks: [kindIn('question', 'hint'), saysNot(/<=|less than or equal|change .* to/i), short],
    good: { say: 'What should happen when one meeting ends exactly when the next one starts?', kind: 'question', phase: 'test' },
    bad: { say: 'On line 5 change the less-than to less than or equal.', kind: 'hint', phase: 'test' },
  },
  {
    name: 'done-asks-to-test',
    about: 'When they say done, asks for a walk-through or complexity',
    state: state({ problem: 'meeting-rooms', at: 16, code: HEAP_ROOMS, log: [L(15.9, 'candidate', "Okay, I think that's it.")] }),
    event: spoke,
    checks: [kindIn('question', 'followup'), says(/example|walk|trace|edge|complex|time|space|run/i)],
    good: { say: 'Walk me through the example with back-to-back meetings.', kind: 'question', phase: 'test' },
    bad: { say: 'Great, that is the end of the interview.', kind: 'wrapup', phase: 'wrapup' },
  },
  {
    name: 'pacing',
    about: 'Moves a candidate along who is still debating approaches at 12 minutes',
    state: state({ problem: 'meeting-rooms', at: 12, log: [L(11.8, 'candidate', 'Or maybe I could use a segment tree over all the times, or a sweep line, or an interval tree. Let me think about which is best.')] }),
    event: spoke,
    checks: [kindIn('pace'), says(/time|code|start|pick|go with/i)],
    good: { say: 'In the interest of time, pick one and start coding.', kind: 'pace', phase: 'code' },
    bad: { say: '', kind: 'silent', phase: 'approach' },
  },
  {
    name: 'curveball',
    about: 'Uses spare time for the follow-up or curveball',
    state: state({ problem: 'meeting-rooms', at: 24, code: HEAP_ROOMS, log: [
      L(20, 'candidate', 'O(n log n) time for the sort, O(n) space for the heap.'),
      L(20.2, 'interviewer', 'Agreed.', 'question'),
      L(23.8, 'candidate', 'Anything else you would like me to look at?'),
    ] }),
    event: spoke,
    checks: [kindIn('followup', 'curveball')],
    good: { say: 'Say times are whole minutes in a single day. Can you beat n log n?', kind: 'curveball', phase: 'followup' },
    bad: { say: 'No, that is all. Thanks!', kind: 'wrapup', phase: 'wrapup' },
  },
  {
    name: 'time-up',
    about: 'Closes on time',
    state: state({ problem: 'meeting-rooms', at: 30, code: HEAP_ROOMS }),
    event: 'Time is up. Close the interview now.',
    checks: [flag('end', true), short],
    good: { say: "That's time. Thanks, this was great to work through.", kind: 'wrapup', phase: 'wrapup', end: true },
    bad: { say: 'Let us also cover the follow-up.', kind: 'followup', phase: 'followup', end: false },
  },
  {
    name: 'move-on',
    about: 'Moves to the second problem of a phone screen',
    state: state({ problem: 'meeting-rooms', format: 'screen', at: 17.5, code: HEAP_ROOMS, log: [
      L(15, 'candidate', 'O(n log n) time, O(n) space.'),
      L(15.2, 'interviewer', 'Good. How would you return which room each meeting gets?', 'followup'),
      L(17, 'candidate', 'I would store a room id with each end time in the heap and hand it to the next meeting.'),
    ] }),
    event: spoke,
    checks: [flag('move_on', true), flag('end', false)],
    good: { say: "That works. Let's move on to the next problem.", kind: 'wrapup', phase: 'wrapup', move_on: true, end: false },
    bad: { say: 'Can you also code that up?', kind: 'followup', phase: 'followup', move_on: false, end: false },
  },
  {
    name: 'skeptic-accepts-defense',
    about: 'Skeptical persona accepts a correct claim once it is defended with reasoning',
    state: state({ problem: 'longest-substring', persona: 'skeptical', at: 18, code: WINDOW, log: [
      L(17, 'candidate', 'This is O(n) time.'),
      L(17.1, 'interviewer', 'Are you sure that is linear?', 'probe'),
      L(17.8, 'candidate', 'Yes. Each index is visited once by i, and left only ever moves forward, so across the whole run it moves at most n times. So total work is O(n).'),
    ] }),
    event: spoke,
    checks: [kindNot('pushback', 'probe')],
    good: { say: 'Fair. What about space?', kind: 'question', phase: 'complexity' },
    bad: { say: 'I still do not believe it.', kind: 'pushback', phase: 'complexity' },
  },
];

// Two finished sessions of very different quality, for checking the scorecard.
export const SCORE_SESSIONS = {
  strong: {
    ...state({ problem: 'meeting-rooms', at: 26, code: HEAP_ROOMS }),
    codes: [HEAP_ROOMS],
    results: [{ tests: { passed: 8, total: 8, failed: [] }, points: [{ n: 4096, ms: 3 }, { n: 8192, ms: 6.3 }, { n: 16384, ms: 13.5 }, { n: 32768, ms: 28 }], slope: 1.07 }],
    log: [
      L(0, 'interviewer', 'Hi, today is meeting rooms. Take a look and share your first thoughts.', 'answer'),
      L(0.8, 'candidate', 'So I need the maximum number of meetings overlapping at any time. Can the list be empty? And does a meeting ending at 10 overlap one starting at 10?'),
      L(0.9, 'interviewer', 'It can be empty, return zero. And no, those do not overlap.', 'answer'),
      L(2.5, 'candidate', 'Brute force would check every time point, but sorting by start and keeping a min-heap of end times gives n log n. When the smallest end is at or before the new start, I reuse that room.'),
      L(9, 'candidate', 'I sort, then for each meeting I either replace the heap top or push. The answer is the heap size.'),
      L(11, 'candidate', 'Let me trace back-to-back meetings 1 to 2 and 2 to 3: the heap top 2 is at most 2, so I reuse the room, answer 1. Empty list returns 0.'),
      L(12, 'candidate', 'Time is O(n log n) for the sort and heap operations, space O(n).'),
      L(12.2, 'interviewer', 'Agreed. How would you return which room each meeting gets?', 'followup'),
      L(14, 'candidate', 'I would push the room id along with the end time and give the freed id to the new meeting.'),
      L(14.2, 'interviewer', 'Say times are whole minutes in one day. Can you beat n log n?', 'curveball'),
      L(15.5, 'candidate', 'Yes, a counting array of 1440 minutes with plus one at start and minus one at end, then a prefix sum. O(n plus 1440).'),
    ],
  },
  weak: {
    ...state({ problem: 'meeting-rooms', at: 30, code: 'def min_rooms(meetings):\n    count = 0\n    for a in meetings:\n        for b in meetings:\n            if a != b and a[0] < b[1] and b[0] < a[1]:\n                count += 1\n    return count' }),
    codes: ['def min_rooms(meetings):\n    count = 0\n    for a in meetings:\n        for b in meetings:\n            if a != b and a[0] < b[1] and b[0] < a[1]:\n                count += 1\n    return count'],
    results: [{ tests: { passed: 2, total: 8, failed: [] }, points: [{ n: 256, ms: 9 }, { n: 512, ms: 36 }, { n: 1024, ms: 150 }, { n: 2048, ms: 610 }], slope: 2.03 }],
    maxQuiet: 140000,
    log: [
      L(0, 'interviewer', 'Hi, today is meeting rooms. Take a look and share your first thoughts.', 'answer'),
      L(3, 'interviewer', 'Talk me through what you are thinking.', 'nudge'),
      L(4, 'candidate', 'I will just check every pair.'),
      L(9, 'interviewer', 'You have been quiet for a while. What are you writing?', 'nudge'),
      L(12, 'interviewer', 'Think about which room frees up soonest when a meeting starts.', 'hint'),
      L(20, 'candidate', 'Done. It is O(n).'),
      L(20.2, 'interviewer', "I'm not sure that's right. How many times does the inner loop run?", 'pushback'),
      L(21, 'candidate', 'It is O(n) because it is a for loop.'),
      L(21.2, 'interviewer', 'When I doubled the input, it took four times as long.', 'pushback'),
      L(22, 'candidate', 'Okay maybe n squared.'),
      L(29.9, 'interviewer', "That's time, thanks.", 'wrapup'),
    ],
  },
};
