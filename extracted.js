
const ANTHROPIC_API_KEY = '';
const WAKE_HOUR = 6;
const SLEEP_HOUR = 21;

// Tab Switching & Initialization
document.addEventListener('DOMContentLoaded', () => {
  const tabs = document.querySelectorAll('.dash-tab');
  const views = document.querySelectorAll('.dash-view');
  
  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const targetView = document.getElementById(targetId);
      
      if (targetView) {
        tabs.forEach(b => b.classList.remove('active'));
        views.forEach(v => v.classList.remove('active'));
        
        btn.classList.add('active');
        targetView.classList.add('active');
      }
    });
  });

  initGymTracker();
});


function storeGet(key) { return JSON.parse(localStorage.getItem(key)); }
function storeSet(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function storeDelete(key) { localStorage.removeItem(key); }
function storeListKeys(prefix) {
  let keys = [];
  for(let i=0; i<localStorage.length; i++) {
    let k = localStorage.key(i);
    if(k.startsWith(prefix)) keys.push(k);
  }
  return keys;
}

function getActiveDateString() {
  let now = new Date();
  if (now.getHours() < 6) now.setDate(now.getDate() - 1);
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}
function getTomorrowDateString() {
  let now = new Date();
  if (now.getHours() >= 6) now.setDate(now.getDate() + 1);
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}
function formatDate(yyyy_mm_dd) {
  let d = new Date(yyyy_mm_dd + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

const todayKey = 'goals:' + getActiveDateString();
const tomorrowKey = 'goals:' + getTomorrowDateString();

function runRollover() {
  let activeDate = getActiveDateString();
  let keys = storeListKeys('goals:');
  let todayGoals = storeGet(todayKey) || [];
  let changed = false;
  
  keys.forEach(key => {
    let dateStr = key.replace('goals:', '');
    if (dateStr < activeDate) {
      let oldGoals = storeGet(key) || [];
      oldGoals.forEach(g => {
        if (!g.done && !todayGoals.find(t => t.text === g.text)) {
          todayGoals.push({ text: g.text, done: false, queued: g.queued });
          changed = true;
        }
      });
      storeDelete(key);
    }
  });
  if(changed) storeSet(todayKey, todayGoals);
}

function checkStreak() {
  let streakData = storeGet('goal_streak_v1') || { count: 0, lastProcessedDate: '' };
  let activeDate = getActiveDateString();
  let keys = storeListKeys('goals:').map(k => k.replace('goals:', '')).filter(d => d < activeDate).sort();
  
  keys.forEach(d => {
    if (d > streakData.lastProcessedDate) {
      let g = storeGet('goals:' + d) || [];
      if (g.length > 0) {
        if (g.every(x => x.done)) streakData.count++;
        else streakData.count = 0;
      }
      streakData.lastProcessedDate = d;
    }
  });
  storeSet('goal_streak_v1', streakData);
}

document.getElementById('todayLabel').textContent = `Today — ${formatDate(getActiveDateString())}`;
document.getElementById('tomorrowLabel').textContent = `Plan tomorrow — ${formatDate(getTomorrowDateString())}`;

let expandToday = false;
let expandTomorrow = false;

function buildGoalRow(g, idx, listEl, key, isReadOnly, goals, reloadFunc, isTomorrowList) {
  let li = document.createElement('li');
  li.className = `goal-row ${g.done ? 'is-done' : ''} ${g.queued ? 'is-queued' : ''}`;
  li.draggable = true;
  
  let drag = document.createElement('div');
  drag.className = 'goal-drag';
  drag.textContent = '⋮⋮';
  
  let cbWrap = document.createElement('div');
  cbWrap.className = `goal-cb-wrap ${g.done ? 'checked' : ''} ${isReadOnly ? 'disabled' : ''}`;
  if(isReadOnly) cbWrap.title = 'Activates at 6 AM tomorrow';
  
  let cbInput = document.createElement('input');
  cbInput.type = 'checkbox';
  cbInput.className = 'goal-cb-input';
  cbInput.checked = !!g.done;
  if(isReadOnly) cbInput.disabled = true;
  
  cbWrap.appendChild(cbInput);
  
  cbInput.addEventListener('change', (e) => {
    goals[idx].done = e.target.checked;
    if(e.target.checked) goals[idx].doneAt = Date.now();
    else delete goals[idx].doneAt;
    storeSet(key, goals);
    window.dispatchEvent(new CustomEvent('goals-changed'));
    reloadFunc();
  });

  let textDiv = document.createElement('div');
  textDiv.className = 'goal-text';
  textDiv.textContent = g.text;
  textDiv.addEventListener('click', (e) => {
    if(isReadOnly && !g.done) return; 
    textDiv.contentEditable = "true";
    textDiv.focus();
    let sel = window.getSelection();
    sel.selectAllChildren(textDiv);
    sel.collapseToEnd();
  });
  
  let commitEdit = () => {
    textDiv.contentEditable = "false";
    let newText = textDiv.textContent.trim();
    if(newText && newText !== g.text) {
      goals[idx].text = newText;
      storeSet(key, goals);
      window.dispatchEvent(new CustomEvent('goals-changed'));
    } else {
      textDiv.textContent = g.text;
    }
    reloadFunc();
  };
  textDiv.addEventListener('blur', commitEdit);
  textDiv.addEventListener('keydown', (e) => {
    if(e.key === 'Enter') { e.preventDefault(); textDiv.blur(); }
    if(e.key === 'Escape') { 
      textDiv.textContent = g.text; 
      textDiv.contentEditable = "false"; 
      textDiv.blur(); 
    }
  });

  let qBtn = document.createElement('button');
  qBtn.className = `gm-queue-btn ${g.queued ? 'is-active' : ''}`;
  qBtn.textContent = '⚡';
  if(isReadOnly) qBtn.disabled = true;
  qBtn.addEventListener('click', () => {
    goals[idx].queued = !goals[idx].queued;
    storeSet(key, goals);
    li.classList.add('gm-queue-flash');
    setTimeout(() => reloadFunc(), 480);
  });

  let delBtn = document.createElement('button');
  delBtn.className = 'goal-delete';
  delBtn.innerHTML = '×';
  delBtn.addEventListener('click', () => {
    goals.splice(idx, 1);
    storeSet(key, goals);
    window.dispatchEvent(new CustomEvent('goals-changed'));
    reloadFunc();
  });

  li.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', idx);
    e.dataTransfer.effectAllowed = 'move';
  });
  li.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    li.classList.add('drag-over');
  });
  li.addEventListener('dragleave', () => li.classList.remove('drag-over'));
  li.addEventListener('drop', (e) => {
    e.preventDefault();
    li.classList.remove('drag-over');
    let fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
    if(fromIdx === idx) return;
    let item = goals.splice(fromIdx, 1)[0];
    goals.splice(idx, 0, item);
    storeSet(key, goals);
    window.dispatchEvent(new CustomEvent('goals-changed'));
    reloadFunc();
  });

  li.appendChild(drag);
  li.appendChild(cbWrap);
  li.appendChild(textDiv);
  li.appendChild(qBtn);
  li.appendChild(delBtn);
  return li;
}

function renderListInto(goals, listEl, emptyEl, key, isReadOnly, reloadFunc, isTomorrowList) {
  listEl.innerHTML = '';
  if(goals.length === 0) {
    emptyEl.style.display = 'block';
    if(!isTomorrowList) renderTodayHeader(goals);
    else renderTomorrowCount(goals);
    return;
  }
  emptyEl.style.display = 'none';

  let expanded = isTomorrowList ? expandTomorrow : expandToday;
  let showCount = expanded ? goals.length : Math.min(goals.length, 5);
  
  for(let i=0; i<showCount; i++) {
    listEl.appendChild(buildGoalRow(goals[i], i, listEl, key, isReadOnly, goals, reloadFunc, isTomorrowList));
  }
  
  if(goals.length > 5) {
    let showMore = document.createElement('div');
    showMore.className = 'show-more-row';
    showMore.textContent = expanded ? 'Show less ▴' : `Show ${goals.length - 5} more ▾`;
    showMore.addEventListener('click', () => {
      if(isTomorrowList) expandTomorrow = !expandTomorrow;
      else expandToday = !expandToday;
      reloadFunc();
    });
    listEl.appendChild(showMore);
  }

  if(!isTomorrowList) renderTodayHeader(goals);
  else renderTomorrowCount(goals);
}

function renderTodayHeader(goals) {
  let doneCount = goals.filter(g => g.done).length;
  let total = goals.length;
  
  document.getElementById('gmProgressNum').textContent = doneCount;
  document.getElementById('gmProgressTotal').textContent = '/ ' + total;
  
  let label = document.getElementById('gmProgressLabel');
  let card = document.getElementById('cardToday');
  
  if(total === 0) {
    label.textContent = 'no goals yet';
    card.classList.remove('gm-all-done');
  } else if(doneCount === total) {
    label.textContent = 'all done — solid day';
    card.classList.add('gm-all-done');
  } else {
    label.textContent = 'complete';
    card.classList.remove('gm-all-done');
  }

  let bar = document.getElementById('gmBar');
  bar.innerHTML = '';
  goals.forEach(g => {
    let seg = document.createElement('div');
    seg.className = `gm-bar-seg ${g.done ? 'gm-bar-seg-done' : ''}`;
    bar.appendChild(seg);
  });

  let pushBtn = document.getElementById('gmPushBtn');
  if(total > 0 && doneCount < total) {
    pushBtn.style.display = 'block';
  } else {
    pushBtn.style.display = 'none';
  }
}

function renderTomorrowCount(goals) {
  document.getElementById('gmTomorrowCount').textContent = `${goals.length} planned`;
}

function renderStreak() {
  let streakData = storeGet('goal_streak_v1') || { count: 0 };
  document.getElementById('gmStreakNum').textContent = streakData.count;
  let sEl = document.getElementById('gmStreak');
  if(streakData.count > 0) sEl.classList.add('gm-streak-active');
  else sEl.classList.remove('gm-streak-active');
}

function loadToday() {
  let goals = storeGet(todayKey) || [];
  renderListInto(goals, document.getElementById('goalList'), document.getElementById('emptyState'), todayKey, false, loadToday, false);
}

function loadTomorrow() {
  let goals = storeGet(tomorrowKey) || [];
  renderListInto(goals, document.getElementById('tomorrowList'), document.getElementById('tomorrowEmpty'), tomorrowKey, true, loadTomorrow, true);
}

document.getElementById('gmPushBtn').addEventListener('click', () => {
  if(!confirm("Push unfinished goals to tomorrow?")) return;
  let today = storeGet(todayKey) || [];
  let tom = storeGet(tomorrowKey) || [];
  
  let remaining = today.filter(g => !g.done);
  let done = today.filter(g => g.done);
  
  remaining.forEach(r => {
    if(!tom.find(t => t.text === r.text)) {
      tom.push({ text: r.text, done: false, queued: r.queued });
    }
  });
  
  storeSet(todayKey, done);
  storeSet(tomorrowKey, tom);
  window.dispatchEvent(new CustomEvent('goals-changed'));
  loadToday();
  loadTomorrow();
});

function makeAddHandlers(input, addBtn, polishBtn, key, statusEl, reload) {
  let add = () => {
    let text = input.value.trim();
    if(!text) return;
    let goals = storeGet(key) || [];
    goals.push({ text, done: false });
    storeSet(key, goals);
    input.value = '';
    window.dispatchEvent(new CustomEvent('goals-changed'));
    reload();
  };
  
  addBtn.addEventListener('click', add);
  input.addEventListener('keydown', (e) => { if(e.key === 'Enter') add(); });
  
  polishBtn.addEventListener('click', async () => {
    let text = input.value.trim();
    if(!text) return;
    
    if(!ANTHROPIC_API_KEY) {
      statusEl.textContent = 'Polish needs an Anthropic API key — added as-typed.';
      statusEl.style.color = 'var(--text-tertiary)';
      setTimeout(() => statusEl.textContent = '', 3500);
      add();
      return;
    }
    
    statusEl.textContent = 'Polishing...';
    statusEl.style.color = 'var(--text-secondary)';
    
    try {
      let res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: `Clean up this goal text to be actionable and concise. Return ONLY a single-element JSON array of strings, no preamble, no markdown fences: "${text}"`
          }]
        })
      });
      let data = await res.json();
      let out = data.content[0].text.trim();
      let arr = JSON.parse(out);
      let polishedText = arr[0];
      
      let goals = storeGet(key) || [];
      goals.push({ text: polishedText, done: false });
      storeSet(key, goals);
      input.value = '';
      statusEl.textContent = '';
      window.dispatchEvent(new CustomEvent('goals-changed'));
      reload();
    } catch(err) {
      statusEl.textContent = 'Polish failed — added as-typed.';
      statusEl.style.color = 'var(--danger)';
      setTimeout(() => statusEl.textContent = '', 3500);
      add();
    }
  });
}

makeAddHandlers(document.getElementById('goalInput'), document.getElementById('goalAddBtn'), document.getElementById('goalPolishBtn'), todayKey, document.getElementById('polishStatus'), loadToday);
makeAddHandlers(document.getElementById('tomorrowInput'), document.getElementById('tomorrowAddBtn'), document.getElementById('tomorrowPolishBtn'), tomorrowKey, document.getElementById('tomorrowStatus'), loadTomorrow);


// Ticker Logic
let tickerItems = [];
let tickerCycleIdx = 0;
let tickerInterval;

function updateTickerItems() {
  let goals = storeGet(todayKey) || [];
  tickerItems = [];
  
  if(goals.length === 0) {
    tickerItems.push({ status: 'empty', text: 'No goals set for today — add one to get rolling.' });
  } else {
    let pending = goals.filter(g => !g.done);
    if(pending.length === 0) {
      tickerItems.push({ status: 'done', text: '✓ All goals done — solid day.' });
    } else {
      pending.forEach(g => tickerItems.push({ status: 'pending', text: g.text }));
    }
  }
  
  let doneCount = goals.filter(g => g.done).length;
  document.getElementById('goalTickerMeta').textContent = `${doneCount}/${goals.length}`;
}

function tickTicker(forceReset = false) {
  if(forceReset) tickerCycleIdx = 0;
  
  let stage = document.getElementById('goalTickerStage');
  let currentRows = stage.querySelectorAll('.goal-ticker-row');
  
  currentRows.forEach(r => {
    if(!r.classList.contains('is-leaving')) {
      r.classList.add('is-leaving');
      setTimeout(() => r.remove(), 460);
    }
  });
  
  let item = tickerItems[tickerCycleIdx];
  let nextRow = document.createElement('div');
  nextRow.className = 'goal-ticker-row';
  if(currentRows.length > 0) nextRow.classList.add('is-entering');
  
  let st = document.createElement('span');
  st.className = 'goal-ticker-status';
  st.dataset.status = item.status;
  if(item.status === 'done') st.textContent = '✓';
  else if(item.status === 'pending') st.textContent = '○';
  else st.textContent = '·';
  
  let txt = document.createElement('span');
  txt.className = 'goal-ticker-text';
  txt.textContent = item.text;
  
  nextRow.appendChild(st);
  nextRow.appendChild(txt);
  stage.appendChild(nextRow);
  
  tickerCycleIdx = (tickerCycleIdx + 1) % tickerItems.length;
}

window.addEventListener('goals-changed', () => {
  updateTickerItems();
  tickTicker(true);
  clearInterval(tickerInterval);
  tickerInterval = setInterval(() => tickTicker(), 5000);
});

// Day Ring Logic
const sunsetStops = [
  {p: 0, c: [255, 216, 158]},
  {p: 12.5, c: [255, 205, 121]},
  {p: 25, c: [255, 227, 143]},
  {p: 37.5, c: [255, 183, 106]},
  {p: 50, c: [255, 149, 89]},
  {p: 62.5, c: [243, 111, 79]},
  {p: 75, c: [226, 93, 122]},
  {p: 87.5, c: [123, 91, 176]},
  {p: 100, c: [47, 58, 102]}
];

