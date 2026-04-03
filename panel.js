// NetSnap Panel Logic
// Built by Shola Japheth — https://sholajapheth.com | https://github.com/sholajapheth

const state = {
  capturing: true,
  filter: 'errors',       // 'errors' | 'all'
  requests: [],           // all captured requests
  report: [],             // requests added to the report
  selected: null,         // currently selected request id
  activeTab: 'detail',
};

let requestIdCounter = 0;

// ── UTILS ──────────────────────────────────────────────

function formatTime(date) {
  return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function getStatusClass(status) {
  if (!status) return 'status-other';
  if (status >= 500) return 'status-5xx';
  if (status >= 400) return 'status-4xx';
  if (status >= 200 && status < 300) return 'status-2xx';
  return 'status-other';
}

function shortenUrl(url) {
  try {
    const u = new URL(url);
    return u.pathname + (u.search ? u.search.substring(0, 30) + (u.search.length > 30 ? '…' : '') : '');
  } catch {
    return url.length > 60 ? url.substring(0, 60) + '…' : url;
  }
}

function escapeHtml(value) {
  // Captured network data may contain arbitrary strings; escape before interpolating into HTML.
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function showToast(msg, color = 'var(--green)') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.background = color;
  t.style.color = color === 'var(--green)' ? '#000' : '#fff';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

function copyToClipboard(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
}

// ── NETWORK CAPTURE ────────────────────────────────────

function safeParseJSON(str) {
  if (str === null || str === undefined || str === '') return null;
  try { return JSON.parse(str); } catch { return null; }
}

chrome.devtools.network.onRequestFinished.addListener((entry) => {
  if (!state.capturing) return;

  const req = entry.request;
  const res = entry.response;
  const status = res.status;

  // Get request body
  let requestBody = null;
  if (req.postData) {
    const parsed = safeParseJSON(req.postData.text);
    requestBody = parsed === null ? req.postData.text : parsed;
  }

  // Filter sensitive headers
  const safeHeaders = (headers) => {
    return headers
      .filter(h => !['authorization', 'cookie', 'set-cookie', 'x-api-key'].includes(h.name.toLowerCase()))
      .reduce((acc, h) => { acc[h.name] = h.value; return acc; }, {});
  };

  entry.getContent((content) => {
    const parsed = safeParseJSON(content);
    const responseBody = parsed === null ? content : parsed;

    const captured = {
      id: ++requestIdCounter,
      url: req.url,
      method: req.method,
      status: status,
      statusText: res.statusText,
      requestHeaders: safeHeaders(req.headers),
      requestBody,
      responseBody,
      time: formatTime(new Date()),
      timestamp: new Date().toISOString(),
      duration: entry.time ? Math.round(entry.time) + 'ms' : '—',
    };

    state.requests.unshift(captured);
    renderRequestList();
  });
});

// ── RENDER: REQUEST LIST ────────────────────────────────

function renderRequestList() {
  const container = document.getElementById('requestItems');
  
  let filtered = state.requests;
  if (state.filter === 'errors') {
    filtered = state.requests.filter(r => r.status >= 400 || !r.status);
  }

  if (filtered.length === 0) {
    if (state.requests.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📡</div>
          <div class="empty-title">Waiting for requests</div>
          <div class="empty-sub">Reload the page or make API<br>calls to start capturing traffic.</div>
        </div>`;
    } else {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">✅</div>
          <div class="empty-title">No errors</div>
          <div class="empty-sub">All requests returned 2xx.<br>Switch to "All" to see everything.</div>
        </div>`;
    }
    return;
  }

  container.innerHTML = filtered.map(r => {
    const inReport = state.report.some(x => x.id === r.id);
    const isSelected = state.selected === r.id;
    return `
      <div class="request-item ${isSelected ? 'selected' : ''}" data-id="${r.id}">
        <span class="status-badge ${getStatusClass(r.status)}">${escapeHtml(r.status || '—')}</span>
        <span class="request-method">${escapeHtml(r.method)}</span>
        <button class="add-btn ${inReport ? 'added' : ''}" data-id="${r.id}">
          ${inReport ? '✓ Added' : '+ Add'}
        </button>
        <span class="request-url">${escapeHtml(shortenUrl(r.url))}</span>
        <span class="request-time" style="grid-column:1;">${r.time}</span>
        <span class="request-time">${escapeHtml(r.duration)}</span>
      </div>`;
  }).join('');

  // Click to select row
  container.querySelectorAll('.request-item').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.classList.contains('add-btn')) return;
      const id = parseInt(el.dataset.id);
      selectRequest(id);
    });
  });

  // Add to report buttons — event listeners, NOT inline onclick (CSP blocks those)
  container.querySelectorAll('.add-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.id);
      toggleReport(id);
    });
  });
}

// ── SELECT REQUEST (DETAIL VIEW) ────────────────────────

