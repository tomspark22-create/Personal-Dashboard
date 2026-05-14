import re

with open('dashboard.html', 'r') as f:
    text = f.read()

# 1. Insert CSS before </style>
css_to_insert = """
/* Tabs */
.dash-tabs {
  display: flex; gap: 8px; margin-bottom: 24px; justify-content: center;
  background: rgba(255,255,255,0.04); padding: 4px; border-radius: 12px;
}
.dash-tab {
  background: transparent; color: var(--text-secondary); border: none; padding: 6px 14px; border-radius: 8px; font-weight: 600; font-size: 13px; cursor: pointer; transition: all 0.2s ease;
}
.dash-tab.active {
  background: rgba(255,255,255,0.1); color: var(--text-primary); box-shadow: 0 2px 8px rgba(0,0,0,0.3);
}
.dash-view { display: none; }
.dash-view.active { display: block; }

/* Finance Variables */
:root {
  --income: #6BE3A4;
  --expense: #FF6B6B;
  --warning: #F2C063;
  --accent: #7B9EFF;
}

/* Period Toggle Bar */
.period-bar { display: flex; align-items: center; justify-content: center; margin-bottom: 14px; flex-wrap: wrap; gap: 8px; }
.period-toggle { display: inline-flex; background: rgba(255,255,255,0.04); border-radius: 10px; padding: 3px; gap: 2px; }
.period-btn { 
  font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 11px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.08em;
  padding: 7px 16px; border-radius: 8px; background: transparent; color: var(--text-tertiary); border: none; cursor: pointer; transition: all 0.25s ease;
}
.period-btn.is-active { background: rgba(255,255,255,0.10); color: var(--text-primary); box-shadow: 0 2px 8px rgba(0,0,0,0.3); }
.period-label { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 11px; color: var(--text-secondary); margin-left: 8px; display: flex; align-items: center; gap: 8px; }
.period-nav-btn { font-size: 18px; color: var(--text-tertiary); padding: 4px 6px; cursor: pointer; transition: color 0.2s; background: none; border: none; }
.period-nav-btn:hover { color: var(--text-primary); }
.period-nav-btn:disabled { opacity: 0.3; cursor: not-allowed; }

/* Net Flow Ticker */
.net-ticker {
  background: linear-gradient(180deg, rgba(20,20,22,0.8) 0%, rgba(10,10,12,0.8) 100%);
  border-radius: 12px; padding: 7px 12px; display: flex; align-items: center; gap: 10px; position: relative; overflow: hidden;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.04), 0 4px 12px rgba(0,0,0,0.3);
}
.net-ticker::before { content: ""; position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0,0,0,0.1) 1px, rgba(0,0,0,0.1) 2px); pointer-events: none; }
.net-ticker::after { content: ""; position: absolute; top: 0; left: -100%; width: 50%; height: 100%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.03), transparent); animation: sweep 8s infinite linear; pointer-events: none; }
.net-ticker-led { width: 7px; height: 7px; border-radius: 50%; background: var(--income); box-shadow: 0 0 8px var(--income); animation: pulse-led 1.6s infinite alternate; flex-shrink: 0; }
.net-ticker-label { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 9.5px; font-weight: 800; letter-spacing: 0.18em; color: var(--text-tertiary); flex-shrink: 0; }
.net-ticker-stage { flex: 1; height: 22px; position: relative; overflow: hidden; }
.net-ticker-row-anim { display: flex; align-items: center; gap: 12px; height: 22px; font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 12.5px; font-weight: 600; color: var(--text-primary); white-space: nowrap; position: absolute; top: 0; left: 0; right: 0; }
.net-ticker-source { text-transform: uppercase; letter-spacing: 0.08em; max-width: 120px; overflow: hidden; text-overflow: ellipsis; }
.net-ticker-amount { font-variant-numeric: tabular-nums; }
.net-ticker-delta { font-size: 10px; }
.net-ticker-meta { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 11px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--text-secondary); background: rgba(255,255,255,0.04); padding: 3px 8px; border-radius: 12px; flex-shrink: 0; }
.net-ticker-meta.positive { color: var(--income); background: rgba(107,227,164,0.10); }
.net-ticker-meta.negative { color: var(--expense); background: rgba(255,107,107,0.10); }

/* Summary Cards */
.fin-summary-row { display: flex; gap: 14px; margin-bottom: 24px; }
.fin-card { 
  flex: 1; background: rgba(255,255,255,0.04); backdrop-filter: blur(24px) saturate(1.2); -webkit-backdrop-filter: blur(24px) saturate(1.2);
  border-radius: 16px; padding: 18px 22px; box-shadow: 0 12px 40px rgba(0,0,0,0.45);
}
@media (max-width: 680px) { .fin-summary-row { flex-direction: column; } }
.fin-card-eyebrow { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 0.16em; color: var(--text-tertiary); margin-bottom: 8px; }
.fin-card-total { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 32px; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: -0.04em; margin-bottom: 4px; }
.fin-card-trend { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 11px; color: var(--text-secondary); margin-bottom: 12px; }
.fin-card-breakdown { display: flex; flex-direction: column; gap: 4px; }
.fin-mini-row { font-size: 11px; color: var(--text-tertiary); display: flex; justify-content: space-between; }

/* Donut Chart */
.fin-donut-container { display: flex; align-items: center; justify-content: center; gap: 26px; flex-wrap: wrap; }
.fin-donut-left { width: 180px; height: 180px; position: relative; flex-shrink: 0; }
.fin-donut-svg { width: 100%; height: 100%; transform: rotate(-90deg); }
.fin-donut-track { fill: none; stroke: rgba(255,255,255,0.06); stroke-width: 14; }
.fin-donut-segment { fill: none; stroke-width: 14; transition: stroke-dashoffset 0.7s cubic-bezier(0.22, 1, 0.36, 1); cursor: pointer; }
.fin-donut-segment.pulse { transform: scale(1.05); transform-origin: center; }
.fin-donut-overlay { position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: none; }
.fin-donut-total { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 22px; font-weight: 700; color: var(--text-primary); tabular-nums; letter-spacing: -0.02em; }
.fin-donut-label { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 9.5px; text-transform: uppercase; color: var(--text-tertiary); margin-top: 2px; }
.fin-donut-right { max-width: 320px; flex: 1; display: flex; flex-direction: column; gap: 6px; }
@media (max-width: 480px) { .fin-donut-left { width: 150px; height: 150px; } }
.fin-legend-row { display: flex; align-items: center; gap: 10px; padding: 4px 8px; border-radius: 8px; cursor: default; transition: background 0.2s; }
.fin-legend-row:hover { background: rgba(255,255,255,0.04); }
.fin-legend-swatch { width: 8px; height: 8px; border-radius: 2px; flex-shrink: 0; }
.fin-legend-name { font-size: 12px; color: var(--text-primary); font-weight: 600; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fin-legend-amount { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 12px; color: var(--text-secondary); tabular-nums; }
.fin-legend-pct { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 10px; color: var(--text-tertiary); width: 32px; text-align: right; }

/* Transaction Feed */
.fin-quick-add { border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 14px; margin-bottom: 14px; }
.fin-type-toggle { display: flex; background: rgba(255,255,255,0.04); border-radius: 8px; padding: 2px; }
.fin-type-btn { flex: 1; text-align: center; font-size: 11px; text-transform: uppercase; font-weight: 700; padding: 8px 14px; border-radius: 6px; border: none; background: transparent; color: var(--text-tertiary); cursor: pointer; transition: all 0.2s; }
.fin-type-btn.active-inc { background: rgba(107,227,164,0.15); color: var(--income); }
.fin-type-btn.active-exp { background: rgba(255,107,107,0.15); color: var(--expense); }
.fin-input-wrapper { position: relative; width: 100px; }
.fin-input-wrapper::before { content: "$"; position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-secondary); font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 13px; }
.fin-input-wrapper input { padding-left: 24px; width: 100%; }
.fin-select { -webkit-appearance: none; appearance: none; background: rgba(255,255,255,0.04); color: var(--text-primary); border: 1px solid rgba(255,255,255,0.10); padding: 8px 14px; border-radius: 20px; font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 11px; text-transform: uppercase; cursor: pointer; }
.fin-txn-row { display: flex; align-items: center; padding: 12px 14px; margin-bottom: 6px; background: rgba(255,255,255,0.035); border-radius: 12px; border: 1px solid rgba(255,255,255,0.06); position: relative; transition: background 0.2s; }
.fin-txn-row:hover { background: rgba(255,255,255,0.06); }
.fin-txn-row:hover .txn-del { opacity: 1; }
.fin-txn-type-bar { position: absolute; left: -1px; top: -1px; bottom: -1px; width: 4px; border-radius: 12px 0 0 12px; }
.fin-txn-desc { flex: 1; font-size: 13px; color: var(--text-primary); font-weight: 500; margin-left: 8px; cursor: pointer; }
.fin-txn-tag { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 10px; text-transform: uppercase; padding: 3px 7px; border-radius: 6px; margin: 0 10px; }
.fin-txn-amount { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 13px; font-weight: 700; tabular-nums; }
.fin-txn-date { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 10px; color: var(--text-tertiary); width: 50px; text-align: right; margin-left: 10px; }
.txn-del { background: none; border: none; color: var(--text-tertiary); font-size: 14px; cursor: pointer; opacity: 0; transition: all 0.2s; padding: 0 4px; margin-left: 8px; }
.txn-del:hover { color: var(--expense); }
"""
text = text.replace('</style>', css_to_insert + '\n</style>')

