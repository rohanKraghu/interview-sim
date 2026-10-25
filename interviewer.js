// Pure interviewer logic: prompts, request bodies, reply parsing, timing rules.
// No DOM here, so test.mjs and the eval harness can run it under Node.

import { RUNS, LANGS, evidenceText } from './execute.js';

export const MODEL = 'claude-opus-5-5';
export const QUIET_SECONDS = 30; // first nudge after this much silence
export const CHECKIN_SECONDS = 75; // min gap before a look at new code

// Real rounds: a single-problem onsite round, or the two-problem screen Meta and others run.
export const FORMATS = {
  onsite: { label: 'Onsite round: one problem, 30 min', minutes: 30, problems: 1 },
  screen: { label: 'Phone screen: two problems, 35 min', minutes: 35, problems: 2 },
};

export const PERSONAS = {
  neutral: {
    label: 'Neutral',
    prompt: 'Persona: a typical neutral interviewer. Hints come only after a candidate has been stuck for a while.',
  },
  friendly: {
    label: 'Friendly',
    prompt: 'Persona: a friendly, encouraging interviewer. You still never give away the approach, but you offer a small hint a little sooner and acknowledge good moves briefly.',
  },
  skeptical: {
    label: 'Skeptical',
    prompt: 'Persona: a terse, skeptical interviewer. Keep turns very short. Besides pushing back on wrong claims, once or twice in the interview question a claim that is actually correct ("are you sure that is linear?") to see whether the candidate can defend it with reasoning. If they defend it well, accept it and move on. Use kind "probe" for these.',
  },
};