function selectRequest(id) {
  state.selected = id;
  const r = state.requests.find(x => x.id === id);
  if (!r) return;

  renderRequestList(); // update selected highlight

  document.getElementById('noSelection').style.display = 'none';
  const content = document.getElementById('detailContent');
  content.style.display = 'block';

  const formatJSON = (val) => {
    if (val === null || val === undefined || val === '') return '—';
    if (typeof val === 'string') return escapeHtml(val);
    return escapeHtml(JSON.stringify(val, null, 2));
  };

  content.innerHTML = `
    <div class="detail-content">
      <div class="detail-section">
        <div class="detail-section-title">Overview</div>
        <div class="meta-grid">
          <span class="meta-key">Status</span>
          <span class="meta-val"><span class="status-badge ${getStatusClass(r.status)}">${escapeHtml(r.status)} ${escapeHtml(r.statusText)}</span></span>
          <span class="meta-key">Method</span>
          <span class="meta-val" style="color:var(--blue); font-weight:700;">${escapeHtml(r.method)}</span>
          <span class="meta-key">Time</span>
          <span class="meta-val">${escapeHtml(r.time)} (${escapeHtml(r.duration)})</span>
          <span class="meta-key">URL</span>
          <span class="meta-val">${escapeHtml(r.url)}</span>
        </div>
      </div>

      <div class="detail-section">
        <div class="detail-section-title">Request Headers</div>
        <pre class="code-block">${formatJSON(r.requestHeaders)}</pre>
      </div>

      ${r.requestBody ? `
      <div class="detail-section">
        <div class="detail-section-title">Request Payload</div>
        <pre class="code-block">${formatJSON(r.requestBody)}</pre>
      </div>` : ''}

      <div class="detail-section">
        <div class="detail-section-title">Response Body</div>
        <pre class="code-block">${formatJSON(r.responseBody)}</pre>
      </div>

      <div style="padding-bottom:12px;">
        <button class="btn primary" id="detailAddBtn">
          ${state.report.some(x => x.id === r.id) ? '✓ In Report' : '+ Add to Report'}
        </button>
      </div>
    </div>`;

  // Wire up detail add button after innerHTML is set
  document.getElementById('detailAddBtn').addEventListener('click', () => {
    toggleReport(r.id);
    const btn = document.getElementById('detailAddBtn');
    if (btn) btn.textContent = state.report.some(x => x.id === r.id) ? '✓ In Report' : '+ Add to Report';
  });
}

// ── REPORT MANAGEMENT ──────────────────────────────────

function toggleReport(id) {
  const r = state.requests.find(x => x.id === id);
  if (!r) return;

  const idx = state.report.findIndex(x => x.id === id);
  if (idx >= 0) {
    state.report.splice(idx, 1);
    showToast('Removed from report', 'var(--text-dim)');
  } else {
    state.report.unshift(r);
    showToast('Added to report ✓');
  }

  updateBadges();
  renderRequestList();
  renderReport();

  // Update detail view add button if open
  if (state.selected === id) {
    const btn = document.getElementById('detailAddBtn');
    if (btn) {
      btn.textContent = state.report.some(x => x.id === id) ? '✓ In Report' : '+ Add to Report';
    }
  }
}

function updateBadges() {
  const n = state.report.length;
  const badge = document.getElementById('queueBadge');
  const tabBadge = document.getElementById('reportTabBadge');
  
  badge.textContent = `${n} in report`;
  badge.className = `count-badge ${n > 0 ? 'has-items' : ''}`;

  if (n > 0) {
    tabBadge.textContent = n;
    tabBadge.style.display = 'inline';
  } else {
    tabBadge.style.display = 'none';
  }
}

// ── RENDER: REPORT BUILDER ─────────────────────────────

function renderReport() {
  const empty = document.getElementById('reportEmpty');
  const items = document.getElementById('reportItems');
  const queueList = document.getElementById('queueList');
  const countEl = document.getElementById('reportCount');

  if (state.report.length === 0) {
    empty.style.display = 'flex';
    items.style.display = 'none';
    return;
  }

  empty.style.display = 'none';
  items.style.display = 'block';

  countEl.textContent = `${state.report.length} request${state.report.length > 1 ? 's' : ''}`;

  queueList.innerHTML = state.report.map(r => `
    <div class="queue-item">
      <span class="status-badge ${getStatusClass(r.status)}" style="flex-shrink:0;">${escapeHtml(r.status)}</span>
      <span style="color:var(--blue); font-size:10px; flex-shrink:0;">${escapeHtml(r.method)}</span>
      <span style="color:var(--text); font-size:10px; word-break:break-all; flex:1;">${escapeHtml(shortenUrl(r.url))}</span>
      <span class="queue-remove" data-id="${r.id}">×</span>
    </div>
  `).join('');

  // Wire up remove buttons
  queueList.querySelectorAll('.queue-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.id);
      removeFromReport(id);
    });
  });

  // Update preview
  document.getElementById('reportPreview').textContent = generateWhatsAppText();
}

