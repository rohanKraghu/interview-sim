# Interview Sim

A practice tool for live coding interviews. A voice interviewer runs a real round, listens while you think out loud, and behaves like the person across the table instead of a grader:

- **Talks out loud** and listens through your microphone. You can cut it off mid-sentence.
- **Keeps the clock.** The round moves through clarify, approach, code, test, complexity and follow-up against a time plan. If you overrun a phase, the interviewer moves you along, as real ones do.
- **Nudges when you go quiet.** After 30 seconds of silence it checks in, then gives a small hint pointed at your code if you stay stuck. If you are typing without talking, it asks you to narrate.
- **Reads the code you are writing** and asks about specific lines. When it sees a bug it asks a leading question instead of handing you the fix.
- **Pushes back on wrong claims.** Say the heap solution is O(n) and it will ask you to walk through the sort. The skeptical interviewer also questions claims that are correct, to see whether you can defend them.
- **Follow-ups and curveballs.** When you finish, it asks about edge cases and complexity, then a follow-up, then changes a constraint ("the grid no longer fits in memory").
- **Two formats.** A 30-minute onsite round with one problem, or a 35-minute phone screen with two problems, like Meta's.
- **Runs your code.** In Python or JavaScript, against hidden tests, and times it as the input doubles. When you claim a complexity, the interviewer gets a fresh measurement first, so "I don't think that's linear" comes with evidence: "when I doubled the input, your code took four times as long".
- **Scorecard and replay.** You get a hire or no-hire call on a published rubric, with evidence for each score and the final test results. You also get stats on how much of the talking you did, your longest silence and the hints you needed. A replay timeline marks the turning points, says what a stronger candidate would have said at each one, and shows your code and the measurements at any moment you click. You can download the session for regrading.

[docs/research.md](docs/research.md) covers how real rounds run, what other prep tools do, and the ranking behind these features. [docs/realtime-voice.md](docs/realtime-voice.md) compares ways to get real-time voice, including Phonic.

## Run it

It is a static page with no build step.

```
python3 -m http.server 8000
```

Open http://localhost:8000 in Chrome or Edge (they have the speech recognition the page uses), pick a format, a problem and an interviewer, paste an Anthropic API key and start. Headphones help: the page filters out its own voice, but speakers can still confuse the mic. Other browsers work too if you type your replies into the box under the transcript.

The key is saved in your browser's local storage and sent only to api.anthropic.com.

## How it works

Each interviewer turn is one stateless request that carries the problem, private interviewer notes (the optimal approach, common wrong complexity claims, edge cases), the elapsed time, your code with line numbers and the full transcript. The model replies with what to say, or an empty string to stay quiet. Turns are triggered by:

| Trigger | When |
|---|---|
| You spoke | 1.4 s after you stop talking |
| Silence | 30 s of no speech, then 45 s, then 60 s |
| Code check-in | your code changed noticeably and the interviewer has not spoken for 75 s |
| Time up | at the end of the format's time |

Each reply also labels the turn (hint, nudge, pushback, probe, pace, follow-up...) and the phase of the round. The labels drive the phase shown in the header, the hint and pushback counts, and the scorecard's judgment of how much help you needed.

`interviewer.js` holds all of this logic and the prompts. `app.js` is the browser side: speech in and out, the editor and the timers.

## Running code

`execute.js` holds each problem's hidden tests and an input generator, and `runner.js` runs the code in a web worker. Python runs through Pyodide, which is loaded from a CDN the first time. JavaScript runs directly. A run that takes over 10 s is treated as an infinite loop, and the worker is replaced.

Timing doubles the input from 256 elements until a run takes 300 ms or 3 s have passed. Each size takes the fastest of three tries, and the growth exponent is the median slope over the four largest sizes. Timing cannot tell n from n log n, and linear code can fit as high as n^1.5 once its data outgrows the CPU caches. So the interviewer is told to use measurements only to separate roughly linear from clearly worse, never n from n log n.

## Measuring the interviewer

`eval/scenarios.js` has 18 scripted moments from an interview, each with checks on what a good interviewer does next. Examples:

- nudge on silence without a hint
- push back on "the heap version is O(n)"
- keep pushing when the candidate repeats it
- lead to a failing edge case without stating the fix
- move a candidate along at 12 minutes
- accept a correct claim

```
ANTHROPIC_API_KEY=... node eval/run.mjs --repeat 3
```

Each moment is sent several times, and the run reports how often the reply passes. It also checks that a strong scripted session outscores a weak one on every grading. Run it before and after any prompt change. Results are saved in `eval/results/`.

## Calibrating the scorecard

[docs/calibration.md](docs/calibration.md) is the protocol for comparing the scorecard with human interviewers. It reports weighted kappa with bootstrap intervals for AI vs people, people vs people and AI vs AI. The scripts are in `calibration/`.

## Test

```
node test.mjs
```

The tests cover:

- the prompts and timing rules
- every problem's hidden tests, against reference solutions in both languages (Python through the local `python3`)
- planted bugs that must fail
- slow solutions that must measure clearly superlinear while fast ones measure close to linear
- the eval checks themselves, each with a good and a bad example reply
- the calibration statistics and scripts

## Not built yet

- Real-time voice. See [docs/realtime-voice.md](docs/realtime-voice.md) for the plan.
- Published calibration numbers. The tooling is here, but it needs graded sessions.
- A mode for Meta's AI-assisted round.
- Progress across sessions, and a real code editor with syntax highlighting.