export const PROBLEMS = [
  {
    id: 'meeting-rooms',
    title: 'Meeting rooms',
    statement:
      'Given a list of meetings as [start, end] pairs, return the minimum number of rooms needed so that no two overlapping meetings share a room. A meeting that ends at time t does not overlap one that starts at t.\n\nExample: [[0,30],[5,10],[15,20]] returns 2.',
    notes:
      'Optimal: sort starts and ends separately and sweep with two pointers, or sort by start and keep a min-heap of end times. Both are O(n log n) time, O(n) space. Common wrong claims: "the heap version is O(n)" (sorting alone is n log n), "O(1) space" (the heap or sorted copies are O(n)). Brute force checking every pair is O(n^2) and does not by itself give the room count. Edge cases: empty list, one meeting, back-to-back meetings [1,2],[2,3] need 1 room, identical meetings.',
    followup: 'Return which room each meeting gets.',
    curveball: 'Times are whole minutes within one day (0 to 1439). Can you beat n log n? (Counting array of size 1440 with a prefix sum: O(n + 1440).)',
  },
  {
    id: 'longest-substring',
    title: 'Longest substring without repeats',
    statement:
      'Given a string s, return the length of the longest substring that has no repeated characters.\n\nExample: "abcabcbb" returns 3 ("abc").',
    notes:
      'Optimal: sliding window with a map from character to last index, O(n) time, O(min(n, alphabet)) space. Common wrong claims: "the while loop that shrinks the window makes it O(n^2)" (each index enters and leaves once, so O(n)), "O(1) space" without saying the alphabet is fixed. Bug to watch: moving the left pointer backwards when the last index of a character is left of the window. Edge cases: empty string, all same character, all unique.',
    followup: 'Return the substring itself, not just its length.',
    curveball: 'Now allow each character to appear at most twice. (Same window, keep counts, shrink while any count exceeds 2.)',
  },
  {
    id: 'lru-cache',
    title: 'LRU cache',
    statement:
      'Design a class LRUCache(capacity) with get(key) and put(key, value). get returns the value or -1. put inserts or updates, and if the cache is over capacity it evicts the least recently used key. Both operations should be O(1).',
    notes:
      'Optimal: hash map plus doubly linked list (or an ordered dict / Map using insertion order). Common wrong claims: "a list with remove() is O(1)" (removing from the middle of an array is O(n)), "a heap of timestamps gives O(1)" (heap ops are O(log n)). Bugs to watch: get not refreshing recency, put on an existing key not refreshing recency or wrongly evicting, capacity 0. JavaScript caveat: evicting with map.keys().next() is the standard O(1) idea, but V8 scans deleted slots there, so its measured growth can look superlinear at large n. Do not count that against the approach; at most mention it as an aside.',
    followup: 'Add a time-to-live per key.',
    curveball: 'Many threads call get and put at once. What breaks, and what is the simplest correct fix?',
  },
  {
    id: 'islands',
    title: 'Number of islands',
    statement:
      'Given a grid of "1" (land) and "0" (water), count the islands. An island is land connected up, down, left or right.\n\nExample:\n1 1 0 0\n1 0 0 1\n0 0 1 1\nreturns 2.',
    notes:
      'Optimal: DFS or BFS from each unvisited land cell, marking visited; or union-find. O(rows * cols) time. Space: O(rows * cols) worst case for the recursion stack or queue, not O(1) even when marking in place. Common wrong claims: "it is O((rows*cols)^2) because DFS runs from every cell" (each cell is visited once), "O(1) space because I mark the grid in place" (the stack is not O(1)). Bugs to watch: counting diagonal neighbours, recursion depth on a big all-land grid, not checking bounds before indexing.',
    followup: 'Return the size of the largest island.',
    curveball: 'The grid is too big for memory and arrives one row at a time. (Union-find over the previous and current row only.)',
  },
  {
    id: 'top-k',
    title: 'Top k frequent elements',
    statement:
      'Given an integer array nums and an integer k, return the k most frequent elements, in any order.\n\nExample: nums = [1,1,1,2,2,3], k = 2 returns [1,2].',
    notes:
      'Approaches: count with a hash map, then sort by count O(n log n); a min-heap of size k O(n log k); or bucket sort by count O(n). Common wrong claims: "the heap solution is O(n)" (it is O(n log k)), "sorting the counts is O(k log k)" (there can be up to n distinct values, so O(n log n)). Edge cases: k equals the number of distinct values, ties at the boundary, negative numbers.',
    followup: 'Return them ordered from most to least frequent.',
    curveball: 'nums is a stream you cannot store. (Exact answer is impossible in small memory; mention Count-Min Sketch or Misra-Gries for approximate heavy hitters.)',
  },
  {
    id: 'merge-k',
    title: 'Merge k sorted lists',
    statement:
      'Given k sorted linked lists, merge them into one sorted linked list and return its head.\n\nExample: [1->4->5, 1->3->4, 2->6] returns 1->1->2->3->4->4->5->6.',
    notes:
      'Optimal: min-heap of list heads, O(N log k) for N total nodes, O(k) extra space; or pairwise divide and conquer, also O(N log k). Common wrong claims: "merging the lists one by one into the result is O(N log k)" (it is O(N k)), "the heap version is O(N log N)" (the heap never holds more than k items). Bugs to watch: comparing nodes with equal values in a heap (languages that compare tuples fall through to the node), empty lists in the input, k = 0.',
    followup: 'Do it with O(1) extra space.',
    curveball: 'The lists live on k different machines and each can only stream its values in order. How does your solution change?',
  },
];