function interpolateColor(pct) {
  if(pct <= 0) return `rgb(${sunsetStops[0].c.join(',')})`;
  if(pct >= 100) return `rgb(${sunsetStops[sunsetStops.length-1].c.join(',')})`;
  
  for(let i=0; i<sunsetStops.length-1; i++) {
    let s1 = sunsetStops[i], s2 = sunsetStops[i+1];
    if(pct >= s1.p && pct <= s2.p) {
      let f = (pct - s1.p) / (s2.p - s1.p);
      let r = Math.round(s1.c[0] + f*(s2.c[0]-s1.c[0]));
      let g = Math.round(s1.c[1] + f*(s2.c[1]-s1.c[1]));
      let b = Math.round(s1.c[2] + f*(s2.c[2]-s1.c[2]));
      return `rgb(${r},${g},${b})`;
    }
  }
}

function updateDayRing() {
  let now = new Date();
  let hours = now.getHours() + now.getMinutes()/60 + now.getSeconds()/3600;
  
  let clockStr = now.toLocaleTimeString('en-US', {hour: 'numeric', minute:'2-digit'});
  document.getElementById('ringClock').textContent = clockStr;
  
  let fill = document.getElementById('ringFill');
  let pctEl = document.getElementById('ringPercent');
  let phaseEl = document.getElementById('ringPhase');
  let statusEl = document.getElementById('ringStatus');
  let remainEl = document.getElementById('ringRemain');
  
  let circ = 2 * Math.PI * 52; // 326.7256
  
  if (hours < WAKE_HOUR) {
    fill.style.strokeDashoffset = circ;
    fill.style.stroke = '#4D4B47';
    pctEl.textContent = '—';
    phaseEl.textContent = 'SLEEPING';
    statusEl.textContent = '😴 Still sleeping';
    let remH = Math.floor(WAKE_HOUR - hours);
    let remM = Math.floor(((WAKE_HOUR - hours) * 60) % 60);
    remainEl.textContent = `${remH}h ${remM}m until wake-up`;
  } else if (hours >= WAKE_HOUR && hours < SLEEP_HOUR) {
    let pct = ((hours - WAKE_HOUR) / (SLEEP_HOUR - WAKE_HOUR)) * 100;
    fill.style.strokeDashoffset = circ * (1 - pct/100);
    fill.style.stroke = interpolateColor(pct);
    pctEl.textContent = Math.round(pct) + '%';
    
    if(pct < 25) { phaseEl.textContent = 'MORNING'; statusEl.textContent = '☀️ Morning — fresh start'; }
    else if(pct < 50) { phaseEl.textContent = 'MIDDAY'; statusEl.textContent = '⚡ Midday — keep moving'; }
    else if(pct < 75) { phaseEl.textContent = 'AFTERNOON'; statusEl.textContent = '🔥 Afternoon — push it'; }
    else if(pct < 90) { phaseEl.textContent = 'EVENING'; statusEl.textContent = '⏳ Evening — wrap up'; }
    else { phaseEl.textContent = 'BEDTIME'; statusEl.textContent = '🌙 Bedtime soon'; }
    
    let rem = SLEEP_HOUR - hours;
    let remH = Math.floor(rem);
    let remM = Math.floor((rem * 60) % 60);
    remainEl.textContent = `${remH}h ${remM}m awake time left`;
  } else {
    fill.style.strokeDashoffset = 0;
    fill.style.stroke = '#E25D7A';
    pctEl.textContent = '100%';
    phaseEl.textContent = 'PAST BEDTIME';
    statusEl.textContent = '⚠️ Past bedtime';
    remainEl.textContent = 'Sleep!';
  }
}

runRollover();
checkStreak();
loadToday();
loadTomorrow();
renderStreak();

updateTickerItems();
tickTicker();
tickerInterval = setInterval(() => tickTicker(), 5000);

updateDayRing();
setInterval(updateDayRing, 60000);



// Race Prep Logic
const RACE_DATE = '2026-08-29';
const PLAN_START = '2026-05-14';

const TRAINING_PLAN = [
  { week: 1, phase: 'base', phaseLabel: 'Base Building', phaseGoal: 'Build aerobic volume safely, introduce strides, establish consistency.', dates: { start: '2026-05-14', end: '2026-05-20' }, volume: 19, sessions: [
    { day: 1, type: 'easy', typeLabel: 'Easy', title: 'Easy Run 6km', detail: '@ 5:15–5:30/km', pace: '5:15–5:30', distance: 6, strides: null },
    { day: 2, type: 'tempo', typeLabel: 'Tempo', title: 'Tempo Run 5km', detail: '1.5km WU + 2km @ 4:45/km + 1.5km CD', pace: '4:45', distance: 5, strides: null },
    { day: 3, type: 'long', typeLabel: 'Long', title: 'Long Run 8km', detail: '@ 5:20–5:40/km', pace: '5:20–5:40', distance: 8, strides: '4×100m strides' }
  ]},
  { week: 2, phase: 'base', phaseLabel: 'Base Building', phaseGoal: 'Build aerobic volume safely, introduce strides, establish consistency.', dates: { start: '2026-05-21', end: '2026-05-27' }, volume: 22, sessions: [
    { day: 1, type: 'easy', typeLabel: 'Easy', title: 'Easy Run 7km', detail: '@ 5:15–5:30/km', pace: '5:15–5:30', distance: 7, strides: null },
    { day: 2, type: 'tempo', typeLabel: 'Tempo', title: 'Tempo Run 6km', detail: '1.5km WU + 3km @ 4:45/km + 1.5km CD', pace: '4:45', distance: 6, strides: null },
    { day: 3, type: 'long', typeLabel: 'Long', title: 'Long Run 9km', detail: '@ 5:15–5:35/km', pace: '5:15–5:35', distance: 9, strides: '4×100m strides' }
  ]},
  { week: 3, phase: 'base', phaseLabel: 'Base Building', phaseGoal: 'Build aerobic volume safely, introduce strides, establish consistency.', dates: { start: '2026-05-28', end: '2026-06-03' }, volume: 24, sessions: [
    { day: 1, type: 'easy', typeLabel: 'Easy', title: 'Easy Run 7km', detail: '@ 5:10–5:25/km', pace: '5:10–5:25', distance: 7, strides: null },
    { day: 2, type: 'tempo', typeLabel: 'Tempo', title: 'Tempo Run 7km', detail: '1.5km WU + 4km @ 4:40/km + 1.5km CD', pace: '4:40', distance: 7, strides: null },
    { day: 3, type: 'long', typeLabel: 'Long', title: 'Long Run 10km', detail: '@ 5:15–5:35/km', pace: '5:15–5:35', distance: 10, strides: '6×100m strides' }
  ]},
  { week: 4, phase: 'base', phaseLabel: 'Recovery', phaseGoal: 'Allow body to adapt. Keep it easy.', dates: { start: '2026-06-04', end: '2026-06-10' }, volume: 19, sessions: [
    { day: 1, type: 'easy', typeLabel: 'Easy', title: 'Easy Run 6km', detail: '@ 5:15–5:30/km', pace: '5:15–5:30', distance: 6, strides: null },
    { day: 2, type: 'tempo', typeLabel: 'Tempo', title: 'Tempo Run 5km', detail: '1.5km WU + 2km @ 4:45/km + 1.5km CD', pace: '4:45', distance: 5, strides: null },
    { day: 3, type: 'long', typeLabel: 'Long', title: 'Long Run 8km', detail: '@ 5:20–5:40/km', pace: '5:20–5:40', distance: 8, strides: null }
  ]},
  { week: 5, phase: 'speed', phaseLabel: 'Speed Development', phaseGoal: 'Improve VO2 max and anaerobic threshold.', dates: { start: '2026-06-11', end: '2026-06-17' }, volume: 26, sessions: [
    { day: 1, type: 'easy', typeLabel: 'Easy', title: 'Easy Run 7km', detail: '@ 5:10–5:25/km', pace: '5:10–5:25', distance: 7, strides: null },
    { day: 2, type: 'intervals', typeLabel: 'Intervals', title: 'Intervals', detail: '1.5km WU + 5×800m @ 3:50–3:55/km (90s jog) + 1.5km CD', pace: '3:50–3:55', distance: 8, strides: null },
    { day: 3, type: 'long', typeLabel: 'Long', title: 'Long Run 11km', detail: '@ 5:10–5:30/km', pace: '5:10–5:30', distance: 11, strides: null }
  ]},
  { week: 6, phase: 'speed', phaseLabel: 'Speed Development', phaseGoal: 'Increase interval volume and intensity.', dates: { start: '2026-06-18', end: '2026-06-24' }, volume: 29, sessions: [
    { day: 1, type: 'easy', typeLabel: 'Easy', title: 'Easy Run 8km', detail: '@ 5:10–5:25/km', pace: '5:10–5:25', distance: 8, strides: null },
    { day: 2, type: 'intervals', typeLabel: 'Intervals', title: 'Intervals', detail: '1.5km WU + 6×800m @ 3:50–3:55/km (90s jog) + 1.5km CD', pace: '3:50–3:55', distance: 9, strides: null },
    { day: 3, type: 'long', typeLabel: 'Long', title: 'Long Run 12km', detail: '@ 5:10–5:30/km', pace: '5:10–5:30', distance: 12, strides: null }
  ]},
  { week: 7, phase: 'speed', phaseLabel: 'Speed Development', phaseGoal: 'Sharpening the speed while maintaining volume.', dates: { start: '2026-06-25', end: '2026-07-01' }, volume: 30, sessions: [
    { day: 1, type: 'easy', typeLabel: 'Easy', title: 'Easy Run 8km', detail: '@ 5:05–5:20/km', pace: '5:05–5:20', distance: 8, strides: null },
    { day: 2, type: 'intervals', typeLabel: 'Intervals', title: 'Intervals', detail: '1.5km WU + 4×1000m @ 3:55–4:00/km (2min jog) + 1.5km CD', pace: '3:55–4:00', distance: 7, strides: null },
    { day: 3, type: 'long', typeLabel: 'Long', title: 'Long Run 13km', detail: '@ 5:10–5:25/km', pace: '5:10–5:25', distance: 13, strides: '4×100m strides' }
  ]},
  { week: 8, phase: 'speed', phaseLabel: 'Recovery', phaseGoal: 'Drop volume, maintain some intensity.', dates: { start: '2026-07-02', end: '2026-07-08' }, volume: 22, sessions: [
    { day: 1, type: 'easy', typeLabel: 'Easy', title: 'Easy Run 6km', detail: '@ 5:15–5:30/km', pace: '5:15–5:30', distance: 6, strides: null },
    { day: 2, type: 'tempo', typeLabel: 'Tempo', title: 'Tempo Run 6km', detail: '1.5km WU + 3km @ 4:35/km + 1.5km CD', pace: '4:35', distance: 6, strides: null },
    { day: 3, type: 'long', typeLabel: 'Long', title: 'Long Run 10km', detail: '@ 5:15–5:30/km', pace: '5:15–5:30', distance: 10, strides: null }
  ]},
  { week: 9, phase: 'race', phaseLabel: 'Race-Specific', phaseGoal: 'Lock in target race pace and build mental toughness.', dates: { start: '2026-07-09', end: '2026-07-15' }, volume: 31, sessions: [
    { day: 1, type: 'easy', typeLabel: 'Easy', title: 'Easy Run 8km', detail: '@ 5:05–5:20/km', pace: '5:05–5:20', distance: 8, strides: null },
    { day: 2, type: 'race-pace', typeLabel: 'Race Pace', title: 'Race Pace Intervals', detail: '1.5km WU + 3×1.5km @ 4:25/km (2min jog) + 1.5km CD', pace: '4:25', distance: 9, strides: null },
    { day: 3, type: 'long', typeLabel: 'Long', title: 'Long Run 14km', detail: '@ 5:05–5:20/km (last 3km @ 4:40/km)', pace: '5:05–5:20', distance: 14, strides: null }
  ]},
  { week: 10, phase: 'race', phaseLabel: 'Race-Specific', phaseGoal: 'Highest interval volume at race pace.', dates: { start: '2026-07-16', end: '2026-07-22' }, volume: 32, sessions: [
    { day: 1, type: 'easy', typeLabel: 'Easy', title: 'Easy Run 8km', detail: '@ 5:05–5:20/km', pace: '5:05–5:20', distance: 8, strides: null },
    { day: 2, type: 'race-pace', typeLabel: 'Race Pace', title: 'Race Pace Intervals', detail: '1.5km WU + 4×1.5km @ 4:25/km (2min jog) + 1.5km CD', pace: '4:25', distance: 10.5, strides: null },
    { day: 3, type: 'long', typeLabel: 'Long', title: 'Long Run 14km', detail: '@ 5:05–5:20/km (last 4km @ 4:30/km)', pace: '5:05–5:20', distance: 14, strides: null }
  ]},
  { week: 11, phase: 'race', phaseLabel: 'Race-Specific', phaseGoal: 'Final peak volume week.', dates: { start: '2026-07-23', end: '2026-07-29' }, volume: 33, sessions: [
    { day: 1, type: 'easy', typeLabel: 'Easy', title: 'Easy Run 9km', detail: '@ 5:05–5:20/km', pace: '5:05–5:20', distance: 9, strides: null },
    { day: 2, type: 'tempo', typeLabel: 'Tempo', title: 'Tempo Run 9km', detail: '1.5km WU + 6km @ 4:30/km + 1.5km CD', pace: '4:30', distance: 9, strides: null },
    { day: 3, type: 'long', typeLabel: 'Long', title: 'Long Run 15km', detail: '@ 5:05–5:20/km (last 3km @ 4:25/km)', pace: '5:05–5:20', distance: 15, strides: null }
  ]},
  { week: 12, phase: 'race', phaseLabel: 'Recovery', phaseGoal: 'Recovery before the final taper push.', dates: { start: '2026-07-30', end: '2026-08-05' }, volume: 22, sessions: [
    { day: 1, type: 'easy', typeLabel: 'Easy', title: 'Easy Run 6km', detail: '@ 5:15–5:30/km', pace: '5:15–5:30', distance: 6, strides: null },
    { day: 2, type: 'race-pace', typeLabel: 'Race Pace', title: 'Race Pace Intervals', detail: '1.5km WU + 2×1.5km @ 4:25/km (2min jog) + 1.5km CD', pace: '4:25', distance: 7, strides: null },
    { day: 3, type: 'long', typeLabel: 'Long', title: 'Long Run 10km', detail: '@ 5:10–5:25/km', pace: '5:10–5:25', distance: 10, strides: null }
  ]},
  { week: 13, phase: 'taper', phaseLabel: 'Taper & Race', phaseGoal: 'Begin taper. Maintain speed, drop volume.', dates: { start: '2026-08-06', end: '2026-08-12' }, volume: 24, sessions: [
    { day: 1, type: 'easy', typeLabel: 'Easy', title: 'Easy Run 7km', detail: '@ 5:10–5:25/km', pace: '5:10–5:25', distance: 7, strides: '6×100m strides' },
    { day: 2, type: 'tempo', typeLabel: 'Tempo', title: 'Tempo Run 7km', detail: '1.5km WU + 4km @ 4:25–4:30/km + 1.5km CD', pace: '4:25–4:30', distance: 7, strides: null },
    { day: 3, type: 'long', typeLabel: 'Long', title: 'Long Run 10km', detail: '@ 5:10–5:25/km (last 2km @ 4:25/km)', pace: '5:10–5:25', distance: 10, strides: null }
  ]},
  { week: 14, phase: 'taper', phaseLabel: 'Taper & Race', phaseGoal: 'Sharpen the legs. Rest more.', dates: { start: '2026-08-13', end: '2026-08-19' }, volume: 19, sessions: [
    { day: 1, type: 'easy', typeLabel: 'Easy', title: 'Easy Run 6km', detail: '@ 5:15–5:25/km', pace: '5:15–5:25', distance: 6, strides: '4×100m strides' },
    { day: 2, type: 'sharpener', typeLabel: 'Sharpener', title: 'Sharpener', detail: '1.5km WU + 4×600m @ 4:10/km (90s jog) + 1.5km CD', pace: '4:10', distance: 5, strides: null },
    { day: 3, type: 'easy', typeLabel: 'Easy', title: 'Easy Run 8km', detail: '@ 5:15–5:30/km', pace: '5:15–5:30', distance: 8, strides: null }
  ]},
  { week: 15, phase: 'taper', phaseLabel: 'Taper & Race', phaseGoal: 'Final countdown. Ready to race.', dates: { start: '2026-08-20', end: '2026-08-29' }, volume: 20, sessions: [
    { day: 1, type: 'easy', typeLabel: 'Easy', title: 'Easy Run 5km', detail: '@ 5:15–5:25/km', pace: '5:15–5:25', distance: 5, strides: '4×100m strides' },
    { day: 2, type: 'sharpener', typeLabel: 'Sharpener', title: 'Shakeout 3km', detail: '3km easy + 4×100m strides', pace: 'Easy', distance: 3, strides: '4×100m strides' },
    { day: 3, type: 'race-day', typeLabel: 'Race Day', title: '12km @ 4:25/km — GO GET IT!', detail: 'RACE DAY · Aug 29, 2026', pace: '4:25', distance: 12, strides: null }
  ]}
];

