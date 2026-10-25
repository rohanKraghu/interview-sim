// Pure interviewer logic: prompts, request bodies, reply parsing, timing rules.
// No DOM here, so test.mjs can run it under Node.

export const MODEL = 'claude-opus-5-5';
export const INTERVIEW_MINUTES = 30;
export const QUIET_SECONDS = 30; // first nudge after this much silence
export const CHECKIN_SECONDS = 75; // min gap before a look at new code

export const PROBLEMS = [
  {
    id: 'meeting-rooms',
    title: 'Meeting rooms',
    statement:
      'Given a list of meetings as [start, end] pairs, return the minimum number of rooms needed so that no two overlapping meetings share a room. A meeting that ends at time t does not overlap one that starts at t.\n\nExample: [[0,30],[5,10],[15,20]] returns 2.',
    notes:
      'Optimal: sort starts and ends separately and sweep with two pointers, or sort by start and keep a min-heap of end times. Both are O(n log n) time, O(n) space. Common wrong claims: "the heap version is O(n)" (sorting alone is n log n), "O(1) space" (the heap or sorted copies are O(n)). Brute force checking every pair is O(n^2) and does not by itself give the room count. Edge cases: empty list, one meeting, back-to-back meetings [1,2],[2,3] need 1 room, identical meetings. Follow-up: return which room each meeting gets.',
  },
  {
    id: 'longest-substring',
    title: 'Longest substring without repeats',
    statement:
      'Given a string s, return the length of the longest substring that has no repeated characters.\n\nExample: "abcabcbb" returns 3 ("abc").',
    notes:
      'Optimal: sliding window with a map from character to last index, O(n) time, O(min(n, alphabet)) space. Common wrong claims: "the while loop that shrinks the window makes it O(n^2)" (each index enters and leaves once, so O(n)), "O(1) space" without saying the alphabet is fixed. Bug to watch: moving the left pointer backwards when the last index of a character is left of the window. Edge cases: empty string, all same character, all unique. Follow-up: return the substring itself, or allow at most k repeats.',
  },
  {
    id: 'lru-cache',
    title: 'LRU cache',
    statement:
      'Design a class LRUCache(capacity) with get(key) and put(key, value). get returns the value or -1. put inserts or updates, and if the cache is over capacity it evicts the least recently used key. Both operations should be O(1).',
    notes:
      'Optimal: hash map plus doubly linked list (or an ordered dict / Map using insertion order). Common wrong claims: "a list with remove() is O(1)" (removing from the middle of an array is O(n)), "a heap of timestamps gives O(1)" (heap ops are O(log n)). Bugs to watch: get not refreshing recency, put on an existing key not refreshing recency or wrongly evicting, capacity 0. Follow-up: make it thread safe, or add a time-to-live per key.',
  },
];

export const SYSTEM = `You are a senior software engineer running a live coding interview over voice. Everything you write is read aloud by a speech engine.

How you talk:
- At most two short sentences per turn, in plain spoken English. No markdown, no lists, no code. Say "line 4", never paste code.
- Warm but neutral, like a real interviewer. Do not praise routine progress or say "great question".

When to talk:
- Mostly listen. If the candidate is thinking aloud and on a reasonable track, set say to an empty string and stay quiet.
- Speak when it adds something: a clarifying answer, a nudge, a question about their code, or pushback.

What you do:
- Clarifying questions: answer them briefly and accurately, using the problem statement and your notes. Do not volunteer the approach.
- Silence: when an event says the candidate has gone quiet, nudge. First nudge: a light check-in, such as asking them to talk you through what they are thinking. If they stay quiet after earlier nudges, give a small concrete hint pointed at their current code, never the full solution. If they are typing but not talking, ask them to narrate as they go.
- Their code: you see it with line numbers. Ask about specific lines and choices ("why a set on line 6?"). When you see a bug, ask a question that leads to it ("what does line 9 do when the list is empty?"). Do not state the fix.
- Claims: check every claim about time or space complexity, correctness, or edge cases against the actual code and your notes. If a claim is wrong, push back directly: say you are not sure that is right and ask them to walk through the part that breaks it. Do not accept a claim because it sounds confident, and do not drop the point until they correct it or clearly give up. If a claim is right, a short acknowledgment is enough.
- When they say they are done: ask follow-ups in this order, one per turn, skipping any already covered: walk through an example or edge case, then time and space complexity, then the follow-up in your notes.
- Time: when an event says time is up, close the interview in one or two sentences and set end to true. Otherwise set end to true only after the follow-ups are finished and the candidate has nothing to add.`;