export const SYSTEM = `You are a senior software engineer running a live coding interview over voice. Everything you write in "say" is read aloud by a speech engine.

How you talk:
- At most two short sentences per turn, in plain spoken English. No markdown, no lists, no code. Say "line 4", never paste code.
- Warm but neutral, like a real interviewer. Do not praise routine progress or say "great question".

When to talk:
- Mostly listen. If the candidate is thinking aloud and on a reasonable track, set say to an empty string and kind to "silent".
- Speak when it adds something: a clarifying answer, a nudge, a question about their code, pushback, or moving them along.

How a real round runs, and what you do in each phase:
- clarify: the candidate should restate the problem and ask about inputs, sizes and edge cases. Answer clarifying questions briefly and accurately from the statement and notes. If they jump straight to code without any clarifying question, let them, but remember it.
- approach: they should describe an approach and its complexity before coding. If they start coding with no plan, ask what their plan is. Do not volunteer the approach.
- code: they write it. Ask about specific lines and choices ("why a set on line 6?"). When you see a bug, ask a question that leads to it ("what does line 9 do when the list is empty?"). Do not state the fix.
- test: when they say they are done, ask them to walk an example or an edge case through the code by hand. The code is not run.
- complexity: ask for time and space complexity if they have not given it for the final code.
- followup: if time remains, ask the follow-up from the notes, then the curveball, which changes one constraint. Ask how their solution changes; they only need to talk it through unless there is plenty of time.
- wrapup: close the problem or the interview.

Pacing: you get a time plan for the current problem. Real interviewers keep the clock. If the candidate is well past a checkpoint, move them along kindly but firmly ("in the interest of time, let's start coding" or "let's leave that and talk about complexity"). Use kind "pace" for that.

Silence: when an event says the candidate has gone quiet, nudge. First nudge: a light check-in, such as asking them to talk you through what they are thinking. If they stay quiet after earlier nudges, give a small concrete hint pointed at their current code, never the full solution. If they are typing but not talking, ask them to narrate as they go.

Measurements: some events carry a MEASURED line from actually running their code: hidden test results, and how the runtime grew as the input doubled (a fitted exponent: about 1 means linear or n log n, about 2 means quadratic; linear code can fit as high as 1.5 when its data outgrows the CPU caches). Treat measurements as ground truth over your own reading of the code. When a claim contradicts one, push back with the evidence in plain words ("when I doubled the input, your code took about four times as long"). Do not read out a failing hidden input unless they are stuck; lead them toward it ("what happens when one meeting ends exactly when the next starts?"). Timing cannot tell n from n log n, so never use it to dispute that difference.

Claims: check every claim about time or space complexity, correctness, or edge cases against the actual code and your notes. If a claim is wrong, push back directly: say you are not sure that is right and ask them to walk through the part that breaks it. Do not accept a claim because it sounds confident, and do not drop the point until they correct it or clearly give up. If a claim is right, a short acknowledgment is enough.

Labels on every reply:
- kind: silent, answer (to a clarifying question), nudge (silence check-in), hint (any help toward the solution), question (about their code or reasoning), pushback (a claim is wrong), probe (questioning a correct claim, skeptical persona only), pace, followup, curveball, wrapup.
- phase: the phase the round is in after this turn.
- move_on: true only when you are closing the current problem and another problem remains. Say a short transition; the next problem appears on screen.
- end: true only when the last problem is finished, or when an event says time is up and you have said a one or two sentence close.`;

export const REPLY_SCHEMA = {
  type: 'object',
  properties: {
    say: { type: 'string' },
    kind: { type: 'string', enum: ['silent', 'answer', 'nudge', 'hint', 'question', 'pushback', 'probe', 'pace', 'followup', 'curveball', 'wrapup'] },
    phase: { type: 'string', enum: ['clarify', 'approach', 'code', 'test', 'complexity', 'followup', 'wrapup'] },
    move_on: { type: 'boolean' },
    end: { type: 'boolean' },
  },
  required: ['say', 'kind', 'phase', 'move_on', 'end'],
  additionalProperties: false,
};

const DIMENSIONS = ['problem_solving', 'code_correctness', 'complexity_analysis', 'communication', 'testing'];

export const SCORECARD_SCHEMA = {
  type: 'object',
  properties: {
    scores: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          dimension: { type: 'string', enum: DIMENSIONS },
          score: { type: 'integer', enum: [1, 2, 3, 4] },
          evidence: { type: 'string' },
        },
        required: ['dimension', 'score', 'evidence'],
        additionalProperties: false,
      },
    },
    verdict: { type: 'string', enum: ['strong no hire', 'no hire', 'hire', 'strong hire'] },
    summary: { type: 'string' },
    moments: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          at: { type: 'string' },
          what_happened: { type: 'string' },
          better: { type: 'string' },
        },
        required: ['at', 'what_happened', 'better'],
        additionalProperties: false,
      },
    },
    work_on: { type: 'array', items: { type: 'string' } },
  },
  required: ['scores', 'verdict', 'summary', 'moments', 'work_on'],
  additionalProperties: false,
};

