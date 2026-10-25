# Interview Sim

A practice tool for live coding interviews. A voice interviewer runs a real round, listens while you think out loud, and behaves like the person across the table instead of a grader:

- **Talks out loud** and listens through your microphone. You can cut it off mid-sentence.
- **Keeps the clock.** The round moves through clarify, approach, code, test, complexity and follow-up against a time plan. If you overrun a phase, the interviewer moves you along, as real ones do.
- **Nudges when you go quiet.** After 30 seconds of silence it checks in, then gives a small hint pointed at your code if you stay stuck. If you are typing without talking, it asks you to narrate.
- **Reads the code you are writing** and asks about specific lines. When it sees a bug it asks a leading question instead of handing you the fix.
- **Pushes back on wrong claims.** Say the heap solution is O(n) and it will ask you to walk through the sort. The skeptical interviewer also questions claims that are correct, to see whether you can defend them.
- **Follow-ups and curveballs.** When you finish, it asks about edge cases and complexity, then a follow-up, then changes a constraint ("the grid no longer fits in memory").
- **Two formats.** A 30-minute onsite round with one problem, or a 35-minute phone screen with two problems, like Meta's.
- **Scorecard and replay.** You get a hire or no-hire call on a published rubric, with evidence for each score, and stats on how much of the talking you did, your longest silence and the hints you needed. A replay timeline marks the turning points, says what a stronger candidate would have said at each one, and shows your code as it was at any moment you click.

[docs/research.md](docs/research.md) covers how real rounds run, what other prep tools do, and the ranking behind these features.

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

## Test

```
node test.mjs
```

## Not built yet

- Running the code against tests. The interviewer reads the code but does not run it, as in many real rounds.
- A mode for Meta's AI-assisted round.
- Calibrating the scorecard against human interviewers.
- Progress across sessions, and a real code editor with syntax highlighting.
