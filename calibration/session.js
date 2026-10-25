// Turns a downloaded session file back into the state the prompts expect.
import { readFileSync } from 'node:fs';
import { FORMATS, PERSONAS, PROBLEMS } from '../interviewer.js';

export function loadSession(file) {
  const d = JSON.parse(readFileSync(file, 'utf8'));
  return {
    ...d,
    format: FORMATS[d.formatId], persona: PERSONAS[d.personaId],
    problems: d.problems.map((id) => PROBLEMS.find((p) => p.id === id)),
  };
}

export const DIMENSIONS = ['problem_solving', 'code_correctness', 'complexity_analysis', 'communication', 'testing'];

// CSV rows for a scorecard, one per dimension plus the verdict.
export function cardRows(session, grader, card) {
  return [...card.scores.map((x) => `${session},${grader},${x.dimension},${x.score}`), `${session},${grader},verdict,${card.verdict}`];
}
