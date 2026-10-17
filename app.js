(() => {
const D = DATA, $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const K = 'clsFade.v1';
const store = { lv: {}, best: {}, opt: { voice: true, mic: true, pause: 1, need: 'normal' }, key: '', script: 'vs', drug: 'draw', scene: '' };
try { const s = JSON.parse(localStorage.getItem(K) || '{}'); Object.assign(store, s, { opt: { ...store.opt, ...(s.opt || {}) } }); } catch {}
const save = () => { try { localStorage.setItem(K, JSON.stringify(store)); } catch {} };

// ---------- words ----------
function norm(t) { return ' ' + t.toLowerCase().replace(/[’‘]/g, "'").replace(/(\d) point (\d)/g, '$1.$2').replace(/[^a-z0-9.'\- ]+/g, ' ').replace(/\s+/g, ' ') + ' '; }
function words(t) { return norm(t).trim().split(' ').map(w => w.replace(/^[.'\-]+|[.'\-]+$/g, '')).filter(Boolean); }
const STOP = new Set("a an the and or but so to of in on at for from with by as is are was be been it it's its this that i i'm im i'll ill i've ive i'd you your you're youre we he he's his him my me just can could would will do does did have has had if then than there here what when how about into some any really going get got let let's lets okay ok well now also too please".split(' '));
function lev(a, b) {
  let p = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) { const c = [i]; for (let j = 1; j <= b.length; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = c; }
  return p[b.length];
}
// sound-alike: same first 3 letters and about two-thirds of the letters line up ("radio" ≈ "radial")
function alike(a, b) {
  if (a === b) return true;
  if (a.length < 4 || b.length < 4 || a.slice(0, 3) !== b.slice(0, 3)) return false;
  return lev(a, b) <= Math.max(1, Math.floor(Math.max(a.length, b.length) * .34));
}
for (const sc of Object.values(D.scripts)) for (const st of sc.steps) {
  if (st.g) st.groups = st.g.map(src => { const label = src.split('|')[0].replace(/\\b/g, ''); return { label, re: new RegExp(src, 'i'), words: words(label) }; });
}
const NEED = { loose: [0, 0], normal: [.7, .5], strict: [.85, .65] };
function judge(st, text) {
  const n = norm(text), heard = words(text), has = w => heard.some(h => alike(w, h));
  const hits = st.groups.map(g => g.re.test(n) || (g.words.length > 0 && g.words.every(has)));
  const target = [...new Set(words(st.words || st.say).filter(w => !STOP.has(w)))];
  const missed = target.filter(w => !has(w)), cov = target.length ? 1 - missed.length / target.length : 1;
  const [say, act] = NEED[store.opt.need] || NEED.normal;
  const need = st.kind === 'silent' ? 0 : st.kind === 'say' ? say : act;
  return { hits, cov, missed, pass: hits.every(Boolean) && cov >= need };
}

const learnable = st => st.kind !== 'partner' && st.kind !== 'banner';
const lv = st => store.lv[st.id] || 0;
const pickDrug = () => Math.random() < .5 ? 'para' : 'meto';
const maKey = () => store.drug === 'draw' ? pickDrug() : store.drug;
const homeKeys = () => store.script === 'vs' ? ['vs'] : store.drug === 'draw' ? ['para', 'meto'] : [store.drug];
const fmt = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

// ---------- text at a fade level ----------
function marks(text, groups) {
  const t = text.replace(/[’‘]/g, "'"), on = new Array(text.length).fill(false);
  for (const g of groups || []) {
    const re = new RegExp(g.re.source, 'gi'); let m;
    while ((m = re.exec(t))) { if (!m[0].length) { re.lastIndex++; continue; } for (let i = m.index; i < m.index + m[0].length; i++) on[i] = true; }
  }
  const segs = []; let c = null;
  for (let i = 0; i < text.length; i++) { if (!c || c.k !== on[i]) segs.push(c = { k: on[i], t: '' }); c.t += text[i]; }
  return segs;
}
const firsts = s => s.replace(/[A-Za-z0-9’'.\-]+/g, w => w[0]);
function body(st, L) {
  if (st.kind === 'partner') return `<span class="who">${esc(st.who)}</span>“${esc(st.words)}”`;
  if (st.kind === 'banner') return `<span class="ban">${esc(st.words)}</span>`;
  if (L >= 4) return '<span class="blank"></span>';
  if (L === 3) return `<span class="cue">${esc(st.title)}</span>`;
  const pre = st.kind === 'say' ? '' : '<span class="hand">✋</span>';
  const segs = marks(st.words || st.say, st.groups);
  if (L === 2) return pre + segs.map(s => s.k ? `<b>${esc(firsts(s.t))}</b>` : `<span class="fd">${esc(firsts(s.t))}</span>`).join('');
  if (L === 1) return pre + segs.map(s => s.k ? `<b>${esc(s.t)}</b>` : `<span class="fd">${esc(s.t)}</span>`).join('');
  return pre + segs.map(s => s.k ? `<u>${esc(s.t)}</u>` : esc(s.t)).join('');
}
const label = st => st.kind === 'partner' ? '' : st.kind === 'banner' ? 'Allocated on the day'
  : st.kind === 'silent' ? 'Silent' : st.kind === 'act' ? 'Do it · say it' : st.to ? `To ${st.to}` : 'Say';

// ---------- listening ----------
// With a Groq key: we record the mic ourselves (no Android beeps), wait for you to pause,
// then send that stretch of audio to Whisper with a medical word list.
// Without one: Chrome's built-in recogniser, judged only on finished sentences.
const GROQ = 'https://api.groq.com/openai/v1/audio/transcriptions';
const VOCAB = 'Nursing skills assessment with Mr John Luke, NHI DGY 2963, born 16 December 1942. Preceptor, MIT, wristband, tympanic thermometer, probe cover, radial pulse, respirations, brachial artery, stethoscope, cuff, systolic, diastolic, two-step blood pressure, 24-hour time. Paracetamol 1 g PO qid, analgesic, bronchospasm, platelets. Metoprolol succinate CR 47.5 mg PO daily, beta-adrenoceptor blocker, bradycardia, postural dizziness, palpitations, dyspnoea, diarrhoea, constipation, nausea, abdominal pain. Ask, Build, Check, teach-back.';
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const engine = () => store.key ? 'groq' : SR ? 'chrome' : 'tap';
let ear = null, rec = null, recWant = false, recHold = false, mstate = 'off';

function setMic(s) {
  mstate = s; const b = $('#mic');
  b.textContent = { off: 'Mic off', idle: 'Listening', hearing: 'Hearing you', checking: 'Checking…' }[s];
  b.classList.toggle('live', s !== 'off');
  if (s !== 'hearing') $('#lvl').style.width = '0';
}
async function micOn() {
  const e = engine();
  if (e === 'groq') return earOn();
  if (e === 'chrome') return recOn();
  setMic('off');
}
function micOff() { earOff(); recOff(); setMic('off'); }
function hold(on) {   // stop listening while Mr Luke or the RN talks
  if (ear) { ear.hold = on; if (on) { ear.on = false; ear.buf = []; } }
  if (rec && recWant) { recHold = on; try { on ? rec.abort() : rec.start(); } catch {} }
}

async function earOn() {
  if (ear) return setMic('idle');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: true, autoGainControl: true } });
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') await ctx.resume();
    const src = ctx.createMediaStreamSource(stream), proc = ctx.createScriptProcessor(2048, 1, 1), sink = ctx.createGain();
    sink.gain.value = 0; src.connect(proc); proc.connect(sink); sink.connect(ctx.destination);
    ear = { ctx, stream, proc, rate: ctx.sampleRate, floor: .008, pre: [], buf: [], on: false, loud: 0, quiet: 0, len: 0, hold: false };
    proc.onaudioprocess = ev => hear(ev.inputBuffer.getChannelData(0));
    setMic('idle');
  } catch { setMic('off'); toast('Couldn’t open the microphone. Allow it for this site in Chrome, then start again.'); }
}
function earOff() {
  if (!ear) return; const e = ear; ear = null;
  try { e.proc.onaudioprocess = null; e.stream.getTracks().forEach(t => t.stop()); e.ctx.close(); } catch {}
}
function hear(f) {
  const E = ear; if (!E) return;
  let s = 0; for (let i = 0; i < f.length; i++) s += f[i] * f[i];
  const rms = Math.sqrt(s / f.length), dt = f.length / E.rate, st = curStep();
  if (E.hold || !S || S.lock || !st || !st.groups) { E.on = false; E.buf = []; E.pre = []; E.loud = 0; return; }
  if (mstate !== 'checking') $('#lvl').style.width = Math.min(100, rms * 700) + '%';
  const chunk = new Float32Array(f);
  if (!E.on) {
    E.floor = E.floor * .97 + Math.min(rms, .05) * .03;
    E.pre.push(chunk); while (E.pre.length * dt > .35) E.pre.shift();
    if (rms > Math.max(.012, E.floor * 3)) { E.loud += dt; if (E.loud >= .1) { E.on = true; E.buf = E.pre; E.pre = []; E.quiet = 0; E.len = 0; setMic('hearing'); } }
    else E.loud = 0;
  } else {
    E.buf.push(chunk); E.len += dt;
    if (rms < Math.max(.009, E.floor * 2.2)) E.quiet += dt; else E.quiet = 0;
    if (E.quiet >= +store.opt.pause || E.len > 28) {
      const b = E.buf, spoken = E.len - E.quiet; E.on = false; E.buf = []; E.loud = 0;
      if (spoken > .3) send(b, E.rate); else setMic('idle');
    }
  }
}
function wav(bufs, rate) {   // 16 kHz mono 16-bit WAV
  const n = bufs.reduce((a, b) => a + b.length, 0), all = new Float32Array(n); let o = 0;
  for (const b of bufs) { all.set(b, o); o += b.length; }
  const r = rate / 16000, m = Math.floor(n / r), pcm = new Int16Array(m);
  for (let i = 0; i < m; i++) {
    const a = Math.floor(i * r), z = Math.min(n, Math.floor((i + 1) * r)); let s = 0;
    for (let j = a; j < z; j++) s += all[j];
    pcm[i] = Math.max(-1, Math.min(1, s / Math.max(1, z - a))) * 0x7fff;
  }
  const buf = new ArrayBuffer(44 + m * 2), dv = new DataView(buf);
  const w = (p, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(p + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); dv.setUint32(4, 36 + m * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true); dv.setUint32(24, 16000, true);
  dv.setUint32(28, 32000, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); w(36, 'data'); dv.setUint32(40, m * 2, true);
  new Int16Array(buf, 44).set(pcm);
  return new Blob([buf], { type: 'audio/wav' });
}
async function send(bufs, rate) {
  const st = curStep(), sess = S; if (!sess || !st) return;
  sess.pending++; setMic('checking');
  try {
    const fd = new FormData();
    fd.append('file', wav(bufs, rate), 'line.wav'); fd.append('model', 'whisper-large-v3-turbo');
    fd.append('language', 'en'); fd.append('temperature', '0'); fd.append('response_format', 'json'); fd.append('prompt', VOCAB);
    const r = await fetch(GROQ, { method: 'POST', headers: { Authorization: 'Bearer ' + store.key }, body: fd });
    if (!r.ok) {
      toast(r.status === 401 ? 'Groq rejected the key. Check it in Settings on the home screen.'
        : r.status === 429 ? 'Groq’s free limit is busy. Wait a few seconds, then say the line again.'
        : `Groq error ${r.status}. Say the line again.`);
      return;
    }
    const j = await r.json();
    if (S === sess && curStep() === st) said(j.text || '');
  } catch { toast('Couldn’t reach Groq. Check your internet connection.'); }
  finally { sess.pending--; if (S === sess && !S.lock) setMic(ear && ear.on ? 'hearing' : 'idle'); }
}
function recOn() {
  recWant = true; recHold = false;
  if (!rec) {
    rec = new SR(); rec.lang = 'en-NZ'; rec.continuous = true; rec.interimResults = false;
    rec.onresult = e => { for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) said(e.results[i][0].transcript); };
    rec.onend = () => { if (recWant && !recHold) setTimeout(() => { try { rec.start(); } catch {} }, 150); };
    rec.onerror = e => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { recWant = false; setMic('off'); toast('The microphone is blocked. Allow it for this site in Chrome.'); } };
  }
  try { rec.start(); } catch {}
  setMic('idle');
}
function recOff() { recWant = false; try { rec && rec.abort(); } catch {} }

// ---------- Mr Luke and the RN ----------
const clips = {};
function clip(id) { if (!id) return null; if (!clips[id]) { const a = new Audio(`audio/${id}.mp3`); a.preload = 'auto'; clips[id] = a; } return clips[id]; }
function hush() { Object.values(clips).forEach(a => { try { a.pause(); } catch {} }); try { speechSynthesis.cancel(); } catch {} }
function play(st) {
  return new Promise(res => {
    let over = false; const ms = 1500 + st.words.length * 55;
    const fin = () => { if (over) return; over = true; setTimeout(() => { hold(false); res(); }, 450); };
    const robot = () => {
      if (over) return;
      if (!('speechSynthesis' in window)) return setTimeout(fin, ms);
      const u = new SpeechSynthesisUtterance(st.words); u.lang = 'en-NZ'; u.rate = .9; u.onend = fin; u.onerror = fin;
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    };
    hold(true);
    if (!store.opt.voice) return setTimeout(fin, Math.min(ms, 2500));
    setTimeout(fin, ms + 9000);
    const a = clip(st.audio); if (!a) return robot();
    a.currentTime = 0; a.onended = fin; a.onerror = robot;
    a.play().catch(robot);
  });
}

// ---------- session ----------
let S = null, wl = null;
const curStep = () => S && S.parts[S.pi] && S.parts[S.pi].steps[S.i];
const banner = k => ({ kind: 'banner', id: 'banner', audio: 'banner-' + k, n: 0, scene: 'Med admin', title: '', who: 'RN',
  words: `Your drug today: ${k === 'para' ? 'Paracetamol 1 g PO qid' : 'Metoprolol Succinate CR 47.5 mg PO daily'}` });
function forkRounds() {
  const all = [];
  D.forks.forEach(f => ['vs', 'ma'].forEach(side => all.push({ f, side })));
  for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
  return all.slice(0, 10).map(({ f, side }) => {
    const key = side === 'vs' ? 'vs' : pickDrug(), steps = D.scripts[key].steps, [a, b] = f[side];
    const next = steps.find(s => s.n === b);
    return { ...next, fork: { cue: f.cue, key, label: D.scripts[key].label, prev: a ? steps.find(s => s.n === a) : null } };
  });
}
async function start(mode) {
  const parts = [];
  if (mode === 'monday') { const m = maKey(); parts.push({ key: 'vs', steps: D.scripts.vs.steps }); parts.push({ key: m, steps: [banner(m), ...D.scripts[m].steps] }); }
  else if (mode === 'fork') parts.push({ key: 'fork', steps: forkRounds() });
  else {
    const key = store.script === 'vs' ? 'vs' : maKey();
    let steps = D.scripts[key].steps;
    if (mode === 'drill' && store.scene) steps = steps.filter(s => s.scene === store.scene);
    if (key !== 'vs' && store.drug === 'draw' && mode !== 'drill') steps = [banner(key), ...steps];
    parts.push({ key, steps });
  }
  S = { mode, parts, pi: 0, i: 0, t0: Date.now(), log: [], pending: 0, said: '' };
  const sess = S;
  show('sess');
  $('#prev').disabled = mode !== 'learn';
  $('#next').textContent = mode === 'learn' ? 'Next ▶' : 'Skip ▶';
  $('#clock').textContent = ''; $('#heard').textContent = ''; $('#chips').innerHTML = '';
  parts.forEach(p => p.steps.forEach(s => s.audio && clip(s.audio)));
  try { navigator.wakeLock && navigator.wakeLock.request('screen').then(w => wl = w).catch(() => {}); } catch {}
  if (store.opt.mic) await micOn(); else setMic('off');
  if (S === sess) { S.t0 = Date.now(); enter(); }
}
function enter() {
  const st = curStep(); if (!st) return finish(true);
  Object.assign(S, { hinted: 0, ts: Date.now(), last: Date.now(), lock: false, said: '', judge: null });
  $('#heard').textContent = '';
  render();
  if (st.kind === 'partner' || st.kind === 'banner') {
    S.lock = true; const sess = S;
    play(st).then(() => { if (S === sess && curStep() === st) { S.lock = false; advance(); } });
  }
}
function said(text) {
  const st = curStep(); text = (text || '').trim();
  if (!S || !st || !st.groups || S.lock || !text) return;
  S.said = (S.said + ' ' + text).trim(); S.last = Date.now();
  $('#heard').textContent = '“' + S.said.slice(-120) + '”';
  S.judge = judge(st, S.said); chips();
  if (S.judge.pass) done(S.hinted ? 'hint' : 'ok');
}
function done(result) {
  const st = curStep(); if (!st || S.lock) return;
  S.lock = true;
  if (learnable(st)) {
    const key = st.fork ? st.fork.key : S.parts[S.pi].key;
    S.log.push({ id: st.id, n: st.n, title: st.title, scene: st.scene, key, result });
    let v = lv(st);
    if (S.mode === 'learn') { if (result !== 'skip' && v < 1) v = 1; }
    else v = result === 'ok' ? Math.min(4, v + 1) : result === 'hint' ? Math.max(0, v - 1) : Math.max(0, v - 2);
    store.lv[st.id] = v; save();
  }
  try { navigator.vibrate && navigator.vibrate(result === 'ok' ? 25 : [20, 60, 20]); } catch {}
  const stage = $('#stage'), sess = S; stage.classList.add(result === 'skip' ? 'bad' : 'ok');
  setTimeout(() => { stage.classList.remove('ok', 'bad'); if (S === sess) advance(); }, result === 'skip' ? 200 : 700);
}
function advance() {
  S.i++;
  if (S.i >= S.parts[S.pi].steps.length) { S.pi++; S.i = 0; if (S.pi >= S.parts.length) return finish(true); }
  enter();
}
function back() {
  if (!S || S.mode !== 'learn' || S.i === 0) return;
  hush(); hold(false); S.i--; enter();
}
function showLevel(st, isCur) {
  if (S.mode === 'learn') return 0;
  if (isCur && S.hinted) return S.hinted >= 2 ? 0 : (S.mode === 'drill' ? Math.max(0, lv(st) - 2) : 3);
  if (S.mode === 'drill') return lv(st);
  return 4;
}
function render() {
  const st = curStep(), p = S.parts[S.pi];
  $('#sTitle').textContent = S.mode === 'fork' ? 'Fork drill' : D.scripts[p.key].label;
  $('#sScene').textContent = S.mode === 'fork' ? `Round ${S.i + 1} of ${p.steps.length}` : `${st.scene}${st.n ? ' · step ' + st.n + ' of ' + D.scripts[p.key].steps.length : ''}`;
  const total = S.parts.reduce((a, q) => a + q.steps.length, 0), before = S.parts.slice(0, S.pi).reduce((a, q) => a + q.steps.length, 0);
  $('#progFill').style.width = ((before + S.i) / total * 100) + '%';
  const L = showLevel(st, true);
  const long = ((st.words || st.say || '').length > 200 && L < 3) ? ' long' : '';
  const extras = (S.mode === 'learn' || S.hinted >= 2) && learnable(st)
    ? `${st.do ? `<div class="extra">${esc(st.do)}</div>` : ''}${st.mistake ? `<div class="extra mist">⚠ ${esc(st.mistake)}</div>` : ''}` : '';
  const trap = st.trap && (S.mode === 'learn' || S.mode === 'drill') ? `<span class="tag">${esc(st.trap)}</span><br>` : '';
  const curHTML = `<div class="line cur${long}${st.kind === 'partner' ? ' partner' : ''}">${trap}<span class="lab">${label(st)}</span>${body(st, L)}${extras}</div>`;
  let html;
  if (S.mode === 'fork') {
    const f = st.fork;
    html = `<div class="fk"><div class="pr">${esc(f.label)}</div><div class="cueline">${esc(f.cue)}</div>
      <div class="prev"><small>Just done</small>${f.prev ? (f.prev.kind === 'partner' ? `${esc(f.prev.who)}: “${esc(f.prev.words)}”` : esc(f.prev.title)) : 'Nothing yet'}</div>
      <div class="q">What comes next?</div>${curHTML}</div>`;
  } else if (S.mode === 'run' || S.mode === 'monday') {
    html = `<div class="runv"><div class="sc">${esc(st.scene)}</div><div class="big">${st.kind === 'partner' ? esc(st.who) : st.kind === 'banner' ? 'Med admin' : 'Step ' + st.n}</div>${curHTML}</div>`;
  } else {
    const out = [];
    for (let j = Math.max(0, S.i - 2); j <= Math.min(p.steps.length - 1, S.i + 3); j++) {
      if (j === S.i) { out.push(curHTML); continue; }
      const s = p.steps[j];
      out.push(`<div class="line${Math.abs(j - S.i) === 1 ? ' near' : ''}${s.kind === 'partner' ? ' partner' : ''}">${body(s, showLevel(s, false))}</div>`);
    }
    html = out.join('');
  }
  const stage = $('#stage'); stage.innerHTML = html;
  const c = stage.querySelector('.line.cur'); if (c) c.scrollIntoView({ block: 'center' });
  chips();
}
function chips() {
  const st = curStep(), el = $('#chips');
  if (!st || !st.groups) { el.innerHTML = ''; return; }
  const j = S.judge, hit = i => j && j.hits[i];
  const open = S.mode === 'learn' || S.hinted || (S.mode === 'drill' && lv(st) <= 1);
  let h = st.groups.map((g, i) => `<span class="chip${hit(i) ? ' hit' : ''}">${hit(i) || open ? esc(g.label) : '•••'}</span>`).join('');
  if (j && !j.pass) {
    h += `<span class="cov">Not yet · ${Math.round(j.cov * 100)}% of the line</span>`;
    if ((S.mode === 'learn' || S.hinted) && j.missed.length) h += `<div class="missed">Missed: ${esc(j.missed.slice(0, 10).join(', '))}</div>`;
  }
  el.innerHTML = h;
}
function finish(complete) {
  const s = S; S = null; micOff(); hush();
  try { wl && wl.release(); } catch {} wl = null;
  const secs = Math.round((Date.now() - s.t0) / 1000), log = s.log;
  const c = r => log.filter(x => x.result === r).length;
  const runKey = s.mode === 'monday' ? 'monday' : s.mode === 'run' ? (s.parts[0].key === 'vs' ? 'vs' : 'ma') : null;
  let sub = `${log.length} steps`;
  if (runKey && complete) {
    const prev = store.best[runKey];
    sub = `${fmt(secs)}${prev ? ` · best ${fmt(prev)}` : ''}`;
    if (!c('skip') && (!prev || secs < prev)) { store.best[runKey] = secs; save(); sub += ' · new best'; }
  }
  const names = { learn: 'Learn', drill: 'Drill', run: 'Run', fork: 'Fork drill', monday: 'Monday run' };
  $('#rTitle').textContent = `${names[s.mode]} ${complete ? 'done' : 'ended early'}`;
  $('#rSub').textContent = sub;
  $('#rTiles').innerHTML = `<div><b>${c('ok')}</b><small>clean</small></div><div><b>${c('hint')}</b><small>needed a hint</small></div><div><b>${c('skip')}</b><small>skipped</small></div>`;
  const misses = log.filter(x => x.result !== 'ok');
  $('#rMiss').innerHTML = misses.map(x => `<li class="${x.result}"><small>${esc(D.scripts[x.key].label)} · ${esc(x.scene)} · step ${x.n}</small>${esc(x.title)}</li>`).join('')
    || '<li style="border-left-color:var(--ok)">Nothing missed. Move up a level: try a Run, or a Monday run.</li>';
  const tally = {}; misses.forEach(x => { const k = x.key + '|' + x.scene; tally[k] = (tally[k] || 0) + 1; });
  const worst = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
  $('#rRow').innerHTML = (worst ? `<button type="button" class="pri" id="rFix">Drill “${esc(worst[0].split('|')[1])}”</button>` : '') +
    `<button type="button" id="rAgain"${worst ? '' : ' class="pri"'}>Again</button><button type="button" id="rHome">Home</button>`;
  if (worst) $('#rFix').onclick = () => { const [k, sc] = worst[0].split('|'); store.script = k === 'vs' ? 'vs' : 'ma'; if (k !== 'vs') store.drug = k; store.scene = sc; save(); start('drill'); };
  $('#rAgain').onclick = () => start(s.mode);
  $('#rHome').onclick = () => { show('home'); home(); };
  show('report');
}
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 6000); }
function show(id) { ['home', 'sess', 'report'].forEach(x => $('#' + x).hidden = x !== id); window.scrollTo(0, 0); }

