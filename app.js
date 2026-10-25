import {
  PROBLEMS, FORMATS, PERSONAS, CHECKIN_SECONDS, callClaude, isComplexityClaim,
  turnRequest, scorecardRequest, parseJsonReply, isEcho, quietEvent,
  pickProblems, sessionStats, clock, parseClock, numbered,
} from './interviewer.js';
import { LANGS, starter, evidenceText, describeGrowth } from './execute.js';
import { measure } from './measure.js';

const $ = (id) => document.getElementById(id);
const KEY_STORE = 'interview-sim-key';

let s; // interview state, built on start
let busy = false, pending = [];
let lastSpeech = 0, lastKey = 0, lastNudge = 0, nudges = 0, lastTurn = 0;
let codeAtCheck = '', timeUpSent = false, finished = false;
let speaking = false, speakEnd = 0, lastSpoken = '';
let heard = '', flushTimer, rec, ticker;

// Setup screen
$('problem').add(new Option('Surprise me', ''));
for (const p of PROBLEMS) $('problem').add(new Option(p.title, p.id));
for (const [id, f] of Object.entries(FORMATS)) $('format').add(new Option(f.label, id));
for (const [id, p] of Object.entries(PERSONAS)) $('persona').add(new Option(p.label, id));
for (const [id, l] of Object.entries(LANGS)) $('lang').add(new Option(l.label, id));
try { $('key').value = localStorage.getItem(KEY_STORE) || ''; } catch {}
$('start').onclick = start;

function start() {
  const key = $('key').value.trim();
  if (!key) { $('key').focus(); return; }
  try { localStorage.setItem(KEY_STORE, key); } catch {}
  const format = FORMATS[$('format').value];
  s = {
    id: new Date().toISOString().replace(/\D/g, '').slice(0, 14), key,
    formatId: $('format').value, format, personaId: $('persona').value, persona: PERSONAS[$('persona').value],
    lang: $('lang').value, problems: pickProblems($('problem').value, format.problems),
    idx: 0, code: '', codes: [], results: [], log: [], t0: Date.now(), elapsed: 0, problemStart: 0, maxQuiet: 0,
  };
  $('run').hidden = !runnable();
  if (s.lang === 'python') measure(s.problems[0].id, 'python', starter(s.problems[0].id, 'python')); // loads Python early
  showProblem();
  $('setup').hidden = true;
  $('room').hidden = false;
  lastSpeech = lastKey = lastTurn = Date.now();
  startMic();
  ticker = setInterval(tick, 1000);
  turn('The interview is starting. Greet the candidate in one sentence, say the problem title, and ask them to read the statement on screen and share their first thoughts out loud.');
  tick();
}

function showProblem() {
  const p = s.problems[s.idx];
  $('title').textContent = s.problems.length > 1 ? `${s.idx + 1}/${s.problems.length}  ${p.title}` : p.title;
  $('statement').textContent = p.statement;
  $('editor').value = s.code = codeAtCheck = starter(p.id, s.lang);
  $('ran').textContent = '';
  $('editor').focus();
}

const runnable = () => s.lang !== 'other';

// Runs the current code; logs the evidence for the interviewer and returns it.
async function measureNow() {
  if (!runnable()) return '';
  $('ran').textContent = 'Running...';
  const p = s.problems[s.idx], m = await measure(p.id, s.lang, s.code);
  s.results[s.idx] = m;
  $('ran').textContent = !m ? '' : m.error ? `Could not run: ${m.error}`
    : `${m.tests.passed} of ${m.tests.total} hidden tests passed`;
  const text = evidenceText(p.id, m);
  if (text) log('measure', text);
  return text;
}

$('run').onclick = async () => {
  if (finished || $('ran').textContent === 'Running...') return;
  const text = await measureNow();
  if (text) turn(`The candidate ran their code. ${text}`);
};

async function nextProblem() {
  s.codes[s.idx] = s.code;
  busy = true; // no nudges about the old problem while its final code runs
  await measureNow();
  busy = false;
  s.idx++;
  s.problemStart = Date.now() - s.t0;
  showProblem();
  turn(`Problem ${s.idx + 1} is now on screen. Introduce it in one sentence and ask for their first thoughts.`);
}

function log(who, text, kind) {
  s.log.push({ who, text, kind, t: Date.now() - s.t0, code: s.code, p: s.idx });
  if (who === 'event' || who === 'measure') return;
  const line = document.createElement('p');
  line.className = who;
  line.textContent = text;
  $('transcript').append(line);
  line.scrollIntoView({ block: 'end' });
}

