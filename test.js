const ANTHROPIC_API_KEY = '';
const WAKE_HOUR = 6;
const SLEEP_HOUR = 21;

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


// Tab Switching
document.querySelectorAll('.dash-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.dash-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.dash-view').forEach(v => v.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.target).classList.add('active');
  });
});

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


