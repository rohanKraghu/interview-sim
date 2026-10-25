# Real-time voice: options and a plan

Researched 2026-10-25. The current page uses the browser's Web Speech API, which is the main reason the interviewer can feel fake.

## What is wrong with browser speech

- **Slow turns.** A reply waits for Chrome to finalize the transcript, then a fixed 1.4 s pause, then the model's reply, then speech synthesis. That adds up to several seconds.
- **No sense of turn.** It ends a turn on silence alone. Candidates thinking aloud pause for several seconds mid-thought, and a silence rule either cuts in on them or responds late.
- **Interruptions are rough.** Barge-in depends on a word-overlap echo filter.
- **Limited reach.** The voices sound robotic, and recognition only works in Chrome and Edge.

## Options

### 1. Speech-to-speech: Phonic

[Phonic](https://home.phonic.ai/) runs audio-native models for the conversation itself, with frontier models working as supervisors for reasoning and tool calls.

- **What fits.** It handles interruptions and says it hears tone and hesitation, not only words. Agents can call tools while speaking. Recruiting screens are one of its listed use cases.
- **Speed.** Its site claims 500 to 1000 ms replies.
- **Silence and interruption settings.** These map straight onto our features:
  - `no_input_poke_sec` and `no_input_poke_text` give built-in silence nudges.
  - `min_words_to_interrupt` stops a stray "um" from cutting the interviewer off.
  - `vad_min_silence_duration_ms` sets how long a pause has to be before it counts.
- **Price.** $0.06 a minute on the free Starter plan, which includes $30 of monthly credit. Pro is $0.055 a minute, and there are no separate LLM charges.
- **Integration.** A [LiveKit Agents plugin](https://docs.livekit.io/agents/models/realtime/plugins/phonic.md) for Python and Node, or its own WebSockets from a server. Browsers connect with short-lived [session tokens](https://docs.phonic.ai/docs/build/with-web-sockets/live_websocket) that a backend mints. The API key never goes to the browser.
- **Unknowns.**
  - The docs don't mention bringing your own LLM.
  - I found no message for pushing arbitrary context, such as the candidate's latest code, into a live call. Context reaches the agent through tools it decides to call ([context tools](https://docs.phonic.ai/docs/build/tools/context_tools.md), WebSocket tools).
  - So code-reading and measurement would be tools (`get_code`, `run_and_measure`). We would rely on the voice agent to call them at the right moments.

### 2. Cascaded pipeline: LiveKit Agents or Pipecat, with our own model

Streaming speech-to-text, then our interviewer (the existing `turnRequest`, unchanged), then streaming text-to-speech.

- **Turn detection is the key part.**
  - [LiveKit's end-of-utterance model](https://livekit.com/blog/using-a-transformer-to-improve-end-of-turn-detection) is a 135M-parameter transformer that reads the transcript. LiveKit reports it cuts unintended interruptions by 85%, and it waits longer when the words sound unfinished ("I think I could use a heap, but...").
  - [Pipecat Smart Turn v3](https://www.daily.co/blog/announcing-smart-turn-v3-with-cpu-inference-in-just-12ms/) reads the audio instead. It is an 8 MB open model that runs in about 12 ms on a CPU, with about 94% accuracy in English.
  - [AssemblyAI's streaming speech-to-text](https://www.assemblyai.com/blog/turn-detection-endpointing-voice-agent) has semantic end-of-turn built in, with a median of about 300 ms to the final transcript.
- **What it keeps.** Everything this repo has built: the prompts, the measurement events and the eval harness all stay valid, because the interviewer still sees text.
- **The cost is latency.** Expect about 1 to 1.5 s a turn unless the reply streams. To get there: put `say` first in the output, start text-to-speech on the first sentence, and try a faster model for routine turns. The eval harness can show whether the faster model still pushes back when it should.

### 3. Hybrid: speech-to-speech surface, our interviewer as supervisor

The voice model handles turn-taking, small acknowledgements and quick replies. Our interviewer runs alongside on every code change, claim and measurement, and hands the voice agent what to raise next through a tool. This is the split Phonic describes for its own product, with our domain logic as the supervisor.

## Interview-specific requirement

Most voice agents are tuned for customer service, where 0.5 to 1 s of silence means "your turn". In a coding interview, a 5-second pause usually means "still thinking". The turn detector needs to read unfinished sentences, and the silence ceiling has to be long, with our own nudge logic deciding when silence matters.

## Plan

1. **Cascaded server (about 1 to 2 days).** A small Node server using LiveKit Agents:
   - AssemblyAI or Deepgram streaming speech-to-text, plus LiveKit's turn detector.
   - The existing interviewer behind it.
   - Cartesia or ElevenLabs text-to-speech.

   Measure time-to-first-audio per turn. This also moves the Anthropic key to the server, so users stop pasting keys into the page.
2. **Phonic in the same server.** Swap in Phonic's `RealtimeModel` through the LiveKit plugin. Expose `get_code`, `run_and_measure` and `ask_interviewer` (our model) as tools, then compare against step 1:
   - latency
   - how natural it feels
   - whether pushback still lands, checked with scripted candidate audio made from the eval scenarios
3. Keep whichever wins, or the hybrid if Phonic's turn-taking is clearly better and its tool use is reliable enough.

**Needed from you:** a Phonic account (the free tier is enough to start) and keys for the speech-to-text and text-to-speech providers, added as environment secrets. Then a decision on where the small server runs.