let rpViewingWeek = null;

const getSessionKey = (wk, dy) => `W${wk}D${dy}`;
const isSessionDone = (wk, dy) => {
  const store = storeGet('rp_sessions_v1') || {};
  return !!store[getSessionKey(wk, dy)];
};
const toggleSession = (wk, dy) => {
  const store = storeGet('rp_sessions_v1') || {};
  const key = getSessionKey(wk, dy);
  store[key] = !store[key];
  storeSet('rp_sessions_v1', store);
  
  if (wk === 15 && dy === 3 && store[key]) {
    triggerRaceCelebration();
  }
  
  window.dispatchEvent(new CustomEvent('rp-changed'));
};

function triggerRaceCelebration() {
  const hdr = document.getElementById('rpHeaderCard');
  hdr.style.animation = 'rp-celebrate 0.6s ease';
  setTimeout(() => hdr.style.animation = '', 600);
}

function getCurrentWeek() {
  const now = new Date();
  const todayStr = now.toLocaleDateString('en-CA');
  for (let w of TRAINING_PLAN) {
    if (todayStr >= w.dates.start && todayStr <= w.dates.end) return w.week;
  }
  if (todayStr < PLAN_START) return 1;
  return 15;
}

function renderRacePrep() {
  const currentWeekNum = getCurrentWeek();
  if (rpViewingWeek === null) rpViewingWeek = currentWeekNum;
  
  renderRaceHeader(currentWeekNum);
  renderThisWeek(rpViewingWeek, currentWeekNum);
  renderFullPlan(currentWeekNum);
}

function renderRaceHeader(currWk) {
  const planWk = TRAINING_PLAN.find(w => w.week === currWk);
  const phaseColor = `var(--phase-${planWk.phase})`;
  
  // Ring based on weekly progress
  const doneCount = planWk.sessions.filter(s => isSessionDone(currWk, s.day)).length;
  const totalCount = planWk.sessions.length;
  const ringFill = document.getElementById('rpRingFill');
  const C = 2 * Math.PI * 48;
  const offset = C * (1 - doneCount / totalCount);
  ringFill.style.strokeDashoffset = offset;
  ringFill.style.stroke = doneCount === totalCount ? 'var(--success)' : phaseColor;
  
  document.getElementById('rpHdrWk').textContent = `Wk ${currWk}`;
  const phaseLbl = document.getElementById('rpHdrPhase');
  phaseLbl.textContent = planWk.phaseLabel.split(' ')[0];
  phaseLbl.style.color = phaseColor;
  
  // Countdown
  const cdEl = document.getElementById('rpCountdown');
  if (isSessionDone(15, 3)) {
    cdEl.textContent = 'Race complete! 🎉';
    cdEl.style.color = 'var(--success)';
  } else {
    const raceDate = new Date(RACE_DATE + 'T00:00:00');
    const today = new Date();
    today.setHours(0,0,0,0);
    const diffDays = Math.ceil((raceDate - today) / (1000 * 60 * 60 * 24));
    cdEl.textContent = diffDays > 0 ? `${diffDays} days to race day` : diffDays === 0 ? "It's Race Day! 🏃‍♂️" : "Race complete!";
    cdEl.style.color = 'var(--text-primary)';
  }
  
  // Volume
  document.getElementById('rpVolFill').style.width = (planWk.volume / 33 * 100) + '%';
  document.getElementById('rpVolFill').style.background = phaseColor;
  document.getElementById('rpVolLbl').textContent = `${planWk.volume}km this week · Peak: 33km`;
}

function renderThisWeek(wkNum, actualCurrWk) {
  const wk = TRAINING_PLAN.find(w => w.week === wkNum);
  const list = document.getElementById('rpSessionsList');
  list.innerHTML = '';
  
  const label = document.getElementById('rpWeekLabel');
  label.innerHTML = `Week ${wk.week} · <span style="color:var(--phase-${wk.phase})">${wk.phaseLabel}</span>`;
  
  const dStart = new Date(wk.dates.start).toLocaleDateString('en-US', {month:'short', day:'numeric'});
  const dEnd = new Date(wk.dates.end).toLocaleDateString('en-US', {month:'short', day:'numeric'});
  document.getElementById('rpWeekDates').textContent = `${dStart} – ${dEnd}`;
  
  let doneCount = 0;
  wk.sessions.forEach(s => { if(isSessionDone(wk.week, s.day)) doneCount++; });
  
  const prog = document.getElementById('rpWeekProgress');
  prog.textContent = `${doneCount}/3 done`;
  prog.className = `rp-week-progress ${doneCount === 3 ? 'all-done' : ''}`;
  
  const viewingTag = document.getElementById('rpViewingLabel');
  const resetBtn = document.getElementById('rpNavReset');
  if (wkNum !== actualCurrWk) {
    viewingTag.style.display = 'block';
    viewingTag.textContent = `Viewing Wk ${wkNum} · ${wk.phaseLabel}`;
    resetBtn.style.display = 'inline-block';
  } else {
    viewingTag.style.display = 'none';
    resetBtn.style.display = 'none';
  }
  
  wk.sessions.forEach(s => {
    const isDone = isSessionDone(wk.week, s.day);
    const typeColor = `var(--run-${s.type})`;
    const row = document.createElement('div');
    row.className = `rp-session ${isDone ? 'is-done' : ''}`;
    if(isDone) row.style.setProperty('--row-tint', `color-mix(in srgb, ${typeColor} 4%, transparent)`);
    
    row.innerHTML = `
      <div class="rp-session-cb ${isDone ? 'checked' : ''}" style="background: ${isDone ? typeColor : 'transparent'}; box-shadow: ${isDone ? '0 0 12px ' + typeColor : 'none'}"></div>
      <div class="rp-day-lbl">Day ${s.day}</div>
      <div class="rp-session-body">
        <div class="rp-session-head">
          <div class="rp-type-badge" style="color:${typeColor}; background:color-mix(in srgb, ${typeColor} 12%, transparent)">${s.typeLabel}</div>
          <div class="rp-session-title">${s.title}</div>
        </div>
        <div class="rp-session-detail">${s.detail}</div>
        ${s.strides ? `<div class="rp-strides">${s.strides}</div>` : ''}
      </div>
      <div class="rp-pace-pill">${s.pace}</div>
    `;
    row.onclick = () => toggleSession(wk.week, s.day);
    list.appendChild(row);
  });
  
  document.getElementById('rpNavPrev').disabled = (wkNum === 1);
  document.getElementById('rpNavNext').disabled = (wkNum === 15);
}

function renderFullPlan(currWk) {
  const cont = document.getElementById('rpPlanContent');
  cont.innerHTML = '';
  
  const phases = [
    { name: 'Base Building', weeks: [1,2,3,4], color: 'var(--phase-base)' },
    { name: 'Speed Development', weeks: [5,6,7,8], color: 'var(--phase-speed)' },
    { name: 'Race-Specific', weeks: [9,10,11,12], color: 'var(--phase-race)' },
    { name: 'Taper & Race', weeks: [13,14,15], color: 'var(--phase-taper)' }
  ];
  
  phases.forEach((p, i) => {
    const block = document.createElement('div');
    block.className = 'rp-phase-block';
    
    const pWks = TRAINING_PLAN.filter(w => p.weeks.includes(w.week));
    const dStart = new Date(pWks[0].dates.start).toLocaleDateString('en-US', {month:'short', day:'numeric'});
    const dEnd = new Date(pWks[pWks.length-1].dates.end).toLocaleDateString('en-US', {month:'short', day:'numeric'});
    
    block.innerHTML = `
      <div class="rp-phase-head">
        <div class="rp-phase-title-row">
          <div class="rp-phase-dot" style="background:${p.color}"></div>
          <div class="rp-phase-title">Phase ${i+1}: ${p.name}</div>
        </div>
        <div class="rp-phase-dates">Weeks ${p.weeks[0]}–${p.weeks[p.weeks.length-1]} · ${dStart} – ${dEnd}</div>
        <div class="rp-phase-goal">${pWks[0].phaseGoal}</div>
      </div>
    `;
    
    pWks.forEach(w => {
      const isCurr = w.week === currWk;
      const row = document.createElement('div');
      row.className = `rp-week-row ${isCurr ? 'is-current' : ''}`;
      row.style.setProperty('--phase-color', p.color);
      
      let dots = '';
      w.sessions.forEach(s => {
        dots += `<div class="rp-dot ${isSessionDone(w.week, s.day) ? 'done' : ''}"></div>`;
      });
      
      row.innerHTML = `
        <div class="rp-week-row-label">Wk ${w.week}</div>
        <div class="rp-week-summaries">
          ${w.sessions.map(s => `<div class="rp-micro-session"><div class="rp-micro-dot" style="background:var(--run-${s.type})"></div> ${s.distance}k</div>`).join('')}
        </div>
        <div class="rp-week-vol">${w.volume}km</div>
        <div class="rp-week-dots">${dots}</div>
      `;
      block.appendChild(row);
    });
    
    cont.appendChild(block);
    if(i < phases.length - 1) cont.appendChild(document.createElement('div')).className = 'rp-divider';
  });
}

document.getElementById('rpPlanToggle').onclick = () => {
  const content = document.getElementById('rpPlanContent');
  const chev = document.getElementById('rpPlanChevron');
  content.classList.toggle('open');
  chev.classList.toggle('open');
};

document.getElementById('rpNavPrev').onclick = () => { if(rpViewingWeek > 1) { rpViewingWeek--; renderRacePrep(); } };
document.getElementById('rpNavNext').onclick = () => { if(rpViewingWeek < 15) { rpViewingWeek++; renderRacePrep(); } };
document.getElementById('rpNavReset').onclick = () => { rpViewingWeek = getCurrentWeek(); renderRacePrep(); };

window.addEventListener('rp-changed', renderRacePrep);
renderRacePrep();



// Hyrox Prep Logic
const HYROX_RACE_DATE = '2026-08-23';
const HYROX_PLAN_START = '2026-05-14';

const HYROX_SPLITS = [
  { type: 'run',     label: 'Run 1 (1km)',               target: '4:15', color: 'var(--hx-run)',       notes: 'Settle in. DO NOT sprint. Find your rhythm.' },
  { type: 'station', label: 'Ski Erg (1000m)',            target: '4:30', color: 'var(--hx-ski)',       notes: 'Long pulls, steady rate 26–30 spm. Don\'t redline.' },
  { type: 'run',     label: 'Run 2 (1km)',               target: '4:15', color: 'var(--hx-run)',       notes: 'Recover from ski erg. Controlled pace.' },
  { type: 'station', label: 'Sled Push (50m)',            target: '2:30', color: 'var(--hx-sled)',      notes: 'Low body position, drive through legs. Short quick steps.' },
  { type: 'run',     label: 'Run 3 (1km)',               target: '4:20', color: 'var(--hx-run)',       notes: 'Legs will feel heavy post-sled. Settle back in.' },
  { type: 'station', label: 'Sled Pull (50m)',            target: '2:30', color: 'var(--hx-sled)',      notes: 'Hand-over-hand, stay low, brace core. Grip management.' },
  { type: 'run',     label: 'Run 4 (1km)',               target: '4:20', color: 'var(--hx-run)',       notes: 'Maintain rhythm. Don\'t chase time here.' },
  { type: 'station', label: 'Burpee Broad Jumps (80m)',   target: '3:30', color: 'var(--hx-burpee)',    notes: 'Biggest energy drain. Controlled pace, full extension.' },
  { type: 'run',     label: 'Run 5 (1km)',               target: '4:25', color: 'var(--hx-run)',       notes: 'Recovery run. Let heart rate come down.' },
  { type: 'station', label: 'Rowing (1000m)',             target: '3:45', color: 'var(--hx-row)',       notes: 'Target 1:52/500m split. Rate 24–28. Legs drive, arms follow.' },
  { type: 'run',     label: 'Run 6 (1km)',               target: '4:25', color: 'var(--hx-run)',       notes: 'Stay composed. You\'re past halfway.' },
  { type: 'station', label: 'Farmers Carry (200m)',       target: '2:00', color: 'var(--hx-farmers)',   notes: 'Grip will be tested. Short quick steps. Don\'t stop.' },
  { type: 'run',     label: 'Run 7 (1km)',               target: '4:25', color: 'var(--hx-run)',       notes: 'Grind phase. Keep cadence steady.' },
  { type: 'station', label: 'Sandbag Lunges (100m)',      target: '4:00', color: 'var(--hx-lunges)',    notes: 'Pacing critical. Steady steps, don\'t rush.' },
  { type: 'run',     label: 'Run 8 (1km)',               target: '4:30', color: 'var(--hx-run)',       notes: 'Last run. Empty what\'s left but stay controlled.' },
  { type: 'station', label: 'Wall Balls (100 reps)',      target: '5:30', color: 'var(--hx-wallballs)', notes: 'Sets of 15–20. Breathe at the top. Don\'t go unbroken.' }
];

