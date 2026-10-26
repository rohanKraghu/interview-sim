// Grades saved sessions with the model, several times each, as CSV rows for
// agreement.mjs. Repeats measure how consistent the AI grader is.
//
//   ANTHROPIC_API_KEY=... node calibration/regrade.mjs sessions/*.json --times 3 > ai.csv
import { callClaude, parseJsonReply, scorecardRequest } from '../interviewer.js';
import { loadSession, cardRows } from './session.js';

const args = process.argv.slice(2);
const ti = args.indexOf('--times');
const times = ti < 0 ? 3 : Number(args[ti + 1]);
const files = args.filter((a, i) => a.endsWith('.json') && i !== ti + 1);
const key = process.env.ANTHROPIC_API_KEY || process.env.INTERVIEW_SIM_API_KEY;
if (!key || !files.length) { console.error('usage: ANTHROPIC_API_KEY=... node calibration/regrade.mjs sessions/*.json [--times 3] > ai.csv'); process.exit(1); }

console.log('session,grader,dimension,score');
for (const f of files) {
  const s = loadSession(f);
  for (let i = 1; i <= times; i++) {
    try {
      console.log(cardRows(s.id, `ai-${i}`, parseJsonReply(await callClaude(key, scorecardRequest(s)))).join('\n'));
    } catch (e) { console.error(`${f} run ${i}: ${e.message}`); }
  }
}
