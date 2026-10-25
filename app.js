import {
  PROBLEMS, INTERVIEW_MINUTES, CHECKIN_SECONDS,
  turnRequest, scorecardRequest, parseJsonReply, isEcho, quietEvent,
} from './interviewer.js';

const $ = (id) => document.getElementById(id);
const KEY_STORE = 'interview-sim-key';

let s; // interview state, built on start
let busy = false, pending = [];
let lastSpeech = 0, lastKey = 0, lastNudge = 0, nudges = 0, lastTurn = 0;
let codeAtCheck = '', timeUpSent = false, finished = false;
let speaking = false, speakEnd = 0, lastSpoken = '';
let heard = '', flushTimer, rec, ticker;

// Setup screen
for (const p of PROBLEMS) $('problem').add(new Option(p.title, p.id));
try { $('key').value = localStorage.getItem(KEY_STORE) || ''; } catch {}
$('start').onclick = start;

async function callClaude(body) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': s.key,
      'anthropic-version': '2026-10-21',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
  });
  const json = await r.json();
  if (!r.ok) throw new Error(json.error?.message || `HTTP ${r.status}`);
  return json;
}

function start() {
  const key = $('key').value.trim();
  if (!key) { $('key').focus(); return; }
  try { localStorage.setItem(KEY_STORE, key); } catch {}
  s = { key, problem: PROBLEMS.find((p) => p.id === $('problem').value), code: '', log: [], t0: Date.now(), elapsed: 0 };
  $('title').textContent = s.problem.title;
  $('statement').textContent = s.problem.statement;
  $('setup').hidden = true;
  $('room').hidden = false;
  $('editor').focus();
  lastSpeech = lastKey = lastTurn = Date.now();
  startMic();
  ticker = setInterval(tick, 1000);
  turn('The interview is starting. Greet the candidate in one sentence, say the problem title, and ask them to read the statement on screen and share their first thoughts out loud.');
  tick();
}

function log(who, text) {
  s.log.push({ who, text, t: Date.now() - s.t0 });
  if (who === 'event') return;
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
  try {
    const reply = parseJsonReply(await callClaude(turnRequest(s, event)));
    log('event', event);
    // Don't talk over a candidate who started speaking while we were thinking.
    const talkedOver = lastSpeech > asked || heard;
    if (reply.say.trim() && !talkedOver) { log('interviewer', reply.say); speak(reply.say); }
    if (reply.end) return finish();
    status('');
  } catch (e) {
    status(`Interviewer error: ${e.message}`);
  } finally {
    busy = false;
    if (pending.length && !finished) turn(pending.splice(0).join(' Also: '));
  }
}

function tick() {
  const now = Date.now();
  s.elapsed = now - s.t0;
  const left = INTERVIEW_MINUTES * 60000 - s.elapsed;
  const sec = Math.max(0, Math.ceil(left / 1000));
  $('timer').textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
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
  s.elapsed = Date.now() - s.t0;
  $('dot').className = 'dot';
  $('card').hidden = false;
  $('card-body').textContent = 'Writing your scorecard...';
  try {
    renderCard(parseJsonReply(await callClaude(scorecardRequest(s))));
  } catch (e) {
    $('card-body').textContent = `Could not write the scorecard: ${e.message}`;
  }
}

function renderCard(c) {
  const body = $('card-body');
  body.replaceChildren();
  const el = (tag, text, cls) => { const n = document.createElement(tag); n.textContent = text; if (cls) n.className = cls; return n; };
  body.append(el('p', c.verdict, 'verdict'), el('p', c.summary));
  for (const x of c.scores) {
    const row = el('div', '', 'score');
    row.append(el('span', x.dimension.replace('_', ' '), 'dim'), el('span', `${x.score}/4`, `pts s${x.score}`), el('p', x.evidence, 'evidence'));
    body.append(row);
  }
  body.append(el('h3', 'Work on'));
  const ul = document.createElement('ul');
  for (const w of c.work_on) ul.append(el('li', w));
  body.append(ul);
}

function status(text) { $('status').textContent = text; }