async function turn(event) {
  if (finished) return;
  if (busy) { pending.push(event); return; }
  busy = true;
  const asked = lastTurn = Date.now();
  s.elapsed = Date.now() - s.t0;
  let advance = false;
  try {
    const reply = parseJsonReply(await callClaude(s.key, turnRequest(s, event)));
    log('event', event);
    $('phase').textContent = reply.phase;
    // Don't talk over a candidate who started speaking while we were thinking.
    const talkedOver = lastSpeech > asked || heard;
    if (reply.say.trim() && !talkedOver) { log('interviewer', reply.say, reply.kind); speak(reply.say); }
    if (reply.end) return finish();
    advance = reply.move_on && s.idx < s.problems.length - 1;
    status('');
  } catch (e) {
    status(`Interviewer error: ${e.message}`);
  } finally {
    busy = false;
  }
  if (advance) { pending = []; return nextProblem(); }
  if (pending.length && !finished) turn(pending.splice(0).join(' Also: '));
}

function tick() {
  const now = Date.now();
  s.elapsed = now - s.t0;
  const left = s.format.minutes * 60000 - s.elapsed;
  $('timer').textContent = clock(Math.max(0, left) + 999);
  if (!speaking && !heard) s.maxQuiet = Math.max(s.maxQuiet, now - Math.max(lastSpeech, speakEnd));
  if (busy || speaking || heard) return;
  if (left <= 0 && !timeUpSent) { timeUpSent = true; return turn('Time is up. Close the interview now.'); }
  const quiet = quietEvent(now, lastSpeech, lastKey, Math.max(lastNudge, speakEnd), nudges);
  if (quiet) { nudges++; lastNudge = now; return turn(quiet); }
  // A periodic look at new code, so questions can land while they write it.
  if (Math.abs(s.code.length - codeAtCheck.length) > 40 && now - lastTurn > CHECKIN_SECONDS * 1000) {
    codeAtCheck = s.code;
    turn('Periodic look at the code, which changed since you last looked. Ask about a specific line only if it would help right now (a bug, an unexplained choice); otherwise stay quiet.');
  }
}

// Voice out
function speak(text) {
  if (!window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(text);
  u.voice = speechSynthesis.getVoices().find((v) => /en[-_]US/i.test(v.lang) && /natural|google|samantha/i.test(v.name)) || null;
  u.rate = 1.05;
  u.onstart = () => { speaking = true; $('dot').className = 'dot talking'; };
  u.onend = u.onerror = () => { speaking = false; speakEnd = Date.now(); $('dot').className = rec ? 'dot live' : 'dot'; };
  lastSpoken = text;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

// Voice in
function startMic() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { status('Voice input needs Chrome or Edge. You can type replies below.'); return; }
  rec = new SR();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = 'en-US';
  rec.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      const recent = speaking || Date.now() - speakEnd < 1500;
      if (recent && isEcho(t, lastSpoken)) continue;
      if (speaking) { speechSynthesis.cancel(); log('event', 'The candidate cut in while you were talking.'); }
      lastSpeech = Date.now();
      nudges = 0;
      if (e.results[i].isFinal) heard += ' ' + t; else interim += t;
    }
    $('caption').textContent = (heard + ' ' + interim).trim();
    clearTimeout(flushTimer);
    if (heard) flushTimer = setTimeout(flushHeard, 1400);
  };
  rec.onerror = (e) => { if (e.error === 'not-allowed') { status('Microphone blocked. You can type replies below.'); rec = null; } };
  rec.onend = () => { if (rec && !finished) rec.start(); }; // Chrome stops after a while
  rec.start();
  $('dot').className = 'dot live';
}

function flushHeard() {
  const text = heard.trim();
  heard = '';
  $('caption').textContent = '';
  if (text) candidateSaid(text);
}

function candidateSaid(text) {
  lastSpeech = Date.now();
  nudges = 0;
  log('candidate', text);
  // A complexity claim gets checked against a fresh measurement before the interviewer answers.
  if (isComplexityClaim(text) && runnable() && s.code.trim()) {
    measureNow().then((evidence) => turn(`The candidate just spoke (last CANDIDATE line) and made a complexity claim. ${evidence}`));
    return;
  }
  turn('The candidate just spoke (last CANDIDATE line).');
}

$('say').onkeydown = (e) => {
  if (e.key !== 'Enter' || !e.target.value.trim()) return;
  if (speaking) speechSynthesis.cancel();
  candidateSaid(e.target.value.trim());
  e.target.value = '';
};

// Editor
$('editor').oninput = (e) => { s.code = e.target.value; lastKey = Date.now(); };
$('editor').onkeydown = (e) => {
  if (e.key !== 'Tab') return;
  e.preventDefault();
  e.target.setRangeText('    ', e.target.selectionStart, e.target.selectionEnd, 'end');
  e.target.dispatchEvent(new Event('input'));
};
$('end').onclick = () => finish();

