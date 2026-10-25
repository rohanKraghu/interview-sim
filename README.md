# Interview Sim

A practice tool for live coding interviews. A voice interviewer gives you one problem, listens while you think out loud, and behaves like a real interviewer instead of a grader:

- **Talks out loud** and listens through your microphone. You can cut it off mid-sentence.
- **Nudges when you go quiet.** After 30 seconds of silence it checks in, then gives a small hint pointed at your code if you stay stuck. If you are typing without talking, it asks you to narrate.
- **Reads the code you are writing** and asks about specific lines ("why a set on line 6?"). When it sees a bug it asks a leading question instead of handing you the fix.
- **Pushes back on wrong claims.** Say the heap solution is O(n) and it will ask you to walk through the sort. It keeps the point open until you correct it.
- **Runs the usual follow-ups** when you say you are done: an example or edge case, then complexity, then a harder variant.
- **Ends with a scorecard** on a published rubric (problem solving, correctness, complexity analysis, communication, testing), each score backed by a quote from the session.

## Run it

It is a static page with no build step.

```
python3 -m http.server 8000
```

Open http://localhost:8000 in Chrome or Edge (they have the speech recognition the page uses), pick a problem, paste an Anthropic API key and start. Headphones help: the page filters out its own voice, but speakers can still confuse the mic. Other browsers work too if you type your replies into the box under the transcript.

The key is saved in your browser's local storage and sent only to api.anthropic.com.

## How it works

Each interviewer turn is one stateless request that carries the problem, private interviewer notes (the optimal approach, common wrong complexity claims, edge cases), the elapsed time, your code with line numbers and the full transcript. The model replies with what to say, or an empty string to stay quiet. Turns are triggered by:

| Trigger | When |
|---|---|
| You spoke | 1.4 s after you stop talking |
| Silence | 30 s of no speech, then 45 s, then 60 s |
| Code check-in | your code changed noticeably and the interviewer has not spoken for 75 s |
| Time up | at 30 minutes |

`interviewer.js` holds all of this logic and the prompts. `app.js` is the browser side: speech in and out, the editor and the timers.

## Test

```
node test.mjs
```

## Not built yet

- Running the code against tests. The interviewer reads the code but does not execute it.
- A real code editor (syntax highlighting, line numbers). It is a plain textarea.
- More than three problems.
- Replay of a session.