// Shared with human graders (calibration/transcripts.mjs), so people and the model use the same scale.
export const RUBRIC = `- problem_solving: 1 needed the approach handed over, 2 reached it with heavy hints, 3 reached a working approach with light hints, 4 found the optimal approach on their own and weighed alternatives.
- code_correctness: 1 does not run or is mostly wrong, 2 major bugs left, 3 minor bugs or a missed edge case, 4 correct on all edge cases.
- complexity_analysis: 1 none or wrong and not corrected, 2 wrong but corrected after pushback, 3 right with some prompting, 4 right and unprompted, time and space.
- communication: 1 long silences, 2 talked only when nudged, 3 explained most decisions and asked clarifying questions, 4 narrated throughout, clarified up front, and handled pushback and probes well (held a correct claim with reasoning, gave up a wrong one).
- testing: 1 none, 2 traced the given example only when asked, 3 traced examples and some edge cases, 4 found their own bugs by testing edge cases.`;

const SCORECARD_SYSTEM = `You grade a finished live coding interview the way a calibrated interviewer writes feedback. Rubric, 1 to 4 for each dimension:
${RUBRIC}
When MEASURED lines or final test results are present, ground code_correctness in the hidden tests and complexity_analysis in whether the candidate's claims matched the measured growth.
A hint is not an automatic failure: weigh how much help was needed and how well the candidate used it. Interviewer turns in the transcript are labelled (hint, pushback, probe, pace...). Use those labels and the counts.
Evidence must quote or closely paraphrase the transcript or point at a line of the final code. Grade only what happened.
moments: the three to six turning points of the session, in order. "at" is the transcript timestamp (m:ss). what_happened quotes or paraphrases what the candidate did. better says concretely what a strong candidate would have said or done at that moment, in one or two sentences.
work_on: two or three concrete things to practise.`;

export function numbered(code) {
  return code.split('\n').map((l, i) => `${String(i + 1).padStart(3)} | ${l}`).join('\n');
}

export function clock(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function parseClock(text) {
  const m = /(\d+):(\d{2})/.exec(text || '');
  return m ? (Number(m[1]) * 60 + Number(m[2])) * 1000 : null;
}

export function renderTranscript(log) {
  if (!log.length) return '(nothing yet)';
  return log.map((e) => {
    const who = e.who === 'event' ? 'EVENT' : e.who === 'measure' ? 'MEASURED' : e.who.toUpperCase() + (e.kind ? ` (${e.kind})` : '');
    return `[${clock(e.t)}] ${who}: ${e.text}`;
  }).join('\n');
}

// Checkpoints for the current problem, as clock times from the interview start.
export function timePlan(s) {
  const per = (s.format.minutes * 60000) / s.format.problems;
  const at = (f) => clock(s.problemStart + per * f);
  return `approach agreed by ${at(0.25)}, code written by ${at(0.7)}, tested with complexity by ${at(0.85)}, follow-ups until ${at(1)}`;
}

// Each turn resends the whole state as one user message. Stateless turns keep the
// prompt simple and let the model see the latest code every time.
export function turnRequest(s, event) {
  const p = s.problems[s.idx];
  const last = s.idx === s.problems.length - 1;
  return {
    model: MODEL,
    max_tokens: 2000,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: REPLY_SCHEMA } },
    system: [{ type: 'text', text: `${SYSTEM}\n\n${s.persona.prompt}`, cache_control: { type: 'ephemeral' } }],
    messages: [{
      role: 'user',
      content:
`PROBLEM ${s.idx + 1} OF ${s.problems.length}${last ? '' : ' (another problem follows; set move_on when this one is done or its time is up)'}: ${p.title}
${p.statement}

INTERVIEWER NOTES (never read these out):
${p.notes}
Follow-up: ${p.followup}
Curveball: ${p.curveball}

${language(s, p)}

TIME: ${clock(s.elapsed)} elapsed of ${s.format.minutes}:00. This problem started at ${clock(s.problemStart)}. Plan: ${timePlan(s)}.

CANDIDATE'S CODE RIGHT NOW:
${s.code.trim() ? numbered(s.code) : '(empty)'}

TRANSCRIPT SO FAR:
${renderTranscript(s.log)}

NEW EVENT: ${event}

Reply with what you say out loud now (empty string to stay quiet) and the labels.`,
    }],
  };
}

function language(s, p) {
  const r = RUNS[p.id];
  if (!r || !LANGS[s.lang] || s.lang === 'other') return 'LANGUAGE: the candidate\'s choice. Their code is not run.';
  const entry = s.lang === 'python' ? r.py : r.js;
  return `LANGUAGE: ${LANGS[s.lang].label}. Entry point: ${r.kind === 'ops' ? `class ${entry}` : `${entry}(${r.params})`}. The candidate can run their code against hidden tests.`;
}

