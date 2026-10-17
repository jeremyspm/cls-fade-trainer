// Builds index.html from the CLS reference doc + the keyword gates below.
// Usage: node build.mjs ["path/to/01 CLS-reference.md"]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = process.argv[2] || 'C:/Users/USER/Desktop/CLS practicals for ChatGPT/01 CLS-reference.md';
const md = fs.readFileSync(SRC, 'utf8').replace(/\r/g, '');

// ---------- parse the model runs ----------
function section(startRe) {
  const out = []; let on = false;
  for (const l of md.split('\n')) {
    if (on && /^### /.test(l)) break;
    if (on) out.push(l);
    if (startRe.test(l)) on = true;
  }
  if (!out.length) throw new Error('Section not found: ' + startRe);
  return out;
}

function parse(lines) {
  const steps = []; let scene = '', cur = null, m;
  for (const raw of lines) {
    const l = raw.replace(/\s+$/, '');
    if ((m = l.match(/^#### (.+)/))) { scene = m[1].trim(); continue; }
    if ((m = l.match(/^(\d+)\. \*(Mr Luke|The RN) says:\*\s*"(.+)"$/))) {
      cur = null;
      steps.push({ n: +m[1], kind: 'partner', who: m[2] === 'The RN' ? 'RN' : 'Mr Luke', words: m[3], scene });
      continue;
    }
    if ((m = l.match(/^(\d+)\. \*\*(.+?)\*\*$/))) {
      cur = { n: +m[1], kind: 'say', title: m[2], scene, do: '', words: '', to: '', mistake: '' };
      steps.push(cur); continue;
    }
    if (!cur) continue;
    const t = l.trim();
    if ((m = t.match(/^What to do:\s*(.*)/))) cur.do = m[1];
    else if ((m = t.match(/^Model words(?: \(to (.+?)\))?:\s*"(.*)"$/))) { cur.words = m[2]; cur.to = m[1] || ''; }
    else if ((m = t.match(/^Common mistake:\s*(.*)/))) cur.mistake = m[1];
  }
  return steps;
}

// ---------- keyword gates ----------
// ' / ' separates required groups; '|' separates accepted variants (regex, case-insensitive).
// The FIRST variant of each group is its on-screen label, so keep it a clean phrase.
const ANYHAND = 'sanitising|sanitis|sanitiz|hand|wash';
const PRECEPTOR = 'preceptor|receptor|perceptor|precept';
const NHI = 'NHI|n h i|2963|dgy|d g y';
const G = {
  vs: {
    1: `chart / Luke / date of birth|birth / ${NHI} / wristband|wrist band|\\bband`,
    2: `temperature|temp / pulse / respiratory|respirat|breathing / won’t tell|won.?t tell|not tell|without telling|let him know / blood pressure|\\bbp\\b / report`,
    3: 'working order|working / larger|bigger|large / medium',
    4: ANYHAND,
    5: 'morning|hello|kia ora|\\bhi\\b|afternoon / how are you',
    7: `my name|name.?s|name is / student / MIT|\\bmit\\b|m i t|em i t / ${PRECEPTOR}`,
    8: 'full name / date of birth|birth / tell me',
    10: `wristband|wrist band|\\bband / 1942|forty.?two / ${NHI} / matches|match`,
    11: 'call you|be called|prefer',
    13: 'ear|\\bears?\\b / wrist / arm|\\barm\\b / twice|two times|2 times / questions|question',
    14: 'happy|okay|\\bok\\b|alright|all right / go ahead|do that|proceed|start',
    16: 'curtain|privacy / brakes|brake / comfortably|comfortable|comfy|feet flat',
    17: 'probe cover|cover|probe / up and back|back',
    18: 'charting|chart|document|record|plot / temperature|temp',
    19: 'radial|pulse / 30|thirty / doubling|doubl|times two|times 2',
    20: 'done|finished|next',
    21: 'heart rate|pulse|\\bhr\\b / resp|breath|\\brr\\b',
    22: 'sleeve|bare / heart level|heart / palm',
    23: 'size|measure / cuff',
    24: 'brachial|bracial|brachia|brake ial / straight',
    25: 'marker|artery|brachial / 2 to 3|two to three|2-3|centimet|\\bcm\\b / fingers|finger',
    26: 'pump / first / estimate',
    27: 'systolic / approximate|estimate|about',
    28: 'deflating|deflat|let it down|all the air|air out|let.*down / 30|thirty / waiting|wait',
    29: 'stethoscope|steth / brachial|artery / before',
    30: 'pump / 30|thirty / above|more',
    31: '2 to 3|two to three|2-3|millimet|\\bmm\\b|per second|a second / first / disappears|disappear|last sound|stop|gone',
    32: 'over|\\bover\\b / normal / usually|usual',
    33: 'arrow / systolic / diastolic',
    34: `preceptor|${PRECEPTOR} / results|result / okay|\\bok\\b|alright|all right`,
    36: '24-hour|24.?hour|twenty.?four / 36.5|36 point 5|thirty.?six point five / 37.5|37 point 5|thirty.?seven point five / 60 to 100|60-100|sixty to (a )?hundred / 12 to 20|12-20|twelve to twenty / 110 to 140|110-140|one ten to one forty / 60 to 90|60-90|sixty to ninety / 30 seconds|thirty seconds|doubled',
    38: 'recheck|re-check|re check|check it again / report / straight away|right away|immediately',
    39: 'concludes|conclude|finished|all done / half an hour|30 minutes|thirty minutes|come back',
    40: 'call bell|bell / sitting|bed / water',
    41: 'thank',
    42: 'wiping|wipe|wip|clean / cuff|stethoscope|thermometer',
    43: ANYHAND,
    44: 'date / 24-hour|24.?hour|twenty.?four|time / plotted|plot|value|pen',
  },
  ma: {
    1: 'wash|sanitis|sanitiz|hand',
    2: `Luke / ${NHI} / date of birth|birth|1942 / sticker|label / by hand|hand.?written|written`,
    3: 'Allergies|allerg / adverse|reaction / signed|dated / bedside|still check|check with him',
    4: 'special care / supplementary',
    10: 'expires|expir / end of / in date|indate|in-date',
    11: 'not touching|don.?t touch|without touching|touching / cup / water',
    12: `Knock|knock / ${ANYHAND}`,
    14: 'full name / date of birth|birth / wristband|wrist band|\\bband',
    16: 'allergic|allerg / reaction',
    18: 'heard of / know about|what do you know',
    23: 'happy / questions|question',
    26: 'same time / repeat|refill / week',
    27: 'call bell|bell / get up|ring / Thank|thank',
    28: ANYHAND,
    31: 'ASKED|asked|ask / BUILT|built|build / CHECKED|checked|check / own words',
    32: 'Thank|thank',
  },
  para: {
    5: 'regular / dated|signed / Paracetamol|paracetamol|para / 1 g|1g|1 gram|one gram|1000 / \\bPO\\b|p o|by mouth|oral / qid|q i d|four times|4 times',
    6: 'four times|4 times|qid|q i d / last dose / due',
    8: 'analgesic / backache|back pain|back / very rare|rare|none / liver / 4 hours|four hours / 4 grams|4 g|4g|four grams',
    9: 'label / 500 / two|2 tablets|\\b2\\b',
    13: `morning|hello|kia ora|\\bhi\\b / student / ${PRECEPTOR} / paracetamol|para / new medicine|new`,
    20: 'backache|back pain|back / side effects|side effect / rash / swelling|swell / trouble breathing|breathing|breath / bell / liver',
    21: 'own words / rash|unwell',
    25: 'Sitting|sit|upright / water / swallow',
    29: 'date / 24-hour|24.?hour|twenty.?four|time / 1 g|1g|1 gram|one gram|unit / initials|initial',
  },
  meto: {
    5: 'regular / dated|signed / Metoprolol|metoprolol|metropolol|meto|metro / Succinate|succinate|succ|suck|sux / 47.5 mg|47.5|47 point 5|forty.?seven point five / \\bPO\\b|p o|by mouth|oral / daily|once a day',
    6: 'once daily|once a day|daily / last dose / due',
    8: 'beta|blocker / blood pressure|hypertension / heart failure / fatigue|tired / bradycardia|slow heart / postural|posture|standing / cold hands|cold / palpitations|palpitation / dizziness|dizz / headache / nausea|nauseous / abdominal pain|abdominal|tummy|stomach / diarrhoea|diarr / constipation|constipat / dyspnoea|dyspn|disp|short of breath|breathless / pulse|heart rate / falls risk|falls|fall',
    9: 'label / 47.5|47 point 5|forty.?seven point five / one|1 tablet|\\b1\\b|CR|controlled',
    13: `morning|hello|kia ora|\\bhi\\b / student / ${PRECEPTOR} / metoprolol|metropolol|meto|metro / new medicine|new`,
    20: 'blood pressure / heart / tired|fatigue / slow heartbeat|slow / pounding / dizzy|light.?headed / stand up|stand / cold hands|cold / headaches|headache / feeling sick|sick|nause / tummy pain|tummy|stomach|abdominal / diarrhoea|diarr / constipation|constipat / short of breath|breath / bell',
    21: 'own words / dizzy',
    25: 'Sitting|sit|upright / water / whole|crush|chew',
    29: 'date / 24-hour|24.?hour|twenty.?four|time / 47.5 mg|47.5|mg|milligram|unit / initials|initial',
  },
};

// What to say out loud for steps that are actions with no model words.
const CALL = {
  vs: {
    4: 'I’m sanitising my hands.',
    16: 'Curtain for privacy, brakes on, and you’re sitting comfortably with your feet flat.',
    17: 'New probe cover on, gently pulling the top of the ear up and back.',
    18: 'Charting the temperature now with an X, date and 24-hour time at the top.',
    19: 'Radial pulse, counting for 30 seconds and doubling it.',
    20: 'Count his breaths silently for 30 seconds × 2, fingers still on his wrist. Say “done” when you finish.',
    21: 'Charting the heart rate with an X, and the resp rate number in its box.',
    22: 'Sleeve up, arm supported at heart level, palm up.',
    25: 'Cuff fully deflated, marker over the brachial artery, 2 to 3 cm above the elbow crease, two fingers fit under.',
    28: 'Deflating fully, and waiting 30 seconds before step 2.',
    29: 'Stethoscope on the brachial artery first, before I pump.',
    31: 'Releasing 2 to 3 mm a second, listening for the first tap, then where it disappears.',
    33: 'Charting the BP: arrow up on the systolic, arrow down on the diastolic, dotted line between.',
    42: 'Wiping the cuff, stethoscope and thermometer, and putting them back.',
    43: 'I’m sanitising my hands.',
    44: 'Chart check: date, 24-hour time, every value plotted, black pen.',
  },
  ma: {
    12: 'Knock knock. I’m sanitising my hands on the way in.',
    28: 'I’m sanitising my hands on the way out.',
  },
  para: {
    25: 'Sitting you up. Here’s your water, and I’ll stay while you swallow it.',
    29: 'Signing now he’s taken it: date, 24-hour time, 1 g with the unit, my initials in Giv, yours in Chck.',
  },
  meto: {
    25: 'Sitting you up. Swallow it whole with the water, don’t crush or chew it. I’ll stay while you swallow it.',
    29: 'Signing now he’s taken it: date, 24-hour time, 47.5 mg with the unit, my initials in Giv, yours in Chck.',
  },
};
const SILENT = { vs: { 20: true } };
const TRAP = {
  vs: { 10: 'NHI is the one people forget', 13: 'Say ear AND arm', 29: 'You were pulled up on this', 36: 'Ranges for ALL of them' },
  ma: { 8: 'ALL the common AEs', 10: 'Read it AND interpret it', 16: 'Chart AND verbal', 29: 'Unit on the dose' },
};

// Where the two practicals split. [step just done, step that comes next]
const FORKS = [
  { cue: 'The practical starts. You’re at the chart with your preceptor.', vs: [0, 1], ma: [0, 1] },
  { cue: 'You’re at the bedside. Your first words to Mr Luke.', vs: [4, 5], ma: [12, 13] },
  { cue: 'Mr Luke has just told you his name and date of birth.', vs: [9, 10], ma: [15, 16] },
  { cue: 'You’ve just finished explaining to Mr Luke.', vs: [13, 14], ma: [20, 21] },
  { cue: 'The RN asks you a question.', vs: [37, 38], ma: [30, 31] },
  { cue: 'You’ve just sanitised your hands near the end.', vs: [43, 44], ma: [28, 29] },
];

// ---------- assemble ----------
const raw = {
  vs: parse(section(/^### Model run, step by step \(order and words/)),
  para: parse(section(/^### Model run, step by step: paracetamol/)),
  meto: parse(section(/^### Model run, step by step: metoprolol/)),
};
const LABEL = { vs: 'Vital signs', para: 'Med admin · Paracetamol', meto: 'Med admin · Metoprolol' };
const problems = [];

for (const key of ['vs', 'para', 'meto']) {
  const fam = key === 'vs' ? 'vs' : 'ma';
  for (const st of raw[key]) {
    const other = key === 'para' ? raw.meto : key === 'meto' ? raw.para : null;
    const twin = other && other.find(o => o.n === st.n);
    const shared = twin && ['words', 'title', 'do', 'who'].every(f => (twin[f] || '') === (st[f] || ''));
    st.id = shared ? `ma-${st.n}` : `${key}-${st.n}`;
    if (st.kind === 'partner') continue;
    const g = (G[key] && G[key][st.n]) || (G[fam] && G[fam][st.n]);
    if (!g) problems.push(`${key} ${st.n} "${st.title}" has no gate`);
    else st.g = g.split(' / ').map(s => s.trim());
    if (!st.words) {
      st.say = (CALL[key] && CALL[key][st.n]) || (CALL[fam] && CALL[fam][st.n]) || '';
      st.kind = SILENT[fam] && SILENT[fam][st.n] ? 'silent' : 'act';
      if (!st.say) problems.push(`${key} ${st.n} "${st.title}" is an action with no callout`);
    }
    const trap = TRAP[fam] && TRAP[fam][st.n];
    if (trap) st.trap = trap;
  }
}
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }

const data = {
  scripts: Object.fromEntries(Object.entries(raw).map(([k, steps]) => [k, { label: LABEL[k], steps }])),
  forks: FORKS,
};
const json = JSON.stringify(data).replace(/</g, '\\u003c');
const tpl = fs.readFileSync(path.join(here, 'template.html'), 'utf8');
if (!tpl.includes('/*DATA*/null')) throw new Error('template is missing the /*DATA*/null placeholder');
fs.writeFileSync(path.join(here, 'index.html'), tpl.replace('/*DATA*/null', () => json));
for (const k of Object.keys(raw)) console.log(`${k}: ${raw[k].length} steps (${raw[k].filter(s => s.kind === 'partner').length} partner lines)`);
console.log('wrote index.html', Math.round(json.length / 1024) + 'KB data');