// stall → hint, and the run clock
setInterval(() => {
  if (!S) return;
  if (S.mode === 'run' || S.mode === 'monday') $('#clock').textContent = fmt(Math.round((Date.now() - S.t0) / 1000));
  const st = curStep();
  if (!st || !st.groups || S.lock || S.mode === 'learn' || mstate === 'off') return;
  if ((ear && ear.on) || S.pending) { S.last = Date.now(); return; }
  const lim = S.mode === 'run' || S.mode === 'monday' ? 10000 : 8000;
  if (S.hinted < 2 && Date.now() - S.last > lim) { S.hinted++; S.last = Date.now(); render(); }
}, 500);

// ---------- home ----------
function home() {
  document.querySelectorAll('#pickScript button').forEach(b => b.classList.toggle('on', b.dataset.s === store.script));
  document.querySelectorAll('#pickDrug button').forEach(b => b.classList.toggle('on', b.dataset.d === store.drug));
  $('#pickDrug').hidden = store.script !== 'ma';
  const keys = homeKeys();
  $('#mastery').innerHTML = keys.map(k => {
    const steps = D.scripts[k].steps.filter(learnable), tot = steps.reduce((a, s) => a + lv(s), 0);
    return `<div class="mrow"><div class="mh"><span>${esc(D.scripts[k].label)} · ${steps.length} steps</span><b>${Math.round(100 * tot / (4 * steps.length))}% faded</b></div>
      <div class="cells">${steps.map(s => `<i class="l${lv(s)}" title="${esc(s.n + '. ' + s.title + ' (level ' + lv(s) + ')')}"></i>`).join('')}</div></div>`;
  }).join('') + `<div class="best">Best runs · Vital signs ${store.best.vs ? fmt(store.best.vs) : '—'} · Med admin ${store.best.ma ? fmt(store.best.ma) : '—'} · Monday ${store.best.monday ? fmt(store.best.monday) : '—'}</div>`;
  const scenes = [...new Set(D.scripts[keys[0]].steps.map(s => s.scene))];
  if (!scenes.includes(store.scene)) store.scene = '';
  $('#scene').innerHTML = `<option value="">Whole practical</option>` + scenes.map(s => `<option${s === store.scene ? ' selected' : ''}>${esc(s)}</option>`).join('');
  $('#optVoice').checked = store.opt.voice; $('#optMic').checked = store.opt.mic;
  $('#optKey').value = store.key; $('#optPause').value = String(store.opt.pause); $('#optNeed').value = store.opt.need;
  const e = engine();
  $('#engineNote').innerHTML = e === 'groq' ? 'Using Groq. No beeps; it checks each line after you pause.'
    : `${e === 'chrome' ? 'No Groq key yet, so it’s using Chrome’s built-in recognition, which beeps and mishears medical words.' : 'This browser has no speech recognition.'} Get a free key at <a href="https://console.groq.com/keys" target="_blank" rel="noopener">console.groq.com/keys</a> and paste it above.`;
}
$('#pickScript').onclick = e => { const b = e.target.closest('button'); if (!b) return; store.script = b.dataset.s; store.scene = ''; save(); home(); };
$('#pickDrug').onclick = e => { const b = e.target.closest('button'); if (!b) return; store.drug = b.dataset.d; save(); home(); };
$('#scene').onchange = e => { store.scene = e.target.value; save(); };
document.querySelectorAll('.mode').forEach(b => b.onclick = () => start(b.dataset.m));
$('#optVoice').onchange = e => { store.opt.voice = e.target.checked; save(); };
$('#optMic').onchange = e => { store.opt.mic = e.target.checked; save(); };
$('#optKey').onchange = e => { store.key = e.target.value.trim(); save(); home(); };
$('#optPause').onchange = e => { store.opt.pause = +e.target.value; save(); };
$('#optNeed').onchange = e => { store.opt.need = e.target.value; save(); };
let armed = false;
$('#reset').onclick = e => {
  if (!armed) { armed = true; e.target.textContent = 'Tap again to wipe all progress'; setTimeout(() => { armed = false; e.target.textContent = 'Reset progress'; }, 4000); return; }
  store.lv = {}; store.best = {}; save(); armed = false; e.target.textContent = 'Progress wiped'; home();
};

// ---------- session controls ----------
$('#quit').onclick = () => { if (S) finish(false); };
$('#next').onclick = () => { if (S && curStep() && !S.lock) done(S.mode === 'learn' ? 'ok' : 'skip'); };
$('#prev').onclick = back;
$('#hint').onclick = () => { if (!S || S.lock) return; S.hinted = Math.min(2, S.hinted + 1); render(); };
$('#mic').onclick = () => { if (!S) return; if (mstate === 'off') micOn(); else micOff(); };
$('#stage').onclick = () => { if (S && mstate === 'off' && !S.lock && curStep() && curStep().groups) done(S.hinted ? 'hint' : 'ok'); };
document.addEventListener('visibilitychange', () => {
  if (S && document.visibilityState === 'visible' && navigator.wakeLock) navigator.wakeLock.request('screen').then(w => wl = w).catch(() => {});
});
// test hooks: __say feeds one finished utterance; __wav builds the upload body
window.__say = t => said(t);
window.__wav = (bufs, rate) => wav(bufs, rate);
home();
})();