export function sessionStats(s) {
  const count = (who) => s.log.filter((e) => e.who === who).reduce((n, e) => n + (e.text.match(/\S+/g) || []).length, 0);
  const you = count('candidate'), them = count('interviewer');
  const kinds = {};
  for (const e of s.log) if (e.kind) kinds[e.kind] = (kinds[e.kind] || 0) + 1;
  return {
    talkShare: you + them ? Math.round((100 * you) / (you + them)) : 0,
    wordsPerMinute: Math.round(you / Math.max(1, s.elapsed / 60000)),
    longestSilence: Math.round((s.maxQuiet || 0) / 1000),
    hints: kinds.hint || 0,
    nudges: kinds.nudge || 0,
    pushbacks: kinds.pushback || 0,
    kinds,
  };
}

export function scorecardRequest(s) {
  const st = sessionStats(s);
  const problems = s.problems.map((p, i) =>
`PROBLEM ${i + 1}: ${p.title}
${p.statement}
NOTES: ${p.notes}
FINAL CODE:
${(s.codes[i] || '').trim() ? numbered(s.codes[i]) : '(empty)'}
FINAL RUN: ${evidenceText(p.id, s.results?.[i]) || 'not run'}`).join('\n\n');
  return {
    model: MODEL,
    max_tokens: 12000,
    output_config: { effort: 'high', format: { type: 'json_schema', schema: SCORECARD_SCHEMA } },
    system: SCORECARD_SYSTEM,
    messages: [{
      role: 'user',
      content:
`FORMAT: ${s.format.label}. Interviewer persona: ${s.persona.label}.
DURATION: ${clock(s.elapsed)}

${problems}

COUNTS: interviewer turns by kind ${JSON.stringify(st.kinds)}; candidate share of words spoken ${st.talkShare}%; longest silence ${st.longestSilence}s.

TRANSCRIPT:
${renderTranscript(s.log)}`,
    }],
  };
}

export async function callClaude(key, body) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2026-10-21',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
  });
  const json = await r.json();
  if (!r.ok) throw new Error(json.error?.message || `HTTP ${r.status}`);
  return json;
}

// Spoken claims worth checking against a measurement.
export function isComplexityClaim(text) {
  return /\bo\s*\(|big o|\blinear\b|quadratic|n squared|n log n|log n\b|constant (time|space)|\bo of\b/i.test(text);
}

export function parseJsonReply(res) {
  if (res.stop_reason === 'refusal') throw new Error('The model declined this turn.');
  const text = (res.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  return JSON.parse(text);
}

const words = (t) => t.toLowerCase().match(/[a-z0-9']+/g) || [];

// The mic hears the speakers. Treat a phrase as echo when most of its words are
// in what the interviewer just said.
export function isEcho(heard, spoken) {
  const h = words(heard);
  if (!h.length) return true;
  const said = new Set(words(spoken));
  return h.filter((w) => said.has(w)).length / h.length >= 0.6;
}

// What to tell the interviewer about the candidate's silence, or null if it is
// not time yet. Each nudge waits longer than the last.
export function quietEvent(now, lastSpeech, lastKey, lastNudge, nudges) {
  const quietFor = (now - Math.max(lastSpeech, lastNudge)) / 1000;
  if (quietFor < QUIET_SECONDS * (1 + nudges * 0.5)) return null;
  const typingAgo = (now - lastKey) / 1000;
  const typing = typingAgo < 10 ? ` They are typing (last keystroke ${Math.round(typingAgo)}s ago) but not talking.` : ' They are not typing either.';
  return `The candidate has said nothing for ${Math.round(quietFor)} seconds.${typing} Earlier nudges this stretch: ${nudges}.`;
}

// The problems for a session: the chosen one first, then random others.
export function pickProblems(firstId, n, rand = Math.random) {
  const pool = [...PROBLEMS];
  const first = pool.find((p) => p.id === firstId);
  const out = first ? [first] : [];
  const rest = pool.filter((p) => p !== first);
  while (out.length < n && rest.length) out.push(rest.splice(Math.floor(rand() * rest.length), 1)[0]);
  return out;
}
