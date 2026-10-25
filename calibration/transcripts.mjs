// Writes a blind packet for human graders: one Markdown file per session (no AI
// scores in it) and a blank grades CSV for each grader to fill in.
//
//   node calibration/transcripts.mjs out-dir sessions/*.json
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderTranscript, numbered, clock, RUBRIC } from '../interviewer.js';
import { evidenceText } from '../execute.js';
import { loadSession, DIMENSIONS } from './session.js';

const [out, ...files] = process.argv.slice(2);
if (!out || !files.length) { console.error('usage: node calibration/transcripts.mjs out-dir sessions/*.json'); process.exit(1); }
mkdirSync(out, { recursive: true });
const blank = ['session,grader,dimension,score'];
for (const f of files) {
  const s = loadSession(f);
  const parts = [`# Session ${s.id}`, `${s.format.label}. Interviewer: ${s.persona.label}. Length ${clock(s.elapsed)}.`];
  const fence = (text) => `\`\`\`\n${text}\n\`\`\``;
  s.problems.forEach((p, i) => parts.push(`## Problem ${i + 1}: ${p.title}`, p.statement, '### Final code', fence(numbered(s.codes[i] || '(empty)')), `Final run: ${evidenceText(p.id, s.results?.[i]) || 'not run'}`));
  parts.push('## Transcript', fence(renderTranscript(s.log.filter((e) => e.who !== 'event'))));
  writeFileSync(join(out, `${s.id}.md`), parts.join('\n\n') + '\n');
  for (const d of [...DIMENSIONS, 'verdict']) blank.push(`${s.id},YOUR_NAME,${d},`);
}
writeFileSync(join(out, 'grades-template.csv'), blank.join('\n') + '\n');
writeFileSync(join(out, 'RUBRIC.md'), `# Rubric\n\nScore each dimension 1 to 4, and give a verdict (strong no hire, no hire, hire, strong hire). Grade only what happened in the session.\n\n${RUBRIC}\n`);
console.log(`Wrote ${files.length} transcripts, RUBRIC.md and grades-template.csv to ${out}`);