const HYROX_PLAN = [
  {
    week: 1, phase: 'foundations', phaseLabel: 'Foundations', phaseColor: 'var(--hx-phase-found)',
    dates: { start: '2026-05-14', end: '2026-05-20' },
    sessions: [
      {
        session: 1, type: 'circuit', typeLabel: 'Circuit', badgeLabel: 'CIRCUIT',
        title: 'Hyrox Circuit (Technique Focus)',
        detail: [
          'Ski Erg: 3×500m @ easy pace (2min rest)',
          'Wall Balls: 4×15 reps (60s rest) — focus on breathing rhythm',
          'Rowing: 3×500m @ 2:00/500m (90s rest)',
          'Burpee Broad Jumps: 3×40m (90s rest)'
        ]
      },
      {
        session: 2, type: 'strength', typeLabel: 'Strength', badgeLabel: 'STRENGTH',
        title: 'Station Strength',
        detail: [
          'Sled Push: 5×25m @ race weight (walk back rest)',
          'Sled Pull: 5×25m @ race weight',
          'Farmers Carry: 3×100m @ race weight (90s rest)',
          'Sandbag Lunges: 3×50m (90s rest)'
        ]
      }
    ]
  },
  {
    week: 2, phase: 'foundations', phaseLabel: 'Foundations', phaseColor: 'var(--hx-phase-found)',
    dates: { start: '2026-05-21', end: '2026-05-27' },
    sessions: [
      {
        session: 1, type: 'circuit', typeLabel: 'Circuit', badgeLabel: 'CIRCUIT',
        title: 'Hyrox Circuit (Build Volume)',
        detail: [
          'Ski Erg: 4×500m @ moderate (90s rest)',
          'Wall Balls: 5×15 reps (50s rest)',
          'Rowing: 4×500m @ 1:58/500m (90s rest)',
          'Burpee Broad Jumps: 4×40m (75s rest)'
        ]
      },
      {
        session: 2, type: 'strength', typeLabel: 'Strength', badgeLabel: 'STRENGTH',
        title: 'Station Strength',
        detail: [
          'Sled Push: 6×25m @ race weight (walk back)',
          'Sled Pull: 6×25m @ race weight',
          'Farmers Carry: 4×100m @ race weight (75s rest)',
          'Sandbag Lunges: 4×50m (75s rest)'
        ]
      }
    ]
  },
  {
    week: 3, phase: 'foundations', phaseLabel: 'Foundations', phaseColor: 'var(--hx-phase-found)',
    dates: { start: '2026-05-28', end: '2026-06-03' },
    sessions: [
      {
        session: 1, type: 'circuit', typeLabel: 'Circuit', badgeLabel: 'CIRCUIT',
        title: 'Hyrox Circuit (Pacing Practice)',
        detail: [
          'Ski Erg: 2×1000m @ target pace 4:30 (2min rest)',
          'Wall Balls: 4×20 reps (50s rest)',
          'Rowing: 2×1000m @ 1:55/500m (2min rest)',
          'Burpee Broad Jumps: 3×50m (90s rest)'
        ]
      },
      {
        session: 2, type: 'combo', typeLabel: 'Combo', badgeLabel: 'COMBO',
        title: 'Station Strength + Run',
        detail: [
          'Sled Push: 4×50m @ race weight',
          'Sled Pull: 4×50m @ race weight',
          'Farmers Carry: 3×200m @ race weight',
          'Sandbag Lunges: 3×50m',
          'Finish: 1km run @ 4:30/km'
        ]
      }
    ]
  },
  {
    week: 4, phase: 'foundations', phaseLabel: 'Foundations', phaseColor: 'var(--hx-phase-found)',
    dates: { start: '2026-06-04', end: '2026-06-10' },
    sessions: [
      {
        session: 1, type: 'circuit', typeLabel: 'Circuit', badgeLabel: 'CIRCUIT',
        title: 'Recovery Week Circuit',
        detail: [
          'Ski Erg: 2×500m easy (2min rest)',
          'Wall Balls: 3×15 reps (60s rest)',
          'Rowing: 2×500m easy (2min rest)',
          'Burpee Broad Jumps: 2×40m easy'
        ]
      },
      {
        session: 2, type: 'strength', typeLabel: 'Strength', badgeLabel: 'STRENGTH',
        title: 'Light Station Work',
        detail: [
          'Sled Push: 3×25m @ light weight',
          'Sled Pull: 3×25m @ light weight',
          'Farmers Carry: 2×100m @ light weight',
          'Mobility work: 15 min'
        ]
      }
    ]
  },
  {
    week: 5, phase: 'capacity', phaseLabel: 'Work Capacity', phaseColor: 'var(--hx-phase-cap)',
    dates: { start: '2026-06-11', end: '2026-06-17' },
    sessions: [
      {
        session: 1, type: 'circuit', typeLabel: 'Circuit', badgeLabel: 'CIRCUIT',
        title: 'Wall Ball & Ski Erg Focus',
        detail: [
          'Wall Balls: 100 reps for time (sets of 20, track rest)',
          'Ski Erg: 1000m for time (target 4:30)',
          'Wall Balls: 3×20 reps (40s rest)',
          'Ski Erg: 3×500m @ race pace (60s rest)'
        ]
      },
      {
        session: 2, type: 'combo', typeLabel: 'Combo', badgeLabel: 'COMBO',
        title: 'Run-Station Combo',
        detail: [
          '4 rounds: 1km run @ 4:20/km + station',
          '  Rd 1: Sled Push 50m',
          '  Rd 2: Burpee Broad Jumps 80m',
          '  Rd 3: Rowing 1000m',
          '  Rd 4: Farmers Carry 200m',
          'Record total time'
        ]
      }
    ]
  },
  {
    week: 6, phase: 'capacity', phaseLabel: 'Work Capacity', phaseColor: 'var(--hx-phase-cap)',
    dates: { start: '2026-06-18', end: '2026-06-24' },
    sessions: [
      {
        session: 1, type: 'circuit', typeLabel: 'Circuit', badgeLabel: 'CIRCUIT',
        title: 'Wall Ball & Ski Erg Focus',
        detail: [
          'Wall Balls: 100 reps for time (sets of 25)',
          'Ski Erg: 1000m for time (target 4:20)',
          '3 supersets: 20 wall balls + 500m ski erg (60s rest)',
          'Track improvement vs Week 5'
        ]
      },
      {
        session: 2, type: 'combo', typeLabel: 'Combo', badgeLabel: 'COMBO',
        title: 'Run-Station Combo',
        detail: [
          '5 rounds: 1km run @ 4:20/km + station',
          '  Rd 1: Sled Push 50m',
          '  Rd 2: Sled Pull 50m',
          '  Rd 3: Burpee Broad Jumps 80m',
          '  Rd 4: Sandbag Lunges 100m',
          '  Rd 5: Wall Balls 50 reps',
          'Record total time'
        ]
      }
    ]
  },
  {
    week: 7, phase: 'capacity', phaseLabel: 'Work Capacity', phaseColor: 'var(--hx-phase-cap)',
    dates: { start: '2026-06-25', end: '2026-07-01' },
    sessions: [
      {
        session: 1, type: 'sim', typeLabel: 'Sim', badgeLabel: 'SIM',
        title: 'Full Station Simulation',
        detail: [
          'All 8 stations back-to-back at race pace (NO runs between):',
          '  Ski Erg 1000m → Sled Push 50m → Sled Pull 50m →',
          '  Burpee Broad Jumps 80m → Row 1000m →',
          '  Farmers Carry 200m → Sandbag Lunges 100m → Wall Balls 100 reps',
          'Time each station individually'
        ]
      },
      {
        session: 2, type: 'combo', typeLabel: 'Combo', badgeLabel: 'COMBO',
        title: 'Run-Station Combo (Pacing)',
        detail: [
          '6 rounds: 1km run @ 4:25/km + station',
          '  Rd 1: Ski Erg 1000m',
          '  Rd 2: Sled Push 50m',
          '  Rd 3: Rowing 1000m',
          '  Rd 4: Burpee Broad Jumps 80m',
          '  Rd 5: Farmers Carry 200m',
          '  Rd 6: Wall Balls 50 reps',
          'Focus: EVEN pacing across all rounds'
        ]
      }
    ]
  },
  {
    week: 8, phase: 'capacity', phaseLabel: 'Work Capacity', phaseColor: 'var(--hx-phase-cap)',
    dates: { start: '2026-07-02', end: '2026-07-08' },
    sessions: [
      {
        session: 1, type: 'circuit', typeLabel: 'Circuit', badgeLabel: 'CIRCUIT',
        title: 'Recovery Week Circuit',
        detail: [
          'Ski Erg: 2×500m easy',
          'Wall Balls: 3×15 @ easy tempo',
          'Rowing: 2×500m easy',
          'Light sled push/pull: 3×25m',
          'Mobility: 15 min'
        ]
      },
      {
        session: 2, type: 'combo', typeLabel: 'Combo', badgeLabel: 'COMBO',
        title: 'Light Run-Station Combo',
        detail: [
          '3 rounds: 1km easy run + light station',
          '  Rd 1: Rowing 500m easy',
          '  Rd 2: Farmers Carry 100m light',
          '  Rd 3: Wall Balls 30 reps easy'
        ]
      }
    ]
  },
  {
    week: 9, phase: 'simulation', phaseLabel: 'Race Simulation', phaseColor: 'var(--hx-phase-sim)',
    dates: { start: '2026-07-09', end: '2026-07-15' },
    sessions: [
      {
        session: 1, type: 'sim', typeLabel: 'Sim', badgeLabel: 'SIM',
        title: 'Half Hyrox Simulation',
        detail: [
          '4 rounds: 1km run + station (at race pace)',
          '  Rd 1: Run + Ski Erg 1000m',
          '  Rd 2: Run + Sled Push 50m',
          '  Rd 3: Run + Sled Pull 50m',
          '  Rd 4: Run + Burpee Broad Jumps 80m',
          'Target: 33–35 min total'
        ]
      },
      {
        session: 2, type: 'strength', typeLabel: 'Strength', badgeLabel: 'STRENGTH',
        title: 'Weak Station Focus',
        detail: [
          'Wall Balls: 100 reps for time (target sub-5:30)',
          'Ski Erg: 1000m for time (target sub-4:20)',
          '3 supersets: 25 wall balls + 500m ski (45s rest)',
          'Finish: 2km run @ 4:25/km'
        ]
      }
    ]
  },
  {
    week: 10, phase: 'simulation', phaseLabel: 'Race Simulation', phaseColor: 'var(--hx-phase-sim)',
    dates: { start: '2026-07-16', end: '2026-07-22' },
    sessions: [
      {
        session: 1, type: 'sim', typeLabel: 'Sim', badgeLabel: 'SIM',
        title: 'Full Hyrox Simulation',
        detail: [
          'Complete race simulation: 8× 1km runs + all 8 stations at race weight/reps',
          'Goal: sub 1:12:00 (leave something in the tank)',
          'Record every split',
          'Identify where you lose the most time'
        ]
      },
      {
        session: 2, type: 'strength', typeLabel: 'Strength', badgeLabel: 'STRENGTH',
        title: 'Recovery + Weak Station Top-Up',
        detail: [
          'Ski Erg: 3×500m @ moderate (90s rest)',
          'Wall Balls: 4×20 reps (50s rest)',
          'Easy 2km run',
          'Mobility: 15 min'
        ]
      }
    ]
  },
  {
    week: 11, phase: 'simulation', phaseLabel: 'Race Simulation', phaseColor: 'var(--hx-phase-sim)',
    dates: { start: '2026-07-23', end: '2026-07-29' },
    sessions: [
      {
        session: 1, type: 'sim', typeLabel: 'Sim', badgeLabel: 'SIM',
        title: 'Back Half Simulation',
        detail: [
          'Stations 5–8 with runs (the hard half):',
          '  Run + Row 1000m',
          '  Run + Farmers Carry 200m',
          '  Run + Sandbag Lunges 100m',
          '  Run + Wall Balls 100 reps',
          'Target: sub 35 min. This is where races are won.'
        ]
      },
      {
        session: 2, type: 'strength', typeLabel: 'Strength', badgeLabel: 'STRENGTH',
        title: 'Station Speed Work',
        detail: [
          'Ski Erg: 4×250m HARD (2min rest)',
          'Wall Balls: 5×10 reps FAST (30s rest)',
          'Rowing: 4×250m HARD (2min rest)',
          'Burpee Broad Jumps: 4×20m FAST (60s rest)',
          'Easy 1.5km cool-down run'
        ]
      }
    ]
  },
  {
    week: 12, phase: 'simulation', phaseLabel: 'Race Simulation', phaseColor: 'var(--hx-phase-sim)',
    dates: { start: '2026-07-30', end: '2026-08-05' },
    sessions: [
      {
        session: 1, type: 'circuit', typeLabel: 'Circuit', badgeLabel: 'CIRCUIT',
        title: 'Recovery Week',
        detail: [
          'Light circuit: each station at 50–60% effort',
          'Ski Erg 500m + Row 500m + Wall Balls 40 reps + Farmers Carry 100m',
          'Mobility: 20 min'
        ]
      },
      {
        session: 2, type: 'combo', typeLabel: 'Combo', badgeLabel: 'COMBO',
        title: 'Easy Run-Station Combo',
        detail: [
          '3 rounds: 1km easy run + light station',
          'Focus on transitions and smooth movement',
          'Not for time — feel good and move well'
        ]
      }
    ]
  },
  {
    week: 13, phase: 'taper', phaseLabel: 'Taper & Race', phaseColor: 'var(--hx-phase-taper)',
    dates: { start: '2026-08-06', end: '2026-08-12' },
    sessions: [
      {
        session: 1, type: 'sim', typeLabel: 'Sim', badgeLabel: 'SIM',
        title: 'Sharpener: Half Sim',
        detail: [
          '4 rounds: 1km run + station at RACE PACE',
          '  Rd 1: Run + Ski Erg 1000m',
          '  Rd 2: Run + Burpee Broad Jumps 80m',
          '  Rd 3: Run + Rowing 1000m',
          '  Rd 4: Run + Wall Balls 50 reps',
          'Target: sub 33 min. Practise race-day pacing.'
        ]
      },
      {
        session: 2, type: 'strength', typeLabel: 'Strength', badgeLabel: 'STRENGTH',
        title: 'Weak Station Confidence',
        detail: [
          'Wall Balls: 100 reps for time (target sub-5:15)',
          'Ski Erg: 1000m for time (target sub-4:15)',
          '2 supersets: 20 wall balls + 500m ski (45s rest)',
          'Easy 1.5km jog cool-down'
        ]
      }
    ]
  },
  {
    week: 14, phase: 'taper', phaseLabel: 'Taper & Race', phaseColor: 'var(--hx-phase-taper)',
    dates: { start: '2026-08-13', end: '2026-08-19' },
    sessions: [
      {
        session: 1, type: 'sim', typeLabel: 'Sim', badgeLabel: 'SIM',
        title: 'Light Sharpener',
        detail: [
          '3 rounds: 1km run @ race pace + station at 80%',
          '  Rd 1: Sled Push 50m',
          '  Rd 2: Rowing 500m',
          '  Rd 3: Wall Balls 30 reps',
          'Short and sharp. Stay smooth. Stay controlled.'
        ]
      },
      {
        session: 2, type: 'strength', typeLabel: 'Strength', badgeLabel: 'STRENGTH',
        title: 'Station Openers',
        detail: [
          'Each station at 70% effort, low volume:',
          '  Ski Erg 500m, Sled Push 25m, Sled Pull 25m,',
          '  Burpee BJ 40m, Row 500m, Farmers 100m,',
          '  Lunges 50m, Wall Balls 40 reps',
          'Just touch every movement. Stay fresh.'
        ]
      }
    ]
  },
  {
    week: 15, phase: 'taper', phaseLabel: 'Taper & Race', phaseColor: 'var(--hx-phase-taper)',
    dates: { start: '2026-08-20', end: '2026-08-23' },
    sessions: [
      {
        session: 1, type: 'circuit', typeLabel: 'Circuit', badgeLabel: 'SHAKEOUT',
        title: 'Race Week Shakeout',
        detail: [
          'Easy 1km jog',
          'Light movement drills: 10 wall balls, 250m ski, 250m row',
          'Dynamic stretching and mobility',
          'Visualise your race plan and splits'
        ]
      },
      {
        session: 2, type: 'race-day', typeLabel: 'Race Day', badgeLabel: 'RACE DAY',
        title: 'RACE DAY — SUB 1:10:00 — LET\'S GO!',
        detail: [
          'Warm-up: 5–10 min easy jog + dynamic stretches',
          'Execute your pacing plan',
          'DON\'T go out too fast on Run 1',
          'Target: SUB 1:10:00',
          'Recovery week before 12km race on Aug 29'
        ]
      }
    ]
  }
];

let hxViewingWeek = null;

const getHxSessionKey = (wk, sess) => `W${wk}S${sess}`;
const isHxSessionDone = (wk, sess) => {
  const store = storeGet('hx_sessions_v1') || {};
  return !!store[getHxSessionKey(wk, sess)];
};

const toggleHxSession = (wk, sess) => {
  const store = storeGet('hx_sessions_v1') || {};
  const key = getHxSessionKey(wk, sess);
  store[key] = !store[key];
  storeSet('hx_sessions_v1', store);
  
  if (wk === 15 && sess === 2 && store[key]) {
    triggerHxCelebration();
  }
  
  window.dispatchEvent(new CustomEvent('hx-changed'));
};

function triggerHxCelebration() {
  const hdr = document.getElementById('hxHeaderCard');
  hdr.style.animation = 'rp-celebrate 0.6s ease';
  setTimeout(() => hdr.style.animation = '', 600);
}

