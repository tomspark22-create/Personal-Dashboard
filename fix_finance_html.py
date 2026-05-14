import re

with open('dashboard.html', 'r') as f:
    text = f.read()

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

# The HTML file currently has:
#    </div>
#  </div>
#<script>

if 'id="view-finance"' not in text:
    text = text.replace('  </div>\n<script>', finance_html + '\n  </div>\n<script>')
    
    with open('dashboard.html', 'w') as f:
        f.write(text)
    print("Injected finance html")
else:
    print("Already injected")