# 2. Insert Tabs and view-todo wrap
tabs_html = """
  <div class="dash-tabs" id="mainTabs">
    <button class="dash-tab active" data-target="view-todo">Day & To-Do</button>
    <button class="dash-tab" data-target="view-finance">Finance</button>
  </div>
  
  <div id="view-todo" class="dash-view active">
"""
text = text.replace('<div class="ticker-row">', tabs_html + '  <div class="ticker-row">', 1)

# 3. Insert Finance View
finance_html = """
  </div> <!-- end view-todo -->

  <div id="view-finance" class="dash-view">
    <h2 class="dash-title" style="font-size:28px; margin-bottom:14px;">My Finances</h2>
    
    <div class="period-bar">
      <div class="period-toggle" id="periodToggle">
        <button class="period-btn is-active" data-period="daily">Daily</button>
        <button class="period-btn" data-period="weekly">Weekly</button>
        <button class="period-btn" data-period="monthly">Monthly</button>
      </div>
      <div class="period-label">
        <button class="period-nav-btn" id="periodPrev">◂</button>
        <span id="periodLabel">Today</span>
        <button class="period-nav-btn" id="periodNext" disabled>▸</button>
      </div>
    </div>

    <div class="ticker-row" style="margin-bottom:18px;">
      <div class="net-ticker" id="netTicker" aria-live="polite" aria-atomic="true">
        <div class="net-ticker-led"><span class="net-ticker-led-dot"></span></div>
        <div class="net-ticker-label">STREAMS</div>
        <div class="net-ticker-stage" id="netTickerStage"></div>
        <div class="net-ticker-meta" id="netTickerMeta">NET $0</div>
      </div>
    </div>

    <div class="fin-summary-row">
      <div class="fin-card">
        <div class="fin-card-eyebrow">INCOME</div>
        <div class="fin-card-total" id="incomeTotal" style="color: var(--income);">$0.00</div>
        <div class="fin-card-trend" id="incomeTrend">— no prior data</div>
        <div class="fin-card-breakdown" id="incomeBreakdown"></div>
      </div>
      <div class="fin-card">
        <div class="fin-card-eyebrow">EXPENSES</div>
        <div class="fin-card-total" id="expenseTotal" style="color: var(--expense);">$0.00</div>
        <div class="fin-card-trend" id="expenseTrend">— no prior data</div>
        <div class="fin-card-breakdown" id="expenseBreakdown"></div>
      </div>
      <div class="fin-card">
        <div class="fin-card-eyebrow">NET FLOW</div>
        <div class="fin-card-total" id="netTotal">$0.00</div>
        <div class="fin-card-trend" id="savingsRate">Savings rate: —</div>
        <div class="fin-card-trend" id="txnCount" style="color: var(--text-tertiary); margin-bottom: 0;">0 transactions this period</div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Spending Breakdown</div>
      <div class="fin-card fin-donut-container">
        <div class="fin-donut-left">
          <svg class="fin-donut-svg" viewBox="0 0 120 120" id="donutSvg">
            <circle class="fin-donut-track" cx="60" cy="60" r="46"></circle>
          </svg>
          <div class="fin-donut-overlay">
            <div class="fin-donut-total" id="donutTotal">$0.00</div>
            <div class="fin-donut-label">Total spent</div>
          </div>
        </div>
        <div class="fin-donut-right" id="donutLegend"></div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Transactions</div>
      <div class="fin-card">
        <div class="fin-quick-add">
          <div style="display: flex; gap: 8px;">
            <div class="fin-type-toggle" id="txnTypeToggle">
              <button class="fin-type-btn active-inc" data-val="income">Income</button>
              <button class="fin-type-btn" data-val="expense">Expense</button>
            </div>
            <div class="fin-input-wrapper">
              <input type="text" id="txnAmount" class="gm-input" placeholder="0.00" inputmode="decimal" style="font-family: ui-monospace, 'SF Mono', monospace;">
            </div>
            <input type="text" id="txnDesc" class="gm-input" style="flex:1;" placeholder="What was it for?">
            <button id="txnAddBtn" class="gm-btn-primary" style="flex-shrink:0;">Add</button>
          </div>
          <div style="display: flex; gap: 8px; margin-top: 8px;">
            <select id="txnSource" class="fin-select">
              <option value="AFTRBEAM">AFTRBEAM</option>
              <option value="SNAPSCAPE">SNAPSCAPE</option>
              <option value="FREELANCE">FREELANCE</option>
              <option value="PERSONAL">PERSONAL</option>
              <option value="OTHER">OTHER</option>
            </select>
            <select id="txnCategory" class="fin-select" style="display:none;"></select>
            <input type="date" id="txnDate" class="fin-select">
          </div>
        </div>
        <ul id="txnList" style="list-style: none; padding: 0; margin: 0;"></ul>
      </div>
    </div>
  </div>
"""
text = text.replace('</div>\n\n<script>', finance_html + '\n</div>\n\n<script>')

with open('dashboard.html', 'w') as f:
    f.write(text)