function getHxCurrentWeek() {
  const now = new Date();
  const todayStr = now.toLocaleDateString('en-CA');
  for (let w of HYROX_PLAN) {
    if (todayStr >= w.dates.start && todayStr <= w.dates.end) return w.week;
  }
  if (todayStr < HYROX_PLAN_START) return 1;
  return 15;
}

function renderHxHeader() {
  const currWkNum = getHxCurrentWeek();
  const wk = HYROX_PLAN.find(w => w.week === currWkNum);
  const doneCount = wk.sessions.filter(s => isHxSessionDone(wk.week, s.session)).length;
  const totalCount = 2;
  
  const ringFill = document.getElementById('hxRingFill');
  const C = 2 * Math.PI * 48;
  const offset = C * (1 - doneCount / totalCount);
  ringFill.style.strokeDashoffset = offset;
  ringFill.style.stroke = wk.phaseColor;
  
  document.getElementById('hxHdrWk').textContent = `Wk ${currWkNum}`;
  const phaseLbl = document.getElementById('hxHdrPhase');
  phaseLbl.textContent = wk.phaseLabel.toUpperCase();
  phaseLbl.style.color = wk.phaseColor;
  
  const cdEl = document.getElementById('hxCountdown');
  const rDate = new Date(HYROX_RACE_DATE + 'T09:00:00');
  const diff = rDate - new Date();
  if (diff <= 0) {
    cdEl.textContent = 'Race complete! 🔥';
    cdEl.style.color = 'var(--success)';
  } else {
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    cdEl.textContent = `${days} days to race day`;
  }
  
  const dualAlert = document.getElementById('hxDualCallout');
  dualAlert.style.display = (currWkNum >= 13) ? 'inline-flex' : 'none';
}

function renderHxSplits() {
  const table = document.getElementById('hxSplitsTable');
  table.innerHTML = HYROX_SPLITS.map(s => `
    <div class="hx-split-row" style="background: ${s.type === 'run' ? 'rgba(255,255,255,0.02)' : s.color.replace(')', ', 0.03)')}">
      <div class="hx-split-dot" style="background: ${s.color}"></div>
      <div class="hx-split-label">${s.label}</div>
      <div class="hx-split-target">${s.target}</div>
      <div class="hx-split-notes" title="${s.notes}">${s.notes}</div>
    </div>
  `).join('');
}

function renderHxThisWeek(wkNum) {
  const wk = HYROX_PLAN.find(w => w.week === wkNum);
  const actualCurr = getHxCurrentWeek();
  const list = document.getElementById('hxSessionsList');
  
  const label = document.getElementById('hxWeekLabel');
  label.innerHTML = `Week ${wk.week} · <span style="color:${wk.phaseColor}">${wk.phaseLabel}</span>`;
  document.getElementById('hxWeekDates').textContent = formatDate(wk.dates.start) + ' – ' + formatDate(wk.dates.end);
  
  const doneCount = wk.sessions.filter(s => isHxSessionDone(wk.week, s.session)).length;
  const prog = document.getElementById('hxWeekProgress');
  prog.textContent = `${doneCount}/2 done`;
  prog.className = `hx-week-progress ${doneCount === 2 ? 'all-done' : ''}`;
  
  const viewingTag = document.getElementById('hxViewingLabel');
  const resetBtn = document.getElementById('hxNavReset');
  if (wkNum !== actualCurr) {
    viewingTag.style.display = 'block';
    viewingTag.textContent = `Viewing Wk ${wkNum} · ${wk.phaseLabel}`;
    resetBtn.style.display = 'inline-block';
  } else {
    viewingTag.style.display = 'none';
    resetBtn.style.display = 'none';
  }

  list.innerHTML = '';
  wk.sessions.forEach(s => {
    const isDone = isHxSessionDone(wk.week, s.session);
    const sessColor = s.session === 1 ? 'var(--hx-sim)' : 'var(--hx-strength)';
    const div = document.createElement('div');
    div.className = `hx-session ${isDone ? 'is-done' : ''}`;
    if(isDone) div.style.setProperty('--hx-row-tint', sessColor.replace(')', ', 0.04)'));

    let detailsHtml = s.detail.map(line => {
      if (line.startsWith('  ')) {
        return `<li class="hx-detail-item hx-detail-round">${line.trim()}</li>`;
      }
      return `<li class="hx-detail-item">${line}</li>`;
    }).join('');

    div.innerHTML = `
      <div class="hx-session-cb ${isDone ? 'checked' : ''}" style="background: ${isDone ? sessColor : 'transparent'}; box-shadow: ${isDone ? '0 0 12px ' + sessColor.replace(')', ', 0.4)') : 'none'}"></div>
      <div class="hx-session-lbl-col">
        <div class="hx-session-num">SESSION ${s.session}</div>
        <div class="hx-session-type-badge" style="background:${sessColor.replace(')', ', 0.12)')}; color:${sessColor}">${s.badgeLabel}</div>
      </div>
      <div class="hx-session-body">
        <div class="hx-session-title">${s.title}</div>
        <ul class="hx-detail-list">${detailsHtml}</ul>
      </div>
    `;
    
    div.querySelector('.hx-session-cb').onclick = () => toggleHxSession(wk.week, s.session);
    list.appendChild(div);
  });

  document.getElementById('hxNavPrev').disabled = (wkNum === 1);
  document.getElementById('hxNavNext').disabled = (wkNum === 15);
}

function renderHxFullPlan() {
  const cont = document.getElementById('hxPlanContent');
  const currWk = getHxCurrentWeek();
  cont.innerHTML = '';
  
  const phases = [
    { label: 'Phase 1: Foundations', color: 'var(--hx-phase-found)', weeks: [1,2,3,4] },
    { label: 'Phase 2: Work Capacity', color: 'var(--hx-phase-cap)', weeks: [5,6,7,8] },
    { label: 'Phase 3: Race Simulation', color: 'var(--hx-phase-sim)', weeks: [9,10,11,12] },
    { label: 'Phase 4: Taper & Race', color: 'var(--hx-phase-taper)', weeks: [13,14,15] }
  ];

  phases.forEach((p, i) => {
    const block = document.createElement('div');
    block.className = 'hx-phase-block';
    
    const pWks = HYROX_PLAN.filter(w => p.weeks.includes(w.week));
    const dStart = formatDate(pWks[0].dates.start);
    const dEnd = formatDate(pWks[pWks.length-1].dates.end);

    block.innerHTML = `
      <div class="hx-phase-head">
        <div class="hx-phase-title-row">
          <div class="hx-phase-dot" style="background:${p.color}"></div>
          <div class="hx-phase-title">${p.label}</div>
        </div>
        <div class="hx-phase-dates">Weeks ${p.weeks[0]}–${p.weeks[p.weeks.length-1]} · ${dStart} – ${dEnd}</div>
        <div class="hx-phase-goal">${HYROX_PLAN.find(w => w.week === p.weeks[0]).phaseGoal || 'Build capacity and skill.'}</div>
      </div>
    `;

    pWks.forEach(w => {
      const isCurr = w.week === currWk;
      const row = document.createElement('div');
      row.className = `hx-week-row ${isCurr ? 'is-current' : ''}`;
      row.style.setProperty('--phase-color', p.color);
      
      let dots = '';
      w.sessions.forEach(s => {
        dots += `<div class="hx-dot ${isHxSessionDone(w.week, s.session) ? 'done' : ''}"></div>`;
      });

      row.innerHTML = `
        <div class="hx-week-row-label">Wk ${w.week}</div>
        <div class="hx-week-summaries">
          ${w.sessions.map(s => `
            <div class="hx-micro-session">
              <div class="hx-micro-dot" style="background:${s.session === 1 ? 'var(--hx-sim)' : 'var(--hx-strength)'}"></div>
              ${s.typeLabel}
            </div>
          `).join('')}
        </div>
        <div class="hx-week-dots">${dots}</div>
      `;
      block.appendChild(row);
    });

    cont.appendChild(block);
    if(i < phases.length - 1) cont.appendChild(document.createElement('div')).className = 'hx-divider';
  });
}

// Initializers
document.getElementById('hxSplitsToggle').onclick = () => {
  document.getElementById('hxSplitsContent').classList.toggle('open');
  document.getElementById('hxSplitsChevron').classList.toggle('open');
};
document.getElementById('hxPlanToggle').onclick = () => {
  document.getElementById('hxPlanContent').classList.toggle('open');
  document.getElementById('hxPlanChevron').classList.toggle('open');
};

document.getElementById('hxNavPrev').onclick = () => { if(hxViewingWeek > 1) { hxViewingWeek--; renderHxThisWeek(hxViewingWeek); } };
document.getElementById('hxNavNext').onclick = () => { if(hxViewingWeek < 15) { hxViewingWeek++; renderHxThisWeek(hxViewingWeek); } };
document.getElementById('hxNavReset').onclick = () => { hxViewingWeek = getHxCurrentWeek(); renderHxThisWeek(hxViewingWeek); };

window.addEventListener('hx-changed', () => {
  renderHxHeader();
  renderHxThisWeek(hxViewingWeek || getHxCurrentWeek());
  renderHxFullPlan();
});

function initHyrox() {
  hxViewingWeek = getHxCurrentWeek();
  renderHxHeader();
  renderHxSplits();
  renderHxThisWeek(hxViewingWeek);
  renderHxFullPlan();
}

initHyrox();

// BJJ Logic
const BJJ_GOAL_DATE = '2026-12-31';
const BJJ_SESSIONS_PER_WEEK = 4;
const BJJ_AVG_SESSION_HOURS = 1.5;

function getBjjSessions() { return storeGet('bjj_sessions_v1') || []; }
function saveBjjSessions(arr) { 
  storeSet('bjj_sessions_v1', arr);
  window.dispatchEvent(new CustomEvent('bjj-changed'));
}

function getISOWeekKey(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const year = d.getFullYear();
  const week = Math.ceil((((d - new Date(year, 0, 1)) / 86400000) + 1) / 7);
  return `${year}-W${week.toString().padStart(2, '0')}`;
}

function getWeekDateRange(weekKey) {
  const [year, week] = weekKey.split('-W');
  const d = new Date(year, 0, 1 + (week - 1) * 7);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
  const mon = new Date(d.setDate(diff));
  const sun = new Date(d.setDate(diff + 6));
  return {
    start: mon.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    end: sun.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  };
}

function getTargetSessions() {
  const now = new Date();
  const goal = new Date(BJJ_GOAL_DATE);
  const diff = goal - now;
  const weeks = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24 * 7)));
  return weeks * BJJ_SESSIONS_PER_WEEK;
}

function getBjjStreak() {
  const all = getBjjSessions();
  let streak = 0;
  let curr = new Date();
  
  while(true) {
    const key = getISOWeekKey(curr);
    const count = all.filter(s => s.weekKey === key).length;
    if (count >= 3) {
      streak++;
      curr.setDate(curr.getDate() - 7);
    } else {
      break;
    }
  }
  return streak;
}

function renderBjjHeader() {
  const sessions = getBjjSessions();
  const weekKey = getISOWeekKey(new Date());
  const weekSess = sessions.filter(s => s.weekKey === weekKey);
  const doneCount = weekSess.length;
  const totalCount = 4;
  
  const ringFill = document.getElementById('bjjRingFill');
  const C = 2 * Math.PI * 48;
  const offset = C * (1 - Math.min(doneCount, totalCount) / totalCount);
  const pct = Math.round((doneCount / totalCount) * 100);
  
  ringFill.style.strokeDashoffset = offset;
  ringFill.style.stroke = doneCount >= totalCount ? 'var(--success)' : 'var(--bjj-primary)';
  
  document.getElementById('bjjHdrPct').textContent = `${pct}%`;
  document.getElementById('bjjHdrStat').textContent = `${doneCount} of 4`;
  
  const cdEl = document.getElementById('bjjCountdown');
  const goal = new Date(BJJ_GOAL_DATE);
  const now = new Date();
  const diff = goal - now;
  if (diff <= 0) {
    cdEl.textContent = 'Goal deadline passed';
    cdEl.style.color = 'var(--warning)';
  } else {
    const weeks = Math.ceil(diff / (1000 * 60 * 60 * 24 * 7));
    cdEl.textContent = `${weeks} weeks remaining`;
  }
  
  document.getElementById('bjjMatTime').textContent = `~${Math.round(sessions.length * BJJ_AVG_SESSION_HOURS)}h on the mat`;
  
  const mini = document.getElementById('bjjWeekMini');
  mini.innerHTML = '';
  for(let i=0; i<4; i++) {
    const dot = document.createElement('div');
    dot.className = `bjj-dot ${i < weekSess.length ? 'done' : ''}`;
    mini.appendChild(dot);
  }
  
  const streak = getBjjStreak();
  document.getElementById('bjjStreak').textContent = (streak > 0 ? '🔥 ' : '') + `${streak} week streak`;
}

let bjjEditingId = null;

