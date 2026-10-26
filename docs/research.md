# What real rounds look like, and what to build

Research done 2026-10-25 to decide which features make the practice interviewer feel like a real one.

## How live coding rounds actually run

- **Length and count.** Meta's phone screen is 35 minutes for two problems and its onsite coding rounds are 40 minutes for two. Most other companies run 45 minutes with one or two problems, minus a few minutes of intro and questions at the end. ([igotanoffer](https://igotanoffer.com/en/advice/meta-coding-interviews))
- **Plain editor, often no running.** CoderPad or a shared doc, often without running the code, so candidates are expected to trace it by hand. ([igotanoffer](https://igotanoffer.com/en/advice/meta-coding-interviews))
- **The interviewer keeps the clock.** A round moves through clarifying, approach, coding, testing and complexity. When a candidate overruns one of these phases, the interviewer moves them along.
- **Hints are part of the round.** A hint is not an automatic fail. What counts is how much help was needed and whether the candidate used it well. Resisting help counts against you. ([PracHub rubric guide](https://prachub.com/resources/technical-interview-rubric-how-companies-score-coding-design-and-communication))
- **Constraints change mid-problem.** Interviewers add follow-ups and change a constraint, such as a bigger character set, to see whether the candidate can adapt. ([igotanoffer](https://igotanoffer.com/en/advice/meta-coding-interviews))
- **Graded signals.** Interviewers grade communication (clarifying questions, narrating), problem solving (an optimal approach, accurate complexity, few hints), technical skill (clean, working code) and testing (corner cases, finding your own bugs). ([Tech Interview Handbook](https://www.techinterviewhandbook.org/coding-signals/))
- **The newer AI-assisted round.** Meta now runs a 60-minute round on a multi-file codebase with an AI assistant built in. It grades what you hand to the AI, how well you review its output, and whether you can explain every line. ([interviewing.io](https://interviewing.io/blog/how-to-use-ai-in-meta-s-ai-assisted-coding-interview-with-real-prompts-and-examples))

## What existing tools do

| Tool | What stands out |
|---|---|
| Interviewing.io | Mocks with real engineers, plus AI practice before them, and detailed feedback afterward |
| Hello Interview (system design) | Three interviewer personas, a hire or no-hire call with confidence, and a replay that syncs transcript and audio with coaching points tied to moments. Scoring is calibrated on 10,000+ human mocks |
| HackerRank | A timed editor that grades by running tests. Feedback is mostly about correctness |
| Exponent | Scoring against a rubric |
| Final Round AI | Questions tailored to your resume and the job description |
| Interview Query | Follow-up questions that probe your reasoning |

Sources: [Interview Query's ranking](https://www.interviewquery.com/p/best-ai-interviewer-platforms), [Hello Interview Live](https://www.hellointerview.com/live).

The gap: most tools grade the final answer. Few behave like the person across the table, who keeps the clock, pushes back, tests your conviction and changes constraints on you.

## Ranking

Ranked by how much each feature adds to realism, how rare it is in other tools, and how much it costs to build.

| # | Feature | Why | Status |
|---|---|---|---|
| 1 | Pacing through the phases of a round (clarify, approach, code, test, complexity, follow-up) against a time plan. The interviewer moves you along when you overrun | Real interviewers keep the clock, and few tools do | Built |
| 2 | Pushback on wrong claims, plus a skeptical persona that also questions correct claims to see whether you can defend them | Holding a correct answer under pressure is a real signal that tools don't test | Built (pushback was in v1) |
| 3 | A follow-up and a curveball constraint change for each problem | Interviewers change constraints mid-problem | Built |
| 4 | A replay timeline with coaching notes at the moments that mattered, what a stronger candidate would have said, and your code as it was at that moment | Hello Interview has this for system design. Coding tools rarely do | Built |
| 5 | Every interviewer turn is labelled (hint, nudge, pushback, probe, pace...) and the scorecard weighs how much help you needed and how you used it | Matches how rubrics treat hints | Built |
| 6 | A two-problem, 35-minute phone screen format | Matches Meta's screen | Built |
| 7 | Speaking stats: how much of the talking you did, words per minute, longest silence, hints, pushbacks | Cheap, and communication is a graded signal | Built |
| 8 | Three interviewer personas (neutral, friendly, skeptical) | Hello Interview offers personas | Built |
| 9 | Six problems, each with notes on the usual wrong complexity claims | The pushback relies on these notes | Built |
| 10 | Running your code against hidden tests | Common in other tools, but many real rounds don't run code, so tracing by hand stays the default | Next |
| 11 | A mode for Meta's AI-assisted round (a multi-file repo and an assistant in the editor) | New and hard to practise for, but a big build | Later |
| 12 | Calibrating the scorecard against human interviewers | The "honest scoring" angle. Needs labelled human mocks | Later |
| 13 | Tracking progress across sessions | Useful, and standard in other tools | Later |
| 14 | Questions tailored to your resume or a company | Every tool already does this | Skip |