export const REPLY_SCHEMA = {
  type: 'object',
  properties: {
    say: { type: 'string' },
    end: { type: 'boolean' },
  },
  required: ['say', 'end'],
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
    work_on: { type: 'array', items: { type: 'string' } },
  },
  required: ['scores', 'verdict', 'summary', 'work_on'],
  additionalProperties: false,
};

const SCORECARD_SYSTEM = `You grade a finished live coding interview. Use this rubric, 1 to 4 for each dimension:
- problem_solving: 1 needed the approach handed over, 2 reached it with heavy hints, 3 reached a working approach with light hints, 4 found the optimal approach on their own and weighed alternatives.
- code_correctness: 1 does not run or is mostly wrong, 2 major bugs left, 3 minor bugs or a missed edge case, 4 correct on all edge cases.
- complexity_analysis: 1 none or wrong and not corrected, 2 wrong but corrected after pushback, 3 right with some prompting, 4 right and unprompted, time and space.
- communication: 1 long silences, 2 talked only when nudged, 3 explained most decisions, 4 narrated throughout and handled pushback well.
- testing: 1 none, 2 ran the given example only when asked, 3 traced examples and some edge cases, 4 found their own bugs by testing edge cases.
Evidence must quote or closely paraphrase the transcript or point at a line of the final code. Grade only what happened; do not reward what the candidate might have done. work_on lists two or three concrete things to practise.`;

export function numbered(code) {
  return code.split('\n').map((l, i) => `${String(i + 1).padStart(3)} | ${l}`).join('\n');
}

function clock(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function renderTranscript(log) {
  if (!log.length) return '(nothing yet)';
  return log.map((e) => `[${clock(e.t)}] ${e.who === 'event' ? 'EVENT' : e.who.toUpperCase()}: ${e.text}`).join('\n');
}

// Each turn resends the whole state as one user message. Stateless turns keep the
// prompt simple and let the model see the latest code every time.
export function turnRequest(s, event) {
  const p = s.problem;
  return {
    model: MODEL,
    max_tokens: 2000,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: REPLY_SCHEMA } },
    system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
    messages: [{
      role: 'user',
      content:
`PROBLEM: ${p.title}
${p.statement}

INTERVIEWER NOTES (never read these out):
${p.notes}

TIME: ${clock(s.elapsed)} elapsed of ${INTERVIEW_MINUTES}:00.

CANDIDATE'S CODE RIGHT NOW:
${s.code.trim() ? numbered(s.code) : '(empty)'}

TRANSCRIPT SO FAR:
${renderTranscript(s.log)}

NEW EVENT: ${event}

Reply with what you say out loud now (empty string to stay quiet) and whether the interview is over.`,
    }],
  };
}

export function scorecardRequest(s) {
  return {
    model: MODEL,
    max_tokens: 8000,
    output_config: { effort: 'high', format: { type: 'json_schema', schema: SCORECARD_SCHEMA } },
    system: SCORECARD_SYSTEM,
    messages: [{
      role: 'user',
      content:
`PROBLEM: ${s.problem.title}
${s.problem.statement}

INTERVIEWER NOTES:
${s.problem.notes}

DURATION: ${clock(s.elapsed)}

FINAL CODE:
${s.code.trim() ? numbered(s.code) : '(empty)'}

TRANSCRIPT:
${renderTranscript(s.log)}`,
    }],
  };
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