function renderBjjThisWeek() {
  const weekKey = getISOWeekKey(new Date());
  const all = getBjjSessions();
  const weekSess = all.filter(s => s.weekKey === weekKey).sort((a,b) => a.date.localeCompare(b.date));
  
  const range = getWeekDateRange(weekKey);
  document.getElementById('bjjWeekLabel').textContent = `This Week · ${range.start} – ${range.end}`;
  
  const prog = document.getElementById('bjjWeekProgress');
  prog.textContent = `${weekSess.length}/4` + (weekSess.length === 4 ? ' ✓' : '');
  prog.style.background = weekSess.length === 4 ? 'rgba(107,227,164,0.1)' : 'rgba(255,255,255,0.04)';
  prog.style.color = weekSess.length === 4 ? 'var(--success)' : 'var(--text-tertiary)';

  const grid = document.getElementById('bjjWeekGrid');
  grid.innerHTML = '';
  
  for(let i=0; i<4; i++) {
    const sess = weekSess[i];
    const slot = document.createElement('div');
    
    if (sess && bjjEditingId !== sess.id) {
      slot.className = 'bjj-slot filled';
      slot.style.setProperty('--intensity-color', `var(--bjj-intensity-${sess.intensity})`);
      
      const intLabels = ['', 'LIGHT', 'MEDIUM', 'HARD', 'WAR'];
      slot.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div class="bjj-slot-num">SESSION ${i+1}</div>
          <div class="hx-session-type-badge" style="background:var(--bjj-intensity-${sess.intensity})1F; color:var(--bjj-intensity-${sess.intensity})">${intLabels[sess.intensity]}</div>
        </div>
        <div style="font-family:mono; font-size:10px; color:var(--text-tertiary); margin-top:2px;">${new Date(sess.date).toLocaleDateString('en-US', {weekday:'short', month:'short', day:'numeric'})}</div>
        <div class="bjj-tags">
          ${(sess.focus || []).map(t => `<span class="bjj-tag">${t.trim()}</span>`).join('')}
        </div>
        <div class="bjj-notes-preview">${sess.notes}</div>
        <div class="bjj-slot-footer">
          <span class="bjj-edit-link" onclick="bjjEdit('${sess.id}')">Edit</span>
          <span class="bjj-delete-btn" onclick="bjjDelete('${sess.id}')">×</span>
        </div>
      `;
    } else {
      slot.className = 'bjj-slot empty';
      if (bjjEditingId && sess && bjjEditingId === sess.id) {
        slot.className = 'bjj-slot';
        renderBjjForm(slot, sess);
      } else {
        slot.innerHTML = `
          <div class="bjj-slot-num">SESSION ${i+1}</div>
          <button class="bjj-log-btn" onclick="bjjShowForm(this, ${i})">+ Log Session</button>
        `;
      }
    }
    grid.appendChild(slot);
  }
}

function renderBjjForm(container, existing = null) {
  container.innerHTML = `
    <div class="bjj-form">
      <input type="date" id="bjjFormDate" class="fin-select" value="${existing ? existing.date : new Date().toLocaleDateString('en-CA')}">
      <div class="bjj-intensity-row">
        ${[1,2,3,4].map(v => `<div class="bjj-int-btn ${existing && existing.intensity === v ? 'active' : ''}" data-val="${v}" onclick="bjjSelectInt(this, ${v})">${v}</div>`).join('')}
      </div>
      <input type="text" id="bjjFormFocus" class="fin-select" placeholder="Topics (e.g. guard, sweeps)" value="${existing ? existing.focus.join(', ') : ''}">
      <textarea id="bjjFormNotes" class="fin-select" rows="3" placeholder="Session notes...">${existing ? existing.notes : ''}</textarea>
      <div style="display:flex; gap:8px;">
        <button class="gm-btn-primary" style="flex:1" onclick="bjjSave()">${existing ? 'Update' : 'Save'}</button>
        <button class="gm-btn-secondary" onclick="bjjCancel()">Cancel</button>
      </div>
    </div>
  `;
}

let bjjSelectedIntensity = null;
function bjjSelectInt(btn, val) {
  btn.parentElement.querySelectorAll('.bjj-int-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  bjjSelectedIntensity = val;
}

function bjjShowForm(btn, idx) {
  const slot = btn.closest('.bjj-slot');
  slot.className = 'bjj-slot';
  bjjSelectedIntensity = null;
  renderBjjForm(slot);
}

function bjjEdit(id) {
  bjjEditingId = id;
  const sess = getBjjSessions().find(s => s.id === id);
  bjjSelectedIntensity = sess.intensity;
  renderBjjThisWeek();
}

function bjjCancel() {
  bjjEditingId = null;
  renderBjjThisWeek();
}

function bjjDelete(id) {
  const all = getBjjSessions().filter(s => s.id !== id);
  saveBjjSessions(all);
}

function bjjSave() {
  const date = document.getElementById('bjjFormDate').value;
  const intensity = bjjSelectedIntensity;
  const focus = document.getElementById('bjjFormFocus').value.split(',').filter(t => t.trim());
  const notes = document.getElementById('bjjFormNotes').value;
  
  if (!intensity) { alert('Please select intensity level'); return; }
  
  let all = getBjjSessions();
  if (bjjEditingId) {
    all = all.map(s => s.id === bjjEditingId ? { ...s, date, intensity, focus, notes, weekKey: getISOWeekKey(date) } : s);
    bjjEditingId = null;
  } else {
    all.push({
      id: Date.now().toString(),
      date, intensity, focus, notes,
      weekKey: getISOWeekKey(date),
      createdAt: Date.now()
    });
  }
  saveBjjSessions(all);
}

let bjjHistoryLimit = 10;
function renderBjjLog() {
  const all = getBjjSessions().sort((a,b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  const list = document.getElementById('bjjHistoryList');
  const empty = document.getElementById('bjjHistoryEmpty');
  const toggle = document.getElementById('bjjHistoryToggle');
  
  document.getElementById('bjjTotalCount').textContent = `${all.length} sessions logged`;
  
  if (all.length === 0) {
    list.innerHTML = '';
    empty.style.display = 'block';
    toggle.style.display = 'none';
    return;
  }
  
  empty.style.display = 'none';
  const showCount = Math.min(all.length, bjjHistoryLimit);
  const visible = all.slice(0, showCount);
  
  list.innerHTML = visible.map(s => {
    const intLabels = ['', 'LIGHT', 'MEDIUM', 'HARD', 'WAR'];
    const d = new Date(s.date);
    const dateStr = d.toLocaleDateString('en-US', {weekday:'short', month:'short', day:'numeric'});
    const color = `var(--bjj-intensity-${s.intensity})`;
    
    return `
      <div class="bjj-log-entry" onclick="this.querySelector('.bjj-log-full-notes').classList.toggle('open')">
        <div class="bjj-log-main">
          <div class="bjj-int-dot" style="background:${color}"></div>
          <div class="bjj-log-date">${dateStr}</div>
          <div class="bjj-log-excerpt">${s.notes}</div>
          <div class="bjj-log-int-lbl" style="color:${color}">${intLabels[s.intensity]}</div>
        </div>
        <div class="bjj-log-full-notes">
          <div class="bjj-tags" style="margin-bottom:8px;">
            ${(s.focus || []).map(t => `<span class="bjj-tag">${t.trim()}</span>`).join('')}
          </div>
          ${s.notes}
        </div>
      </div>
    `;
  }).join('');
  
  if (all.length > bjjHistoryLimit) {
    toggle.style.display = 'inline-block';
    toggle.textContent = `Show more (${all.length - bjjHistoryLimit} left) ▾`;
    toggle.onclick = () => { bjjHistoryLimit += 10; renderBjjLog(); };
  } else {
    toggle.style.display = 'none';
  }
}

window.addEventListener('bjj-changed', () => {
  renderBjjHeader();
  renderBjjThisWeek();
  renderBjjLog();
});

function initBjj() {
  renderBjjHeader();
  renderBjjThisWeek();
  renderBjjLog();
}

initBjj();

// Gym Tracker Logic
const DEFAULT_GYM_TEMPLATES = {
  push: [
    { name: 'Bench Press', muscle: 'chest', defaultSets: 4 },
    { name: 'Overhead Press', muscle: 'shoulders', defaultSets: 4 },
    { name: 'Incline Dumbbell Press', muscle: 'upper chest', defaultSets: 3 },
    { name: 'Lateral Raises', muscle: 'side delts', defaultSets: 3 },
    { name: 'Tricep Pushdowns', muscle: 'triceps', defaultSets: 3 },
    { name: 'Overhead Tricep Extension', muscle: 'triceps', defaultSets: 3 }
  ],
  pull: [
    { name: 'Barbell Rows', muscle: 'back', defaultSets: 4 },
    { name: 'Pull-Ups', muscle: 'lats', defaultSets: 4 },
    { name: 'Seated Cable Rows', muscle: 'mid back', defaultSets: 3 },
    { name: 'Face Pulls', muscle: 'rear delts', defaultSets: 3 },
    { name: 'Barbell Curls', muscle: 'biceps', defaultSets: 3 },
    { name: 'Hammer Curls', muscle: 'biceps', defaultSets: 3 }
  ],
  legs: [
    { name: 'Squats', muscle: 'quads', defaultSets: 4 },
    { name: 'Romanian Deadlifts', muscle: 'hamstrings', defaultSets: 4 },
    { name: 'Leg Press', muscle: 'quads', defaultSets: 3 },
    { name: 'Leg Curls', muscle: 'hamstrings', defaultSets: 3 },
    { name: 'Calf Raises', muscle: 'calves', defaultSets: 4 },
    { name: 'Walking Lunges', muscle: 'glutes', defaultSets: 3 }
  ],
  arms: [
    { name: 'EZ Bar Curls', muscle: 'biceps', defaultSets: 4 },
    { name: 'Close-Grip Bench Press', muscle: 'triceps', defaultSets: 4 },
    { name: 'Incline Dumbbell Curls', muscle: 'biceps', defaultSets: 3 },
    { name: 'Skull Crushers', muscle: 'triceps', defaultSets: 3 },
    { name: 'Cable Curls', muscle: 'biceps', defaultSets: 3 },
    { name: 'Tricep Dips', muscle: 'triceps', defaultSets: 3 }
  ],
  upper: [
    { name: 'Incline Bench Press', muscle: 'upper chest', defaultSets: 4 },
    { name: 'Weighted Pull-Ups', muscle: 'lats', defaultSets: 4 },
    { name: 'Dumbbell Shoulder Press', muscle: 'shoulders', defaultSets: 3 },
    { name: 'Cable Rows', muscle: 'mid back', defaultSets: 3 },
    { name: 'Dumbbell Flyes', muscle: 'chest', defaultSets: 3 },
    { name: 'Lateral Raises', muscle: 'side delts', defaultSets: 3 }
  ]
};

const GYM_SPLITS = [
  { id: 'push', name: 'Push', color: 'var(--gym-push)', rgb: '255,107,107', glow: 'rgba(255,107,107,0.4)' },
  { id: 'pull', name: 'Pull', color: 'var(--gym-pull)', rgb: '123,158,255', glow: 'rgba(123,158,255,0.4)' },
  { id: 'legs', name: 'Legs', color: 'var(--gym-legs)', rgb: '107,227,164', glow: 'rgba(107,227,164,0.4)' },
  { id: 'arms', name: 'Arms', color: 'var(--gym-arms)', rgb: '242,192,99', glow: 'rgba(242,192,99,0.4)' },
  { id: 'upper', name: 'Upper', color: 'var(--gym-upper)', rgb: '167,139,250', glow: 'rgba(167,139,250,0.4)' }
];

let gymActiveSplit = null;
let gymEditMode = false;

function getGymTemplates() {
  const t = storeGet('gym_templates_v1');
  if (!t) {
    storeSet('gym_templates_v1', DEFAULT_GYM_TEMPLATES);
    return DEFAULT_GYM_TEMPLATES;
  }
  return t;
}

function saveGymTemplates(t) {
  storeSet('gym_templates_v1', t);
  document.dispatchEvent(new CustomEvent('gym-changed'));
}

function getGymWorkouts() {
  return storeGet('gym_workouts_v1') || [];
}

function saveGymWorkouts(w) {
  storeSet('gym_workouts_v1', w);
  document.dispatchEvent(new CustomEvent('gym-changed'));
}

function getGymActive() {
  return storeGet('gym_active_v1');
}

function saveGymActive(a) {
  storeSet('gym_active_v1', a);
  renderGymHeader(); // Dynamic update
}

function initGymTracker() {
  const active = getGymActive();
  const templates = getGymTemplates();
  const workouts = getGymWorkouts();
  const today = new Date().toLocaleDateString('en-CA');
  
  if (active) {
    gymActiveSplit = active.split;
  } else {
    // Select first unfinished split for today
    const todayWorkouts = workouts.filter(w => w.date === today && w.finished);
    const doneIds = todayWorkouts.map(w => w.split);
    const next = GYM_SPLITS.find(s => !doneIds.includes(s.id)) || GYM_SPLITS[0];
    gymActiveSplit = next.id;
  }
  
  renderGymHeader();
  renderGymSplit();
  renderGymWorkout();
  renderGymHistory();
  
  document.addEventListener('gym-changed', () => {
    renderGymHeader();
    renderGymSplit();
    renderGymWorkout();
    renderGymHistory();
  });

  document.getElementById('gymHistoryToggle').addEventListener('click', () => {
    const content = document.getElementById('gymHistoryContent');
    const chevron = document.getElementById('gymHistoryChevron');
    const isOpen = content.style.display === 'block';
    content.style.display = isOpen ? 'none' : 'block';
    chevron.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
    if (!isOpen) renderGymHistory();
  });
}

function renderGymHeader() {
  const workouts = getGymWorkouts();
  const active = getGymActive();
  const today = new Date().toLocaleDateString('en-CA');
  
  // Current week progress
  const now = new Date();
  const day = now.getDay(); 
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); 
  const monday = new Date(now.setDate(diff));
  monday.setHours(0,0,0,0);
  
  const weekWorkouts = workouts.filter(w => new Date(w.date) >= monday && w.finished);
  const doneSplits = [...new Set(weekWorkouts.map(w => w.split))];
  const doneCount = doneSplits.length;
  
  const pct = Math.round((doneCount / 5) * 100);
  const fill = document.getElementById('gymRingFill');
  const C = 301.5928;
  if (fill) {
    fill.style.strokeDashoffset = C * (1 - doneCount/5);
    fill.style.stroke = doneCount === 5 ? 'var(--success)' : 'var(--gym-primary)';
  }
  
  if (document.getElementById('gymHdrPct')) document.getElementById('gymHdrPct').textContent = `${pct}%`;
  if (document.getElementById('gymHdrStat')) document.getElementById('gymHdrStat').textContent = `${doneCount} of 5`;
  
  let totalVol = 0;
  if (active && active.date === today) {
    totalVol = calcSessionVolume(active);
  }
  if (document.getElementById('gymHdrVolume')) document.getElementById('gymHdrVolume').textContent = `${totalVol.toLocaleString()} kg total volume`;
  
  const lastFinished = workouts.filter(w => w.finished).sort((a,b) => b.createdAt - a.createdAt)[0];
  if (document.getElementById('gymHdrLast')) {
    document.getElementById('gymHdrLast').textContent = lastFinished ? `Last: ${new Date(lastFinished.date).toLocaleDateString('en-US', {month:'short', day:'numeric'})} (${lastFinished.split.toUpperCase()})` : 'Last: —';
  }

  const dots = document.getElementById('gymWeekDots');
  if (dots) {
    dots.innerHTML = '';
    GYM_SPLITS.forEach(s => {
      const dot = document.createElement('div');
      dot.className = `bjj-dot ${doneSplits.includes(s.id) ? 'done' : ''}`;
      if (doneSplits.includes(s.id)) {
        dot.style.background = s.color;
        dot.style.boxShadow = `0 0 8px ${s.color}`;
      }
      dots.appendChild(dot);
    });
  }
  
  const weekEnd = new Date(monday);
  weekEnd.setDate(monday.getDate() + 6);
  if (document.getElementById('gymWeekLabelMini')) {
    document.getElementById('gymWeekLabelMini').textContent = `This Week: ${monday.toLocaleDateString('en-US', {month:'short', day:'numeric'})} – ${weekEnd.toLocaleDateString('en-US', {month:'short', day:'numeric'})}`;
  }
}

function renderGymSplit() {
  const strip = document.getElementById('gymSplitStrip');
  if (!strip) return;
  
  const workouts = getGymWorkouts();
  const today = new Date().toLocaleDateString('en-CA');
  
  const now = new Date();
  const monday = new Date(now.setDate(now.getDate() - (now.getDay() || 7) + 1));
  monday.setHours(0,0,0,0);
  const weekWorkouts = workouts.filter(w => new Date(w.date) >= monday && w.finished);
  const doneSplits = [...new Set(weekWorkouts.map(w => w.split))];
  const doneCount = doneSplits.length;

  strip.innerHTML = '';
  GYM_SPLITS.forEach(s => {
    const pill = document.createElement('button');
    pill.className = `gym-day-pill ${gymActiveSplit === s.id ? 'active' : ''}`;
    pill.style.setProperty('--gym-day-color', s.color);
    pill.style.setProperty('--gym-day-rgb', s.rgb);
    pill.style.setProperty('--gym-day-color-glow', s.glow);
    
    pill.innerHTML = `
      <div class="gym-day-lbl">${s.name.toUpperCase()}</div>
      <div class="gym-day-dot ${doneSplits.includes(s.id) ? 'done' : ''}"></div>
    `;
    pill.onclick = () => {
      gymActiveSplit = s.id;
      gymEditMode = false;
      renderGymSplit();
      renderGymWorkout();
    };
    strip.appendChild(pill);
  });
  
  const countEl = document.getElementById('gymWeekCount');
  if (countEl) {
    countEl.textContent = `${doneSplits.length}/5 done`;
    if (doneSplits.length === 5) countEl.style.color = 'var(--success)';
  }
  
  const weekEnd = new Date(monday);
  weekEnd.setDate(monday.getDate() + 6);
  if (document.getElementById('gymWeekRange')) {
    document.getElementById('gymWeekRange').textContent = `This Week · ${monday.toLocaleDateString('en-US', {month:'short', day:'numeric'})} – ${weekEnd.toLocaleDateString('en-US', {month:'short', day:'numeric'})}`;
  }
}

function renderGymWorkout() {
  const container = document.getElementById('gymWorkoutCard');
  if (!container) return;
  
  const split = GYM_SPLITS.find(s => s.id === gymActiveSplit);
  const today = new Date().toLocaleDateString('en-CA');
  const templates = getGymTemplates();
  const workouts = getGymWorkouts();
  
  let session = getGymActive();
  if (!session || session.split !== gymActiveSplit || session.date !== today) {
    const finishedToday = workouts.find(w => w.split === gymActiveSplit && w.date === today && w.finished);
    if (finishedToday) {
      session = finishedToday;
    } else {
      const template = templates[gymActiveSplit] || [];
      session = {
        id: (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : Date.now().toString(),
        split: gymActiveSplit,
        date: today,
        exercises: template.map(t => ({
          name: t.name,
          muscle: t.muscle,
          sets: Array.from({length: t.defaultSets}, () => ({ weight: null, reps: null, done: false }))
        })),
        notes: '',
        finished: false,
        totalVolume: 0,
        createdAt: Date.now()
      };
      saveGymActive(session);
    }
  }

  if (gymEditMode) {
    renderGymEditMode(container, session, templates[gymActiveSplit]);
    return;
  }

  const prevSession = workouts.filter(w => w.split === gymActiveSplit && w.finished && w.id !== session.id).sort((a,b) => b.createdAt - a.createdAt)[0];
  const sessionVol = calcSessionVolume(session);
  const prevVol = prevSession ? calcSessionVolume(prevSession) : 0;
  
  let deltaHtml = '';
  if (prevVol > 0) {
    const diff = sessionVol - prevVol;
    const pct = ((diff / prevVol) * 100).toFixed(1);
    const color = diff >= 0 ? 'var(--gym-up)' : 'var(--gym-down)';
    deltaHtml = `<div class="gym-vol-delta" style="color: ${color}">${diff >= 0 ? '▲' : '▼'} ${Math.abs(diff).toLocaleString()} kg (${pct}%)</div>`;
  } else {
    deltaHtml = `<div class="gym-vol-delta" style="color: var(--text-tertiary)">— first session</div>`;
  }

  container.innerHTML = `
    <div class="gym-workout-header">
      <div>
        <div class="gym-split-title" style="color: ${split.color}">${split.name} Day</div>
        <div class="gym-workout-date">${new Date(session.date).toLocaleDateString('en-US', {weekday:'short', month:'short', day:'numeric'})}</div>
      </div>
      <div class="gym-vol-summary">
        <div class="gym-vol-main">${sessionVol.toLocaleString()} kg</div>
        ${deltaHtml}
      </div>
      <div class="gym-edit-toggle" onclick="toggleGymEdit()">✏️</div>
    </div>
    <div id="gymExList" style="display: flex; flex-direction: column; gap: 10px;"></div>
    <div style="margin-top: 14px;">
      <div id="gymNotesToggle" class="gym-add-btn" style="display: ${session.notes ? 'none' : 'block'}">+ Add notes</div>
      <textarea id="gymNotes" class="gm-input" style="display: ${session.notes ? 'block' : 'none'}; width: 100%; height: 60px; margin-top: 8px; font-size: 11px;" placeholder="Session notes...">${session.notes}</textarea>
    </div>
    ${!session.finished ? `
      <button id="gymFinishBtn" class="gm-btn-primary" style="width: 100%; margin-top: 20px; font-weight: 700;">Finish ${split.name} Day ✓</button>
    ` : `
      <div style="text-align: center; margin-top: 20px; color: var(--success); font-size: 12px; font-weight: 600;">Workout Finished! 🎉</div>
    `}
  `;

  const exList = container.querySelector('#gymExList');
  session.exercises.forEach((ex, exIdx) => {
    const exDiv = document.createElement('div');
    exDiv.className = 'gym-exercise';
    const lastEx = prevSession ? prevSession.exercises.find(e => e.name === ex.name) : null;
    const lastBest = lastEx ? findBestSet(lastEx.sets) : null;
    const allTimeBestVal = getAllTimeBest(ex.name);
    const currBest = findBestSet(ex.sets);
    const isPR = !session.finished && currBest && allTimeBestVal > 0 && currBest.vol > allTimeBestVal;
    const currExVol = calcExVolume(ex);
    const lastExVol = lastEx ? calcExVolume(lastEx) : 0;
    let exDelta = '';
    if (lastExVol > 0) {
      const diff = currExVol - lastExVol;
      exDelta = `<span style="color: ${diff > 0 ? 'var(--gym-up)' : diff < 0 ? 'var(--gym-down)' : 'var(--gym-same)'}">${diff > 0 ? '▲' : diff < 0 ? '▼' : '='}</span>`;
    }

    exDiv.innerHTML = `
      <div class="gym-ex-header">
        <div class="gym-ex-name-row">
          <div class="gym-ex-name">${ex.name}</div>
          <div class="gym-ex-muscle">${ex.muscle}</div>
          ${isPR ? `<div class="gym-pr-badge">PR 🏆</div>` : ''}
        </div>
        <div style="display: flex; flex-direction: column; align-items: flex-end;">
          <div class="gym-ex-prev">${lastBest ? `Last: ${lastBest.w}kg × ${lastBest.r}` : 'New exercise'}</div>
          <div class="gym-ex-prev" style="margin-top: 2px;">${exDelta}</div>
        </div>
      </div>
      <table class="gym-set-table">
        <thead>
          <tr>
            <th class="gym-set-cell gym-set-num">#</th>
            <th class="gym-set-cell gym-set-prev">Previous</th>
            <th class="gym-set-cell gym-set-input-cell">Weight</th>
            <th class="gym-set-cell gym-set-input-cell">Reps</th>
            <th class="gym-set-cell gym-set-vol">Vol</th>
            <th class="gym-set-cell gym-set-check">✓</th>
          </tr>
        </thead>
        <tbody id="ex-${exIdx}-sets"></tbody>
      </table>
      ${!session.finished ? `<div class="gym-add-btn" onclick="addGymSet(${exIdx})">+ Add Set</div>` : ''}
    `;
    
    const tbody = exDiv.querySelector('tbody');
    ex.sets.forEach((set, sIdx) => {
      const tr = document.createElement('tr');
      tr.className = `gym-set-row ${set.done ? 'done' : ''}`;
      const lastSet = lastEx && lastEx.sets[sIdx] ? lastEx.sets[sIdx] : null;
      const vol = (set.weight && set.reps) ? (set.weight * set.reps) : 0;
      
      tr.innerHTML = `
        <td class="gym-set-cell gym-set-num">${sIdx + 1}</td>
        <td class="gym-set-cell gym-set-prev">${lastSet ? `${lastSet.weight}kg × ${lastSet.reps}` : '—'}</td>
        <td class="gym-set-cell">
          <input type="number" class="gym-set-input" value="${set.weight || ''}" placeholder="kg" step="0.5" ${session.finished ? 'disabled' : ''}>
        </td>
        <td class="gym-set-cell">
          <input type="number" class="gym-set-input" value="${set.reps || ''}" placeholder="reps" ${session.finished ? 'disabled' : ''}>
        </td>
        <td class="gym-set-cell gym-set-vol">${vol ? vol.toLocaleString() : '—'}</td>
        <td class="gym-set-cell gym-set-check">
          <input type="checkbox" ${set.done ? 'checked' : ''} ${session.finished ? 'disabled' : ''}>
        </td>
      `;
      
      const inputs = tr.querySelectorAll('input');
      inputs[0].oninput = (e) => updateGymSet(exIdx, sIdx, 'weight', parseFloat(e.target.value));
      inputs[1].oninput = (e) => updateGymSet(exIdx, sIdx, 'reps', parseInt(e.target.value));
      inputs[2].onchange = (e) => updateGymSet(exIdx, sIdx, 'done', e.target.checked);
      tbody.appendChild(tr);
    });
    exList.appendChild(exDiv);
  });

  const finishBtn = container.querySelector('#gymFinishBtn');
  if (finishBtn) finishBtn.onclick = () => finishGymWorkout(session);

  const notesToggle = container.querySelector('#gymNotesToggle');
  const notesArea = container.querySelector('#gymNotes');
  if (notesToggle) {
    notesToggle.onclick = () => {
      notesToggle.style.display = 'none';
      notesArea.style.display = 'block';
      notesArea.focus();
    };
    notesArea.onblur = () => {
      session.notes = notesArea.value;
      saveGymActive(session);
    };
  }
}

function renderGymEditMode(container, session, template) {
  const split = GYM_SPLITS.find(s => s.id === gymActiveSplit);
  container.innerHTML = `
    <div class="gym-workout-header">
      <div class="gym-split-title" style="color: var(--gym-primary)">Editing: ${split.name} Day</div>
      <button class="gm-btn-primary" style="padding: 6px 16px; font-size: 11px;" onclick="saveGymTemplateChanges()">Done</button>
    </div>
    <div id="gymEditList" style="display: flex; flex-direction: column; gap: 8px;"></div>
    <div class="gym-exercise" style="border: 1px dashed rgba(255,255,255,0.1); text-align: center; padding: 12px; cursor: pointer; color: var(--text-tertiary); font-size: 11px;" onclick="addGymTemplateEx()">
      + Add Exercise
    </div>
  `;

  const editList = container.querySelector('#gymEditList');
  template.forEach((ex, idx) => {
    const div = document.createElement('div');
    div.className = 'gym-edit-row';
    div.innerHTML = `
      <div class="gym-drag-handle">⋮⋮</div>
      <input type="text" class="gym-set-input" style="flex: 2; text-align: left; padding-left: 8px;" value="${ex.name}" onchange="updateGymTemplateField(${idx}, 'name', this.value)">
      <input type="text" class="gym-set-input" style="flex: 1; text-align: left; font-size: 10px;" value="${ex.muscle}" placeholder="muscle" onchange="updateGymTemplateField(${idx}, 'muscle', this.value)">
      <input type="number" class="gym-set-input" style="width: 40px;" value="${ex.defaultSets}" onchange="updateGymTemplateField(${idx}, 'defaultSets', parseInt(this.value))">
      <div style="font-size: 12px; cursor: pointer; color: var(--text-tertiary); padding: 4px;" onclick="deleteGymTemplateEx(${idx})">×</div>
    `;
    editList.appendChild(div);
  });
}

function toggleGymEdit() {
  gymEditMode = !gymEditMode;
  renderGymWorkout();
}

function updateGymSet(exIdx, sIdx, field, val) {
  const session = getGymActive();
  session.exercises[exIdx].sets[sIdx][field] = val;
  saveGymActive(session);
  renderGymWorkout();
}

function addGymSet(exIdx) {
  const session = getGymActive();
  session.exercises[exIdx].sets.push({ weight: null, reps: null, done: false });
  saveGymActive(session);
  renderGymWorkout();
}

function finishGymWorkout(session) {
  session.finished = true;
  session.totalVolume = calcSessionVolume(session);
  session.createdAt = Date.now();
  const workouts = getGymWorkouts();
  workouts.push(session);
  saveGymWorkouts(workouts);
  localStorage.removeItem('gym_active_v1');
  renderGymSplit();
  renderGymWorkout();
}

function calcExVolume(ex) {
  return ex.sets.reduce((sum, s) => sum + (s.weight || 0) * (s.reps || 0), 0);
}

function calcSessionVolume(session) {
  return session.exercises.reduce((sum, ex) => sum + calcExVolume(ex), 0);
}

function findBestSet(sets) {
  let best = null;
  sets.forEach(s => {
    const vol = (s.weight || 0) * (s.reps || 0);
    if (!best || vol > best.vol) {
      best = { w: s.weight, r: s.reps, vol };
    }
  });
  return best && best.vol > 0 ? best : null;
}

function getAllTimeBest(exName) {
  const workouts = getGymWorkouts();
  let best = 0;
  workouts.forEach(w => {
    const ex = w.exercises.find(e => e.name === exName);
    if (ex) {
      ex.sets.forEach(s => {
        const vol = (s.weight || 0) * (s.reps || 0);
        if (vol > best) best = vol;
      });
    }
  });
  return best;
}

function renderGymHistory() {
  const select = document.getElementById('gymHistoryExercise');
  if (!select) return;
  
  const workouts = getGymWorkouts();
  const allExercises = [...new Set(workouts.flatMap(w => w.exercises.map(e => e.name)))].sort();
  const currentVal = select.value;
  select.innerHTML = allExercises.map(ex => `<option value="${ex}" ${ex === currentVal ? 'selected' : ''}>${ex}</option>`).join('');
  
  if (allExercises.length === 0) {
    document.getElementById('gymHistoryTableContainer').innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-tertiary); font-style:italic;">No workouts logged yet.</div>';
    return;
  }
  
  const exName = select.value || allExercises[0];
  const history = workouts.filter(w => w.exercises.some(e => e.name === exName)).sort((a,b) => b.createdAt - a.createdAt);
  
  let html = `<table class="gym-history-table">`;
  history.forEach((w, idx) => {
    const ex = w.exercises.find(e => e.name === exName);
    const best = findBestSet(ex.sets);
    const vol = calcExVolume(ex);
    const split = GYM_SPLITS.find(s => s.id === w.split);
    let deltaHtml = '—';
    if (idx < history.length - 1) {
      const prevW = history[idx + 1];
      const prevEx = prevW.exercises.find(e => e.name === exName);
      const prevVol = calcExVolume(prevEx);
      const diff = vol - prevVol;
      deltaHtml = `<span style="color: ${diff > 0 ? 'var(--gym-up)' : diff < 0 ? 'var(--gym-down)' : 'var(--gym-same)'}">${diff > 0 ? '▲' : diff < 0 ? '▼' : ''} ${Math.abs(diff)}</span>`;
    }
    html += `<tr class="gym-history-row"><td class="gym-history-cell">${new Date(w.date).toLocaleDateString('en-US', {month:'short', day:'numeric'})}</td><td class="gym-history-cell"><span style="color:${split.color}">${w.split.toUpperCase()}</span></td><td class="gym-history-cell">${ex.sets.length}s</td><td class="gym-history-cell">${best ? `${best.w}×${best.r}` : '—'}</td><td class="gym-history-cell">${vol.toLocaleString()}</td><td class="gym-history-cell">${deltaHtml}</td></tr>`;
  });
  html += `</table>`;
  document.getElementById('gymHistoryTableContainer').innerHTML = html;
  renderGymSparkline(history.slice().reverse(), exName);
  select.onchange = () => renderGymHistory();
}

function renderGymSparkline(history, exName) {
  const container = document.getElementById('gymHistorySparkline');
  if (history.length < 3) {
    container.innerHTML = '';
    return;
  }
  const data = history.map(w => calcExVolume(w.exercises.find(e => e.name === exName)));
  const max = Math.max(...data), min = Math.min(...data), range = max - min || 1;
  const split = GYM_SPLITS.find(s => s.id === history[history.length-1].split);
  const w = 240, h = 40;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ');
  container.innerHTML = `<div style="font-size: 10px; color: var(--text-tertiary); margin-bottom: 6px;">Volume Trend</div><svg width="100%" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="${split.color}" stroke-width="1.5" /><path d="M 0,${h} L ${pts} L ${w},${h} Z" fill="${split.color}" fill-opacity="0.08" /></svg>`;
}

function updateGymTemplateField(idx, field, val) {
  const t = getGymTemplates();
  t[gymActiveSplit][idx][field] = val;
  storeSet('gym_templates_v1', t);
}

function addGymTemplateEx() {
  const t = getGymTemplates();
  t[gymActiveSplit].push({ name: 'New Exercise', muscle: '', defaultSets: 3 });
  saveGymTemplates(t);
  renderGymWorkout();
}

function deleteGymTemplateEx(idx) {
  const t = getGymTemplates();
  t[gymActiveSplit].splice(idx, 1);
  saveGymTemplates(t);
  renderGymWorkout();
}

function saveGymTemplateChanges() {
  gymEditMode = false;
  renderGymWorkout();
}

// Finance Logic
const FIN_CATS = [
  { id: 'bus_ads', label: 'Business — Ads & Marketing', color: '#7B9EFF' },
  { id: 'bus_inv', label: 'Business — Inventory', color: '#6BE3A4' },
  { id: 'bus_tools', label: 'Business — Tools & Software', color: '#F2C063' },
  { id: 'bus_other', label: 'Business — Other', color: '#A78BFA' },
  { id: 'per_rent', label: 'Personal — Rent & Bills', color: '#FF6B6B' },
  { id: 'per_food', label: 'Personal — Food & Groceries', color: '#FF9F43' },
  { id: 'per_fit', label: 'Personal — Fitness & Health', color: '#4ECDC4' },
  { id: 'per_fun', label: 'Personal — Fun & Social', color: '#F78DA7' },
  { id: 'other', label: 'Other / Uncategorized', color: '#76746E' }
];

const finCategorySelect = document.getElementById('txnCategory');
FIN_CATS.forEach(c => {
  let opt = document.createElement('option');
  opt.value = c.id;
  opt.textContent = c.label;
  finCategorySelect.appendChild(opt);
});

// Default Date
document.getElementById('txnDate').value = new Date().toLocaleDateString('en-CA');

const fmt = (cents) => {
  const sign = cents < 0 ? '-' : '';
  const val = Math.abs(cents) / 100;
  return sign + '$' + val.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const parseDollars = (str) => {
  const clean = str.replace(/[$,]/g, '');
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : Math.round(parsed * 100);
};

let currentPeriod = 'daily';
let periodOffset = 0;

const getPeriodRange = (period, offset) => {
  const now = new Date();
  if (period === 'daily') {
    now.setDate(now.getDate() + offset);
    const dateStr = now.toLocaleDateString('en-CA');
    const opts = { weekday: 'short', month: 'short', day: 'numeric' };
    const label = offset === 0 ? `Today — ${now.toLocaleDateString('en-US', opts)}` : 
                  offset === -1 ? `Yesterday — ${now.toLocaleDateString('en-US', opts)}` :
                  now.toLocaleDateString('en-US', opts);
    return { start: dateStr, end: dateStr, label };
  } else if (period === 'weekly') {
    const dayOfWeek = now.getDay() || 7;
    now.setDate(now.getDate() - dayOfWeek + 1 + (offset * 7));
    const startD = new Date(now);
    const endD = new Date(now);
    endD.setDate(startD.getDate() + 6);
    const label = offset === 0 ? `This week — ${startD.toLocaleDateString('en-US',{month:'short',day:'numeric'})} – ${endD.toLocaleDateString('en-US',{month:'short',day:'numeric'})}` : 
                  `${startD.toLocaleDateString('en-US',{month:'short',day:'numeric'})} – ${endD.toLocaleDateString('en-US',{month:'short',day:'numeric'})}`;
    return { start: startD.toLocaleDateString('en-CA'), end: endD.toLocaleDateString('en-CA'), label };
  } else if (period === 'monthly') {
    now.setMonth(now.getMonth() + offset);
    now.setDate(1);
    const startD = new Date(now);
    const endD = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const label = startD.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    return { start: startD.toLocaleDateString('en-CA'), end: endD.toLocaleDateString('en-CA'), label };
  }
};

const getAllTxns = () => storeGet('finance_txns') || [];
const saveTxns = (arr) => { storeSet('finance_txns', arr); window.dispatchEvent(new CustomEvent('finance-changed')); };

document.querySelectorAll('.period-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('is-active'));
    e.target.classList.add('is-active');
    currentPeriod = e.target.dataset.period;
    periodOffset = 0;
    renderAll();
  });
});

document.getElementById('periodPrev').addEventListener('click', () => {
  const max = currentPeriod === 'daily' ? -12 : currentPeriod === 'weekly' ? -8 : -6;
  if (periodOffset > max) { periodOffset--; renderAll(); }
});

document.getElementById('periodNext').addEventListener('click', () => {
  if (periodOffset < 0) { periodOffset++; renderAll(); }
});

let activeTxnType = 'income';
document.querySelectorAll('.fin-type-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.fin-type-btn').forEach(b => {
      b.classList.remove('active-inc'); b.classList.remove('active-exp');
    });
    activeTxnType = e.target.dataset.val;
    e.target.classList.add(activeTxnType === 'income' ? 'active-inc' : 'active-exp');
    document.getElementById('txnSource').style.display = activeTxnType === 'income' ? 'block' : 'none';
    document.getElementById('txnCategory').style.display = activeTxnType === 'expense' ? 'block' : 'none';
  });
});

document.getElementById('txnAddBtn').addEventListener('click', addTxn);
document.getElementById('txnDesc').addEventListener('keydown', e => { if(e.key === 'Enter') addTxn(); });
document.getElementById('txnAmount').addEventListener('keydown', e => { if(e.key === 'Enter') addTxn(); });

function addTxn() {
  const amtStr = document.getElementById('txnAmount').value;
  const desc = document.getElementById('txnDesc').value.trim();
  const date = document.getElementById('txnDate').value;
  const cents = parseDollars(amtStr);
  
  if (cents <= 0 || !desc || !date) return alert('Enter valid amount, description, and date.');
  
  const txns = getAllTxns();
  txns.unshift({
    id: Date.now().toString(),
    type: activeTxnType,
    amountCents: cents,
    description: desc,
    source: document.getElementById('txnSource').value,
    category: document.getElementById('txnCategory').value,
    date: date,
    createdAt: Date.now()
  });
  
  saveTxns(txns);
  document.getElementById('txnAmount').value = '';
  document.getElementById('txnDesc').value = '';
}

function renderAll() {
  const { start, end, label } = getPeriodRange(currentPeriod, periodOffset);
  document.getElementById('periodLabel').textContent = label;
  document.getElementById('periodNext').disabled = (periodOffset === 0);
  
  const txns = getAllTxns();
  const currentFiltered = txns.filter(t => t.date >= start && t.date <= end);
  
  const prevRange = getPeriodRange(currentPeriod, periodOffset - 1);
  const prevFiltered = txns.filter(t => t.date >= prevRange.start && t.date <= prevRange.end);
  
  renderSummaryCards(currentFiltered, prevFiltered);
  renderDonut(currentFiltered);
  renderTxnList(currentFiltered);
  renderTicker(currentFiltered, prevFiltered);
}

function renderSummaryCards(curr, prev) {
  const currInc = curr.filter(t => t.type === 'income').reduce((s, t) => s + t.amountCents, 0);
  const prevInc = prev.filter(t => t.type === 'income').reduce((s, t) => s + t.amountCents, 0);
  
  const currExp = curr.filter(t => t.type === 'expense').reduce((s, t) => s + t.amountCents, 0);
  const prevExp = prev.filter(t => t.type === 'expense').reduce((s, t) => s + t.amountCents, 0);
  
  const net = currInc - currExp;
  
  document.getElementById('incomeTotal').textContent = fmt(currInc);
  document.getElementById('expenseTotal').textContent = fmt(currExp);
  document.getElementById('netTotal').textContent = fmt(net);
  document.getElementById('netTotal').style.color = net > 0 ? 'var(--income)' : net < 0 ? 'var(--expense)' : 'var(--text-tertiary)';
  
  document.getElementById('incomeTrend').innerHTML = getTrendHtml(currInc, prevInc, false);
  document.getElementById('expenseTrend').innerHTML = getTrendHtml(currExp, prevExp, true);
  
  const saveRate = currInc > 0 ? Math.max(0, Math.round((net / currInc) * 100)) : (net < 0 ? 0 : '—');
  document.getElementById('savingsRate').textContent = `Savings rate: ${saveRate}${saveRate === '—' ? '' : '%'}`;
  document.getElementById('txnCount').textContent = `${curr.length} transaction${curr.length===1?'':'s'} this period`;
  
  // Breakdown Income
  const incGroups = {};
  curr.filter(t => t.type === 'income').forEach(t => { incGroups[t.source] = (incGroups[t.source] || 0) + t.amountCents; });
  let incList = Object.entries(incGroups).sort((a,b) => b[1] - a[1]).slice(0,4);
  document.getElementById('incomeBreakdown').innerHTML = incList.map(([src, amt]) => `<div class="fin-mini-row"><span>${src}</span><span>${fmt(amt)}</span></div>`).join('');
  
  // Breakdown Expenses
  const expGroups = {};
  curr.filter(t => t.type === 'expense').forEach(t => { expGroups[t.category] = (expGroups[t.category] || 0) + t.amountCents; });
  let expList = Object.entries(expGroups).sort((a,b) => b[1] - a[1]).slice(0,4);
  document.getElementById('expenseBreakdown').innerHTML = expList.map(([catId, amt]) => {
    let catOpt = FIN_CATS.find(c => c.id === catId);
    let name = catOpt ? catOpt.label.split(' — ')[1] || catOpt.label : catId;
    return `<div class="fin-mini-row"><span>${name}</span><span>${fmt(amt)}</span></div>`;
  }).join('');
}

function getTrendHtml(curr, prev, inverted) {
  if(prev === 0 && curr === 0) return '— no prior data';
  if(prev === 0 && curr > 0) return `<span style="color: ${inverted?'var(--expense)':'var(--income)'}">▲ new</span>`;
  let pct = ((curr - prev) / prev) * 100;
  let abs = Math.round(Math.abs(pct));
  if(pct > 0) return `<span style="color: ${inverted?'var(--expense)':'var(--income)'}">▲ ${abs}% vs last period</span>`;
  if(pct < 0) return `<span style="color: ${inverted?'var(--income)':'var(--expense)'}">▼ ${abs}% vs last period</span>`;
  return `— 0% vs last period`;
}

function renderDonut(curr) {
  const exps = curr.filter(t => t.type === 'expense');
  const total = exps.reduce((s,t) => s + t.amountCents, 0);
  document.getElementById('donutTotal').textContent = fmt(total);
  
  const groups = {};
  exps.forEach(t => { groups[t.category] = (groups[t.category] || 0) + t.amountCents; });
  
  const sorted = Object.entries(groups).sort((a,b) => b[1] - a[1]);
  const svg = document.getElementById('donutSvg');
  const leg = document.getElementById('donutLegend');
  
  svg.innerHTML = '<circle class="fin-donut-track" cx="60" cy="60" r="46"></circle>';
  leg.innerHTML = '';
  
  if(total === 0) {
    leg.innerHTML = '<div style="font-size:12px; color:var(--text-tertiary); text-align:center; padding-top:20px;">No expenses</div>';
    return;
  }
  
  const C = 2 * Math.PI * 46;
  let offsetAcc = 0;
  
  sorted.forEach(([catId, amt], i) => {
    let catOpt = FIN_CATS.find(c => c.id === catId);
    let color = catOpt ? catOpt.color : '#76746E';
    let name = catOpt ? catOpt.label : catId;
    
    let ratio = amt / total;
    let segLen = ratio * C;
    let gap = 2; // small gap
    if(segLen < gap) segLen = gap; 
    
    let circ = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circ.setAttribute('class', 'fin-donut-segment');
    circ.setAttribute('cx', '60');
    circ.setAttribute('cy', '60');
    circ.setAttribute('r', '46');
    circ.setAttribute('stroke', color);
    circ.setAttribute('stroke-dasharray', `${segLen - gap} ${C - (segLen - gap)}`);
    circ.setAttribute('stroke-dashoffset', -offsetAcc);
    svg.appendChild(circ);
    
    offsetAcc += segLen;
    
    let lRow = document.createElement('div');
    lRow.className = 'fin-legend-row';
    lRow.innerHTML = `
      <div class="fin-legend-swatch" style="background:${color}"></div>
      <div class="fin-legend-name">${name}</div>
      <div class="fin-legend-amount">${fmt(amt)}</div>
      <div class="fin-legend-pct">${Math.round(ratio*100)}%</div>
    `;
    lRow.addEventListener('mouseenter', () => circ.classList.add('pulse'));
    lRow.addEventListener('mouseleave', () => circ.classList.remove('pulse'));
    leg.appendChild(lRow);
  });
}

function renderTxnList(curr) {
  const list = document.getElementById('txnList');
  list.innerHTML = '';
  
  if(curr.length === 0) {
    list.innerHTML = '<div style="font-size: 12px; color: var(--text-tertiary); text-align: center; font-style: italic; padding: 14px 0;">No transactions recorded yet — add one above.</div>';
    return;
  }
  
  const nowStr = new Date().toLocaleDateString('en-CA');
  
  curr.forEach((t, idx) => {
    if(idx >= 10) return; // simple limit
    
    let isInc = t.type === 'income';
    let color = isInc ? 'var(--income)' : 'var(--expense)';
    
    let tagText = isInc ? t.source : (FIN_CATS.find(c=>c.id === t.category)?.label.split(' — ')[1] || t.category);
    let tagColor = isInc ? 'var(--income)' : (FIN_CATS.find(c=>c.id === t.category)?.color || 'var(--text-secondary)');
    
    let dStr = t.date === nowStr ? 'Today' : new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    let li = document.createElement('li');
    li.className = 'fin-txn-row';
    li.innerHTML = `
      <div class="fin-txn-type-bar" style="background: ${color}"></div>
      <div class="fin-txn-desc" onclick="editTxn('${t.id}')">${t.description}</div>
      <div class="fin-txn-tag" style="color:${tagColor}; background:color-mix(in srgb, ${tagColor} 10%, transparent);">${tagText}</div>
      <div class="fin-txn-amount" style="color: ${color}">${isInc ? '+' : '-'}${fmt(t.amountCents)}</div>
      <div class="fin-txn-date">${dStr}</div>
      <button class="txn-del" onclick="delTxn('${t.id}')">×</button>
    `;
    list.appendChild(li);
  });
}

window.delTxn = function(id) {
  let txns = getAllTxns();
  txns = txns.filter(t => t.id !== id);
  saveTxns(txns);
}

window.editTxn = function(id) {
  let newDesc = prompt("Edit description:");
  if(newDesc) {
    let txns = getAllTxns();
    let txn = txns.find(t => t.id === id);
    if(txn) {
      txn.description = newDesc;
      saveTxns(txns);
    }
  }
}

// Ticker Logic
let tickerIndex = 0;
let tickerTimer;
function renderTicker(curr, prev) {
  clearTimeout(tickerTimer);
  
  const incs = curr.filter(t => t.type === 'income');
  const groups = {};
  incs.forEach(t => groups[t.source] = (groups[t.source]||0) + t.amountCents);
  
  const prevGroups = {};
  prev.filter(t => t.type === 'income').forEach(t => prevGroups[t.source] = (prevGroups[t.source]||0) + t.amountCents);
  
  const streams = Object.keys(groups).length > 0 ? Object.keys(groups) : ['—'];
  
  const net = curr.filter(t=>t.type==='income').reduce((s,t)=>s+t.amountCents,0) - curr.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amountCents,0);
  
  const meta = document.getElementById('netTickerMeta');
  meta.textContent = `NET ${fmt(net)}`;
  meta.className = 'net-ticker-meta ' + (net > 0 ? 'positive' : net < 0 ? 'negative' : '');
  
  function tick() {
    if(tickerIndex >= streams.length) tickerIndex = 0;
    const src = streams[tickerIndex];
    const amt = src === '—' ? 0 : groups[src];
    const pAmt = src === '—' ? 0 : (prevGroups[src] || 0);
    
    let dir = 'neutral';
    let dirChar = '·';
    if(amt > pAmt) { dir = 'up'; dirChar = '▲'; }
    if(amt < pAmt) { dir = 'down'; dirChar = '▼'; }
    
    const stage = document.getElementById('netTickerStage');
    
    const oldRow = stage.querySelector('.net-ticker-row-anim');
    if (oldRow) {
      oldRow.style.animation = 'ticker-leave 0.45s cubic-bezier(0.22, 1, 0.36, 1) forwards';
      setTimeout(() => oldRow.remove(), 450);
    }
    
    const row = document.createElement('div');
    row.className = 'net-ticker-row-anim';
    row.style.animation = 'ticker-enter 0.45s cubic-bezier(0.22, 1, 0.36, 1) forwards';
    
    row.innerHTML = `
      <span class="net-ticker-source">${src}</span>
      <span class="net-ticker-amount">${fmt(amt)}</span>
      <span class="net-ticker-delta" style="color: ${dir==='up'?'var(--income)':dir==='down'?'var(--expense)':'var(--text-tertiary)'}">${dirChar}</span>
    `;
    stage.appendChild(row);
    
    tickerIndex++;
    tickerTimer = setTimeout(tick, 5000);
  }
  
  tickerIndex = 0;
  tick();
}

window.addEventListener('finance-changed', renderAll);
renderAll();



