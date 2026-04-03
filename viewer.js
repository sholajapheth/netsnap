let reportData = null;

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2000);
}

function copyText(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
}

function getStatusClass(s) {
  if (!s) return 'so';
  if (s >= 500) return 's5';
  if (s >= 400) return 's4';
  if (s >= 200 && s < 300) return 's2';
  return 'so';
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

function formatVal(val) {
  if (val === null || val === undefined || val === '') return '—';
  if (typeof val === 'string') return escapeHtml(val);
  return escapeHtml(JSON.stringify(val, null, 2));
}

function generateWhatsApp(data) {
  const lines = [];
  lines.push(`🔴 *API Bug Report* — ${new Date(data.meta.captured_at).toLocaleString()}`);
  lines.push(`Tool: ${data.meta.tool}`);
  lines.push('');

  data.requests.forEach((r, i) => {
    lines.push(`--- Request ${i + 1} of ${data.requests.length} ---`);
    lines.push(`*Status:* ${r.status} ${r.statusText || ''}`);
    lines.push(`*Method:* ${r.method}`);
    lines.push(`*URL:* ${r.url}`);
    lines.push(`*Time:* ${r.timestamp} (${r.duration})`);
    if (r.requestBody) {
      const b = typeof r.requestBody === 'string' ? r.requestBody : JSON.stringify(r.requestBody);
      lines.push(`*Payload:*\n\`\`\`\n${b.substring(0, 500)}${b.length > 500 ? '\n...' : ''}\n\`\`\``);
    }
    if (r.responseBody) {
      const rb = typeof r.responseBody === 'string' ? r.responseBody : JSON.stringify(r.responseBody);
      lines.push(`*Response:*\n\`\`\`\n${rb.substring(0, 500)}${rb.length > 500 ? '\n...' : ''}\n\`\`\``);
    }
    lines.push('');
  });
  lines.push('_Captured with NetSnap_');
  return lines.join('\n');
}

function renderReport(data) {
  reportData = data;

  document.getElementById('topMeta').textContent =
    `${data.requests.length} request${data.requests.length !== 1 ? 's' : ''} · ${new Date(data.meta.captured_at).toLocaleString()}`;

  const errorCount = data.requests.filter(r => r.status >= 400).length;
  document.getElementById('reportMeta').innerHTML = `
    <div class="meta-chip">📅 ${escapeHtml(new Date(data.meta.captured_at).toLocaleString())}</div>
    <div class="meta-chip">📦 ${data.requests.length} request${data.requests.length !== 1 ? 's' : ''}</div>
    ${errorCount > 0 ? `<div class="meta-chip" style="border-color:rgba(239,68,68,0.4); color:var(--red);">🔴 ${errorCount} error${errorCount !== 1 ? 's' : ''}</div>` : ''}
  `;

  const cards = document.getElementById('requestCards');
  cards.innerHTML = data.requests.map((r, i) => {
    const sc = getStatusClass(r.status);
    const errorMessage = r.responseBody &&
      (typeof r.responseBody === 'object' ? (r.responseBody.message || r.responseBody.error || null) : null);

    return `
      <div class="request-card">
        <div class="card-header">
          <span class="req-num">#${i + 1}</span>
          <span class="status-pill ${sc}">${escapeHtml(r.status || '—')} ${escapeHtml(r.statusText || '')}</span>
          <span class="method-pill">${escapeHtml(r.method)}</span>
          <span class="card-url">${escapeHtml(r.url)}</span>
          <span class="card-time">${escapeHtml(r.duration)}</span>
        </div>
        <div class="card-body">
          ${errorMessage ? `
            <div class="error-banner">
              <span>⚠</span>
              <span><strong>Server message:</strong> ${escapeHtml(errorMessage)}</span>
            </div>
            <br>` : ''}

          <div class="section-label">Overview</div>
          <div class="info-grid">
            <span class="ig-key">Timestamp</span>
            <span class="ig-val">${escapeHtml(r.timestamp)}</span>
            <span class="ig-key">Duration</span>
            <span class="ig-val">${escapeHtml(r.duration)}</span>
            <span class="ig-key">Full URL</span>
            <span class="ig-val">${escapeHtml(r.url)}</span>
          </div>

          ${r.requestBody ? `
            <div class="section-label">Request Payload</div>
            <pre class="block">${formatVal(r.requestBody)}</pre>` : ''}

          <div class="section-label">Response Body</div>
          <pre class="block">${formatVal(r.responseBody)}</pre>

          ${Object.keys(r.requestHeaders || {}).length > 0 ? `
            <div class="section-label">Request Headers (sensitive removed)</div>
            <pre class="block">${formatVal(r.requestHeaders)}</pre>` : ''}
        </div>
      </div>`;
  }).join('');
}

// ── LOAD FROM HASH ──────────────────────────────────────

function decodeB64Utf8(b64) {
  // Reverse of `btoa(unescape(encodeURIComponent(str)))`, but safely Unicode.
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder('utf-8').decode(bytes);
}

function loadReport() {
  try {
    const raw = window.location.hash.substring(1);
    if (!raw) throw new Error('No data in URL hash');
    const hash = decodeURIComponent(raw);

    // New format: short token -> load report from chrome.storage.
    // Old format fallback: hash was base64(JSON) stored directly in the URL.
    const storageKey = `netsnap_report_${hash}`;
    const looksLikeToken = hash.length <= 120;

    const showError = () => {
      document.getElementById('errorMsg').style.display = 'block';
      document.getElementById('requestCards').style.display = 'none';
      document.getElementById('topMeta').textContent = 'Failed to load report';
    };

    if (looksLikeToken && chrome?.storage?.local) {
      chrome.storage.local.get(storageKey, (result) => {
        try {
          const stored = result && result[storageKey];
          if (stored) {
            const data = JSON.parse(stored);
            renderReport(data);
            chrome.storage.local.remove(storageKey);
            return;
          }
          // Not found (or already removed): fall back to old hash format.
          const jsonStr = decodeB64Utf8(hash);
          const data = JSON.parse(jsonStr);
          renderReport(data);
        } catch (e) {
          showError();
        }
      });
      return;
    }

    const jsonStr = decodeB64Utf8(hash);
    const data = JSON.parse(jsonStr);
    renderReport(data);
  } catch (e) {
    document.getElementById('errorMsg').style.display = 'block';
    document.getElementById('requestCards').style.display = 'none';
    document.getElementById('topMeta').textContent = 'Failed to load report';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadReport();

  document.getElementById('copyWaTopBtn').addEventListener('click', () => {
    if (!reportData) return;
    copyText(generateWhatsApp(reportData));
    showToast('📱 Copied for WhatsApp!');
  });

  document.getElementById('copyJsonTopBtn').addEventListener('click', () => {
    if (!reportData) return;
    copyText(JSON.stringify(reportData, null, 2));
    showToast('{ } JSON copied!');
  });
});
