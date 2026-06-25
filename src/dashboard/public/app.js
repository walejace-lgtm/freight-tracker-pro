let paused = false;

function $(id) { return document.getElementById(id); }

function updateCard(id, value, sub) {
  const el = $(id);
  if (el) el.textContent = value;
}

async function fetchStats() {
  try {
    const res = await fetch('/api/stats');
    const data = await res.json();
    renderStats(data);
  } catch (e) {
    console.error('Stats fetch error:', e);
  }
}

async function fetchHistory() {
  try {
    const res = await fetch('/api/history?limit=50');
    const data = await res.json();
    renderHistory(data);
  } catch (e) {
    console.error('History fetch error:', e);
  }
}

function renderStats(data) {
  const totalSent = data.accounts.reduce((s, a) => s + a.sentToday, 0);
  const totalLimit = data.accounts.reduce((s, a) => s + a.dailyLimit, 0);
  const totalMax = data.accounts.reduce((s, a) => s + a.maxDaily, 0);

  updateCard('sentToday', totalSent);
  updateCard('sentSub', `of ${totalLimit} daily goal · ${totalMax} max possible`);
  updateCard('failedCount', data.sender.failed || 0);
  updateCard('pendingCount', data.pendingQueue);
  updateCard('filesProcessed', data.processedFiles);

  const pct = totalLimit > 0 ? Math.round((totalSent / totalLimit) * 100) : 0;
  const totalProgress = $('totalProgress');
  if (totalProgress) totalProgress.style.width = Math.min(pct, 100) + '%';

  paused = data.globalPaused;
  const pauseBtn = $('pauseBtn');
  if (pauseBtn) {
    pauseBtn.textContent = paused ? '▶ Resume All' : '⏸ Pause All';
    pauseBtn.className = paused ? 'btn resume' : 'btn pause';
  }

  renderAccounts(data.accounts);
}

function renderAccounts(accounts) {
  const container = $('accountsList');
  if (!container) return;

  if (accounts.length === 0) {
    container.innerHTML = '<p class="empty">No SMTP accounts configured</p>';
    return;
  }

  container.innerHTML = accounts.map(a => {
    const warmupPct = Math.min(a.warmupPct, 100);
    const dailyPct = Math.min(a.progressPct, 100);
    return `
      <div class="account-row">
        <div>
          <div class="account-name">${a.id}</div>
          <div class="account-host">${a.user} @ ${a.host}</div>
        </div>
        <div style="text-align:right; min-width:200px;">
          <div style="font-weight:600;">${a.sentToday} / ${a.dailyLimit}</div>
          <div class="progress-bar" style="width:160px; margin:4px 0 4px auto;">
            <div class="fill green" style="width:${dailyPct}%"></div>
          </div>
          <div style="font-size:11px; color:#64748b;">
            Warmup: day ${a.warmupDay}/${a.warmupDays}
          </div>
          <div class="progress-bar" style="width:160px; margin:2px 0 0 auto;">
            <div class="fill blue" style="width:${warmupPct}%"></div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderHistory(logs) {
  const container = $('historyTable');
  if (!container) return;

  if (!logs || logs.length === 0) {
    container.innerHTML = '<p class="empty">No sends yet</p>';
    return;
  }

  container.innerHTML = `
    <table>
      <thead><tr><th>Time</th><th>Name</th><th>Email</th><th>Account</th><th>Status</th></tr></thead>
      <tbody>
        ${logs.map(l => `
          <tr>
            <td>${new Date(l.time).toLocaleTimeString()}</td>
            <td>${l.name || '-'}</td>
            <td>${l.email}</td>
            <td>${l.account || '-'}</td>
            <td><span class="badge ${l.status}">${l.status}${l.error ? ' ⚠' : ''}</span></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

async function togglePause() {
  try {
    const res = await fetch('/api/pause', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paused: !paused })
    });
    const data = await res.json();
    paused = data.paused;
    fetchStats();
  } catch (e) {
    console.error('Pause toggle error:', e);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const pauseBtn = $('pauseBtn');
  if (pauseBtn) pauseBtn.addEventListener('click', togglePause);

  fetchStats();
  fetchHistory();
  setInterval(fetchStats, 3000);
  setInterval(fetchHistory, 5000);
});
