import re

with open('dashboard.html', 'r') as f:
    text = f.read()

js_to_insert = """
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

"""
text = text.replace('</script>', js_to_insert + '\n</script>')

with open('dashboard.html', 'w') as f:
    f.write(text)
