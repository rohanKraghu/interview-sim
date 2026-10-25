# Checking the scorecard against people

The scorecard is a model's opinion until it is compared with human interviewers. This is the protocol, and the tools in `calibration/` do the arithmetic.

## What gets measured

For each rubric dimension and the verdict:

- **AI vs people.** How closely the model's scores match each human grader's.
- **People vs people.** How closely the human graders match each other. This is the ceiling. Human interviewers often disagree a fair amount, and an AI grader that agrees with people about as well as they agree with each other is doing the job.
- **AI vs AI.** The model grades the same session several times. If it disagrees with itself, no other number matters.

Each comparison reports:

- Quadratic weighted kappa: 1 is perfect agreement and 0 is chance. A 3 vs 4 counts less against it than a 1 vs 4.
- A bootstrap 95% interval, resampling over sessions.
- Exact agreement, and agreement within one point.

## Steps

1. **Collect sessions.** After each practice interview, press **Download session** on the review page. Aim for 20 to 30 sessions with a spread of quality, from more than one candidate if you can.
2. **Make the blind packet.** Run `node calibration/transcripts.mjs packet sessions/*.json`. It writes one transcript per session (the final code and its test results, but no AI scores), `RUBRIC.md`, and `grades-template.csv`.
3. **Human grading.** Two or three people who have run real interviews each fill in a copy of the template under their own name.
4. **AI grading.** Run `ANTHROPIC_API_KEY=... node calibration/regrade.mjs sessions/*.json --times 3 > ai.csv`.
5. **Compare.** Run `node calibration/agreement.mjs ai.csv grades-*.csv`.
6. **Publish the table in the README**, including the weak spots.

## Reading it

With 20 sessions the intervals will be wide, roughly plus or minus 0.2 kappa, so treat a single run as a first look.

- If AI vs people falls inside the people vs people interval for a dimension, the AI grades it like another interviewer would.
- If it falls clearly below, the rubric wording or the prompt for that dimension needs work. Change it, then re-run steps 4 and 5 on the same sessions.

## Without human grades

`eval/run.mjs` already checks two things that need no people:

- A strong scripted session must outscore a weak one on every run.
- The verdicts must come out hire and no hire respectively.

These catch gross failures, not calibration.