function removeFromReport(id) {
  state.report = state.report.filter(x => x.id !== id);
  updateBadges();
  renderRequestList();
  renderReport();
}

// ── SHARE FORMATS ──────────────────────────────────────

function generateWhatsAppText() {
  if (state.report.length === 0) return '';

  const lines = [];
  lines.push(`🔴 *API Bug Report* — ${new Date().toLocaleString()}`);
  lines.push(`Page: ${window.location?.href || chrome.devtools.inspectedWindow.tabId}`);
  lines.push('');

  state.report.forEach((r, i) => {
    lines.push(`--- Request ${i + 1} of ${state.report.length} ---`);
    lines.push(`*Status:* ${r.status} ${r.statusText}`);
    lines.push(`*Method:* ${r.method}`);
    lines.push(`*URL:* ${r.url}`);
    lines.push(`*Time:* ${r.timestamp} (${r.duration})`);
    
    if (r.requestBody) {
      const body = typeof r.requestBody === 'string' ? r.requestBody : JSON.stringify(r.requestBody);
      lines.push(`*Payload:*\n\`\`\`\n${body.substring(0, 500)}${body.length > 500 ? '\n...(truncated)' : ''}\n\`\`\``);
    }

    if (r.responseBody) {
      const rb = typeof r.responseBody === 'string' ? r.responseBody : JSON.stringify(r.responseBody);
      lines.push(`*Response:*\n\`\`\`\n${rb.substring(0, 500)}${rb.length > 500 ? '\n...(truncated)' : ''}\n\`\`\``);
    }
    lines.push('');
  });

  lines.push('_Captured with NetSnap_');
  return lines.join('\n');
}

function generateJSON() {
  return JSON.stringify({
    meta: {
      captured_at: new Date().toISOString(),
      count: state.report.length,
      tool: 'NetSnap v1.0',
    },
    requests: state.report.map(r => ({
      id: r.id,
      timestamp: r.timestamp,
      method: r.method,
      url: r.url,
      status: r.status,
      statusText: r.statusText,
      duration: r.duration,
      requestHeaders: r.requestHeaders,
      requestBody: r.requestBody,
      responseBody: r.responseBody,
    }))
  }, null, 2);
}

// ── TABS ───────────────────────────────────────────────

document.querySelectorAll('.view-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const name = tab.dataset.tab;
    state.activeTab = name;
    document.querySelectorAll('.view-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.view-pane').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`pane-${name}`).classList.add('active');

    if (name === 'report') renderReport();
  });
});

// ── FILTER ─────────────────────────────────────────────

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    state.filter = btn.dataset.filter;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderRequestList();
  });
});

// ── CAPTURE TOGGLE ─────────────────────────────────────

document.getElementById('captureToggle').addEventListener('click', () => {
  state.capturing = !state.capturing;
  const btn = document.getElementById('captureToggle');
  const label = document.getElementById('captureLabel');
  btn.classList.toggle('active', state.capturing);
  label.textContent = state.capturing ? 'Capturing' : 'Paused';
});

// ── CLEAR BUTTONS ──────────────────────────────────────

document.getElementById('clearLogBtn').addEventListener('click', () => {
  state.requests = [];
  state.selected = null;
  document.getElementById('noSelection').style.display = 'flex';
  document.getElementById('detailContent').style.display = 'none';
  renderRequestList();
});

document.getElementById('clearAllBtn').addEventListener('click', () => {
  state.requests = [];
  state.report = [];
  state.selected = null;
  document.getElementById('noSelection').style.display = 'flex';
  document.getElementById('detailContent').style.display = 'none';
  renderRequestList();
  updateBadges();
  renderReport();
  showToast('Cleared everything', 'var(--red)');
});

// ── SHARE BUTTONS ──────────────────────────────────────

document.getElementById('copyWhatsappBtn').addEventListener('click', () => {
  const text = generateWhatsAppText();
  copyToClipboard(text);
  showToast('📱 Copied for WhatsApp!');
});

document.getElementById('copyJsonBtn').addEventListener('click', () => {
  copyToClipboard(generateJSON());
  showToast('{ } JSON copied!');
});

document.getElementById('openViewerBtn').addEventListener('click', () => {
  if (state.report.length === 0) {
    showToast('Report is empty', 'var(--text-dim)');
    return;
  }

  const reportJson = generateJSON();
  const token = (crypto && crypto.randomUUID)
    ? crypto.randomUUID()
    : `netsnap_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  const storageKey = `netsnap_report_${token}`;
  chrome.storage.local.set({ [storageKey]: reportJson }, () => {
    if (chrome.runtime.lastError) {
      showToast('Failed to store report for viewer', 'var(--red)');
      return;
    }
    chrome.runtime.sendMessage({ type: 'OPEN_VIEWER', data: token });
    showToast('🔗 Viewer opened in new tab!');
  });
});

// ── INIT ───────────────────────────────────────────────

updateBadges();
renderReport();