async function finish() {
  if (finished) return;
  finished = true;
  clearInterval(ticker);
  const r = rec; rec = null; r?.stop();
  speechSynthesis?.cancel();
  s.codes[s.idx] = s.code;
  s.elapsed = Date.now() - s.t0;
  $('card-body').textContent = 'Running your final code...';
  $('room').hidden = true;
  $('review').hidden = false;
  await measureNow();
  $('card-body').textContent = 'Writing your scorecard...';
  renderReplay([]);
  try {
    const card = parseJsonReply(await callClaude(s.key, scorecardRequest(s)));
    s.scorecard = card;
    renderCard(card);
    renderReplay(card.moments);
  } catch (e) {
    $('card-body').textContent = `Could not write the scorecard: ${e.message}`;
  }
  $('download').hidden = false;
}

const el = (tag, text = '', cls) => { const n = document.createElement(tag); n.textContent = text; if (cls) n.className = cls; return n; };

function renderCard(c) {
  const st = sessionStats(s);
  const body = $('card-body');
  body.replaceChildren(el('p', c.verdict, 'verdict'), el('p', c.summary));
  const stats = el('div', '', 'stats');
  const runs = s.results.filter((m) => m?.tests);
  const tests = runs.length ? [['hidden tests', `${runs.reduce((a, m) => a + m.tests.passed, 0)}/${runs.reduce((a, m) => a + m.tests.total, 0)}`]] : [];
  for (const [label, v] of [['you talked', `${st.talkShare}%`], ['words/min', st.wordsPerMinute], ['longest silence', `${st.longestSilence}s`], ['hints', st.hints], ['pushbacks', st.pushbacks], ...tests]) {
    const box = el('div');
    box.append(el('b', String(v)), el('span', label));
    stats.append(box);
  }
  body.append(stats);
  s.results.forEach((m, i) => {
    if (m?.tests) body.append(el('p', `${s.problems[i].title}: ${m.tests.passed}/${m.tests.total} tests, runtime grew about n^${m.slope?.toFixed(1) ?? '?'}, ${describeGrowth(m.slope)}.`, 'evidence'));
  });
  for (const x of c.scores) {
    const row = el('div', '', 'score');
    row.append(el('span', x.dimension.replace('_', ' '), 'dim'), el('span', `${x.score}/4`, `pts s${x.score}`), el('p', x.evidence, 'evidence'));
    body.append(row);
  }
  body.append(el('h3', 'Work on'));
  const ul = el('ul');
  for (const w of c.work_on) ul.append(el('li', w));
  body.append(ul);
}

// Timeline of the session: what was said, coaching notes at the moments that
// mattered, and the code as it was at any point you click.
function renderReplay(moments) {
  const notes = moments.map((m) => ({ ...m, t: parseClock(m.at) ?? Infinity })).sort((a, b) => a.t - b.t);
  const list = $('timeline');
  list.replaceChildren();
  let n = 0;
  const said = s.log.filter((e) => e.who !== 'event');
  for (const e of said) {
    while (n < notes.length && notes[n].t <= e.t) list.append(noteEl(notes[n++]));
    if (e.who === 'measure') { list.append(el('p', e.text, 'measured')); continue; }
    const row = el('button', '', `moment ${e.who}`);
    row.append(el('span', clock(e.t), 'at'), el('span', e.text));
    if (e.kind) row.append(el('span', e.kind, 'tag'));
    row.onclick = () => showCode(e, row);
    list.append(row);
  }
  while (n < notes.length) list.append(noteEl(notes[n++]));
  showCode({ t: s.elapsed, code: s.code, p: s.idx });
}

function noteEl(m) {
  const box = el('div', '', 'note');
  box.append(el('span', m.at, 'at'), el('p', m.what_happened), el('p', `Stronger: ${m.better}`, 'better'));
  return box;
}

function showCode(e, row) {
  for (const r of document.querySelectorAll('.moment.on')) r.classList.remove('on');
  row?.classList.add('on');
  $('code-at').textContent = `Code at ${clock(e.t)}, ${s.problems[e.p].title}`;
  $('code-view').textContent = e.code.trim() ? numbered(e.code) : '(empty)';
}

// Everything needed to regrade or hand-grade the session later (no API key).
$('download').onclick = () => {
  const { key, format, persona, problems, t0, ...rest } = s;
  const data = { version: 1, ...rest, problems: problems.map((p) => p.id) };
  const a = el('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }));
  a.download = `interview-${s.id}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
};

function status(text) { $('status').textContent = text; }
