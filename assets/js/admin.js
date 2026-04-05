/* ══════════════════════════════════════════════════════
   ADMIN.JS — Amirtharaj Investments Admin Dashboard
   ══════════════════════════════════════════════════════ */

const SUPABASE_URL  = window.__ENV__.SUPABASE_URL;
const SUPABASE_ANON = window.__ENV__.SUPABASE_ANON;
const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON);

const tabMeta = {
  overview:      { title: 'Overview',                          sub: "Welcome back — here's what's happening today." },
  dashboard:     { title: 'CAMS & KARVY Client Master Upload', sub: 'Upload CAMS/Karvy CSV, clean and push to Supabase.' },
  enquiries:     { title: 'Enquiries',                         sub: 'Messages submitted via the contact form.' },
  clients:       { title: 'Client Profiles',                   sub: 'Registered users and admin roles.' },
  portfolio:     { title: 'Portfolio',                         sub: 'Portfolio management module.' },
  reports:       { title: 'Reports',                           sub: 'Reporting and data export.' },
  settings:      { title: 'Settings',                          sub: 'Site configuration and preferences.' },
  'nse-clients':   { title: 'NSE Client Master',      sub: 'All NSE registered clients and their bank details.' },
  'nse-sips':      { title: 'NSE SIP Transactions',   sub: 'Active, paused and completed SIP mandates.' },
  'nse-mandates':  { title: 'NSE Mandates',           sub: 'Bank mandate approvals and limits.' },
  'nse-analytics': { title: 'NSE Analytics',          sub: 'SIP and mandate performance overview.' },
};

let activeTab = 'overview';

/* ══ AUTH ══ */
async function checkAuth() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { window.location.href = 'index.html'; return; }

  const { data: profile } = await sb
    .from('profiles').select('role, full_name')
    .eq('id', session.user.id).single();

  if (!profile || profile.role !== 'admin') {
    await sb.auth.signOut();
    window.location.href = 'index.html';
    return;
  }

  document.getElementById('auth-gate').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  document.getElementById('admin-name').textContent =
    profile.full_name || session.user.email.split('@')[0];

  document.getElementById('current-date').textContent =
    new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

  loadStats();
  loadEnquiries();
  loadClients();
}

async function handleLogout() {
  await sb.auth.signOut();
  window.location.href = 'index.html';
}

/* ══ TAB SWITCHING ══ */
function switchTab(tab) {
  document.getElementById('tab-' + activeTab).style.display = 'none';
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  activeTab = tab;
  document.getElementById('tab-' + tab).style.display = 'block';
  document.querySelectorAll('.nav-item').forEach(el => {
    if (el.getAttribute('onclick') && el.getAttribute('onclick').includes("'" + tab + "'"))
      el.classList.add('active');
  });
  document.getElementById('page-title').textContent = tabMeta[tab]?.title || tab;
  document.getElementById('page-sub').textContent   = tabMeta[tab]?.sub   || '';
  closeSidebar();
  // NSE — lazy-load on first visit; analytics always refreshes charts
  if (tab === 'nse-clients'   && !nseState.clients.loaded)  loadNseClients();
  if (tab === 'nse-sips'      && !nseState.sips.loaded)     loadNseSips();
  if (tab === 'nse-mandates'  && !nseState.mandates.loaded) loadNseMandates();
  if (tab === 'nse-analytics') loadNseAnalytics();
}

/* ══ STATS ══ */
async function loadStats() {
  const { count: clientCount } = await sb
    .from('profiles').select('*', { count: 'exact', head: true });
  document.getElementById('stat-clients').textContent  = clientCount ?? '—';
  document.getElementById('client-change').textContent = 'Total registered';

  const { count: enqCount } = await sb
    .from('contact_enquiries').select('*', { count: 'exact', head: true });
  document.getElementById('stat-enquiries').textContent = enqCount ?? '—';
  document.getElementById('enq-change').textContent     = 'All messages';

  if (enqCount > 0) {
    const badge = document.getElementById('enquiry-count');
    badge.textContent  = enqCount;
    badge.style.display = 'inline-block';
  }
}

/* ══ ENQUIRIES ══ */
async function loadEnquiries() {
  const tbody = document.getElementById('enquiries-body');
  if (!tbody) return;

  const { data, error } = await sb
    .from('contact_enquiries').select('*')
    .order('created_at', { ascending: false });

  if (error || !data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">📭</div>No enquiries yet.</div></td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(row => `
    <tr>
      <td>${esc(row.name || '—')}</td>
      <td>${esc(row.email || '—')}</td>
      <td>${esc(row.phone || '—')}</td>
      <td style="max-width:260px;font-size:12px;line-height:1.4">${esc(row.message || '—')}</td>
      <td style="white-space:nowrap;font-size:12px">${row.created_at ? new Date(row.created_at).toLocaleDateString('en-IN') : '—'}</td>
      <td><span style="font-size:11px;padding:3px 10px;border-radius:100px;background:var(--brand-dim);color:var(--brand);border:1px solid var(--brand-mid)">New</span></td>
    </tr>
  `).join('');
}

/* ══ CLIENTS ══ */
async function loadClients() {
  const tbody = document.getElementById('clients-body');
  if (!tbody) return;

  const { data, error } = await sb
    .from('profiles').select('*')
    .order('created_at', { ascending: false });

  if (error || !data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">👤</div>No client profiles yet.</div></td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(row => `
    <tr>
      <td><strong>${esc(row.full_name || '—')}</strong></td>
      <td>
        <span style="font-size:11px;padding:3px 10px;border-radius:100px;
          background:${row.role === 'admin' ? 'rgba(232,80,58,0.15)' : 'var(--brand-dim)'};
          color:${row.role === 'admin' ? 'var(--brand)' : 'var(--muted)'};
          border:1px solid ${row.role === 'admin' ? 'var(--brand-mid)' : 'var(--border)'}">
          ${esc(row.role || 'user')}
        </span>
      </td>
      <td><code style="font-size:11px;background:var(--bg3);padding:2px 8px;border-radius:4px">${esc(row.ai_code || '—')}</code></td>
      <td style="font-size:11px;color:var(--muted)">${esc(row.id?.substring(0,8) || '—')}…</td>
      <td style="font-size:12px;color:var(--muted)">${row.created_at ? new Date(row.created_at).toLocaleDateString('en-IN') : '—'}</td>
    </tr>
  `).join('');
}

/* ══ HELPERS ══ */
function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = (type === 'success' ? '✓ ' : '⚠ ') + msg;
  t.className   = 'toast ' + type + ' show';
  setTimeout(() => { t.className = 'toast'; }, 3500);
}

/* ══ MOBILE SIDEBAR ══ */
function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebarOverlay').classList.add('show');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('show');
}

/* ══════════════════════════════════════════════════════════
   NSE MODULE
   ══════════════════════════════════════════════════════════ */

const NSE_PAGE_SIZE = 50;

const nseState = {
  clients:  { raw: [], filtered: [], page: 1, sortCol: 'client_name', sortAsc: true,  loaded: false },
  sips:     { raw: [], filtered: [], page: 1, sortCol: 'created_at',  sortAsc: false, loaded: false, statusFilter: '' },
  mandates: { raw: [], filtered: [], page: 1, sortCol: 'created_at',  sortAsc: false, loaded: false, statusFilter: '' },
};

const nseCharts = {};

/* ── Fetch all rows from a table (1000/page) ── */
async function nseFetchAll(table) {
  const SIZE = 1000;
  let from = 0, all = [];
  while (true) {
    const { data, error } = await sb.from(table).select('*').range(from, from + SIZE - 1);
    if (error || !data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < SIZE) break;
    from += SIZE;
  }
  return all;
}

/* ── Status badge builder ── */
const SIP_COLORS = {
  ACTIVE:    ['rgba(34,197,94,0.15)',   '#22c55e'],
  PAUSED:    ['rgba(245,158,11,0.15)',  '#f59e0b'],
  CANCELLED: ['rgba(239,68,68,0.15)',   '#ef4444'],
  COMPLETED: ['rgba(122,136,153,0.15)','#7A8899'],
};
const MANDATE_COLORS = {
  APPROVED:  ['rgba(34,197,94,0.15)',   '#22c55e'],
  PENDING:   ['rgba(245,158,11,0.15)',  '#f59e0b'],
  REJECTED:  ['rgba(239,68,68,0.15)',   '#ef4444'],
  CANCELLED: ['rgba(122,136,153,0.15)','#7A8899'],
};

function nseBadge(status, map) {
  const [bg, color] = map[status] || ['rgba(122,136,153,0.15)', '#7A8899'];
  return `<span style="font-size:11px;padding:3px 10px;border-radius:100px;background:${bg};color:${color};font-weight:600">${esc(status || '—')}</span>`;
}

function nseRowBadge(n) {
  return `<span style="font-size:11px;padding:2px 8px;border-radius:100px;background:var(--brand-dim);color:var(--brand);border:1px solid var(--brand-mid);font-weight:700;margin-left:8px">${n}</span>`;
}

function fmtDate(d) { return d ? new Date(d).toLocaleDateString('en-IN') : '—'; }
function fmtAmt(n)  { return n != null ? '₹' + Number(n).toLocaleString('en-IN') : '—'; }

/* ── Generic sort ── */
function nseSortData(type) {
  const s = nseState[type];
  const col = s.sortCol, asc = s.sortAsc;
  s.filtered.sort((a, b) => {
    let va = a[col] ?? '', vb = b[col] ?? '';
    if (typeof va === 'string') { va = va.toLowerCase(); vb = String(vb).toLowerCase(); }
    if (va < vb) return asc ? -1 :  1;
    if (va > vb) return asc ?  1 : -1;
    return 0;
  });
  if (type === 'clients')  renderNseClientsTable();
  if (type === 'sips')     renderNseSipsTable();
  if (type === 'mandates') renderNseMandatesTable();
}

/* ── Generic pagination renderer ── */
function renderNsePager(type, pagerId) {
  const s     = nseState[type];
  const total = Math.ceil(s.filtered.length / NSE_PAGE_SIZE) || 1;
  const el    = document.getElementById(pagerId);
  if (!el) return;
  const prevDis = s.page <= 1    ? 'disabled style="opacity:0.4;pointer-events:none"' : '';
  const nextDis = s.page >= total ? 'disabled style="opacity:0.4;pointer-events:none"' : '';
  el.innerHTML = `
    <button type="button" class="btn-sm" ${prevDis} onclick="nseChangePage('${type}','${pagerId}',-1)">← Prev</button>
    <span style="font-size:13px;color:var(--muted)">Page <strong style="color:var(--white)">${s.page}</strong> of <strong style="color:var(--white)">${total}</strong></span>
    <button type="button" class="btn-sm" ${nextDis} onclick="nseChangePage('${type}','${pagerId}',1)">Next →</button>
  `;
}

function nseChangePage(type, pagerId, delta) {
  const s     = nseState[type];
  const total = Math.ceil(s.filtered.length / NSE_PAGE_SIZE) || 1;
  s.page      = Math.max(1, Math.min(total, s.page + delta));
  if (type === 'clients')  renderNseClientsTable();
  if (type === 'sips')     renderNseSipsTable();
  if (type === 'mandates') renderNseMandatesTable();
}

/* ══ NSE CLIENTS ══════════════════════════════════════════ */

async function loadNseClients() {
  nseState.clients.loaded = false;
  document.getElementById('nse-clients-body').innerHTML =
    `<tr><td colspan="9"><div class="empty-state"><div class="empty-icon">⏳</div>Loading NSE clients…</div></td></tr>`;
  nseState.clients.raw = await nseFetchAll('nse_client_master');
  nseState.clients.loaded = true;
  applyNseClientsFilter();
}

function applyNseClientsFilter() {
  const q = (document.getElementById('nse-clients-search')?.value || '').toLowerCase();
  const s = nseState.clients;
  s.filtered = q ? s.raw.filter(r =>
    (r.client_name || '').toLowerCase().includes(q) ||
    (r.client_code || '').toLowerCase().includes(q) ||
    (r.pan         || '').toLowerCase().includes(q) ||
    (r.mobile      || '').toLowerCase().includes(q) ||
    (r.email       || '').toLowerCase().includes(q)
  ) : [...s.raw];
  s.page = 1;
  nseSortData('clients');
}

function sortNseClients(col) {
  const s = nseState.clients;
  s.sortAsc = s.sortCol === col ? !s.sortAsc : true;
  s.sortCol = col; s.page = 1;
  nseSortData('clients');
}

function renderNseClientsTable() {
  const s = nseState.clients;
  document.getElementById('nse-clients-count').innerHTML = nseRowBadge(s.filtered.length);
  const rows = s.filtered.slice((s.page - 1) * NSE_PAGE_SIZE, s.page * NSE_PAGE_SIZE);
  const tbody = document.getElementById('nse-clients-body');
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><div class="empty-icon">🔍</div>No clients found.</div></td></tr>`;
    renderNsePager('clients', 'nse-clients-pager'); return;
  }
  tbody.innerHTML = rows.map(r => `
    <tr>
      <td><code style="font-size:11px;background:var(--bg3);padding:2px 8px;border-radius:4px">${esc(r.client_code)}</code></td>
      <td><strong>${esc(r.client_name || '—')}</strong></td>
      <td style="font-size:12px;letter-spacing:0.04em">${esc(r.pan || '—')}</td>
      <td>${esc(r.mobile || '—')}</td>
      <td style="font-size:12px;color:var(--muted)">${esc(r.email || '—')}</td>
      <td>${esc(r.tax_status || '—')}</td>
      <td>${esc(r.bank_name || '—')}</td>
      <td style="font-size:12px;font-family:monospace">${esc(r.ac_no || '—')}</td>
      <td style="font-size:12px;color:var(--muted)">${fmtDate(r.created_at)}</td>
    </tr>`).join('');
  renderNsePager('clients', 'nse-clients-pager');
}

/* ══ NSE SIP TRANSACTIONS ═════════════════════════════════ */

async function loadNseSips() {
  nseState.sips.loaded = false;
  document.getElementById('nse-sips-body').innerHTML =
    `<tr><td colspan="9"><div class="empty-state"><div class="empty-icon">⏳</div>Loading SIP transactions…</div></td></tr>`;
  nseState.sips.raw = await nseFetchAll('nse_sip_transactions');
  nseState.sips.loaded = true;
  applyNseSipsFilter();
}

function applyNseSipsFilter() {
  const q  = (document.getElementById('nse-sips-search')?.value || '').toLowerCase();
  const sf = nseState.sips.statusFilter;
  const s  = nseState.sips;
  s.filtered = s.raw.filter(r => {
    const mQ  = !q  || (r.client_code || '').toLowerCase().includes(q) ||
                        (r.scheme_name || '').toLowerCase().includes(q) ||
                        (r.scheme_code || '').toLowerCase().includes(q) ||
                        (r.folio_no   || '').toLowerCase().includes(q);
    const mSt = !sf || r.status === sf;
    return mQ && mSt;
  });
  s.page = 1;
  nseSortData('sips');
}

function sortNseSips(col) {
  const s = nseState.sips;
  s.sortAsc = s.sortCol === col ? !s.sortAsc : true;
  s.sortCol = col; s.page = 1;
  nseSortData('sips');
}

function renderNseSipsTable() {
  const s = nseState.sips;
  document.getElementById('nse-sips-count').innerHTML = nseRowBadge(s.filtered.length);
  const rows  = s.filtered.slice((s.page - 1) * NSE_PAGE_SIZE, s.page * NSE_PAGE_SIZE);
  const tbody = document.getElementById('nse-sips-body');
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><div class="empty-icon">🔍</div>No SIP transactions found.</div></td></tr>`;
    renderNsePager('sips', 'nse-sips-pager'); return;
  }
  tbody.innerHTML = rows.map(r => `
    <tr>
      <td><code style="font-size:11px;background:var(--bg3);padding:2px 8px;border-radius:4px">${esc(r.client_code)}</code></td>
      <td style="font-size:12px">${esc(r.scheme_code || '—')}</td>
      <td style="max-width:200px;font-size:12px">${esc(r.scheme_name || '—')}</td>
      <td style="font-weight:700">${fmtAmt(r.amount)}</td>
      <td>${esc(r.frequency || '—')}</td>
      <td style="font-size:12px">${fmtDate(r.start_date)}</td>
      <td style="font-size:12px">${fmtDate(r.end_date)}</td>
      <td>${nseBadge(r.status, SIP_COLORS)}</td>
      <td style="font-size:12px;color:var(--muted)">${esc(r.folio_no || '—')}</td>
    </tr>`).join('');
  renderNsePager('sips', 'nse-sips-pager');
}

/* ══ NSE MANDATES ═════════════════════════════════════════ */

async function loadNseMandates() {
  nseState.mandates.loaded = false;
  document.getElementById('nse-mandates-body').innerHTML =
    `<tr><td colspan="10"><div class="empty-state"><div class="empty-icon">⏳</div>Loading mandates…</div></td></tr>`;
  nseState.mandates.raw = await nseFetchAll('nse_mandates');
  nseState.mandates.loaded = true;
  applyNseMandatesFilter();
}

function applyNseMandatesFilter() {
  const q  = (document.getElementById('nse-mandates-search')?.value || '').toLowerCase();
  const sf = nseState.mandates.statusFilter;
  const s  = nseState.mandates;
  s.filtered = s.raw.filter(r => {
    const mQ  = !q  || (r.mandate_id  || '').toLowerCase().includes(q) ||
                        (r.client_code || '').toLowerCase().includes(q) ||
                        (r.bank_name   || '').toLowerCase().includes(q) ||
                        (r.ac_no       || '').toLowerCase().includes(q);
    const mSt = !sf || r.status === sf;
    return mQ && mSt;
  });
  s.page = 1;
  nseSortData('mandates');
}

function sortNseMandates(col) {
  const s = nseState.mandates;
  s.sortAsc = s.sortCol === col ? !s.sortAsc : true;
  s.sortCol = col; s.page = 1;
  nseSortData('mandates');
}

function renderNseMandatesTable() {
  const s = nseState.mandates;
  document.getElementById('nse-mandates-count').innerHTML = nseRowBadge(s.filtered.length);
  const rows  = s.filtered.slice((s.page - 1) * NSE_PAGE_SIZE, s.page * NSE_PAGE_SIZE);
  const tbody = document.getElementById('nse-mandates-body');
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="10"><div class="empty-state"><div class="empty-icon">🔍</div>No mandates found.</div></td></tr>`;
    renderNsePager('mandates', 'nse-mandates-pager'); return;
  }
  tbody.innerHTML = rows.map(r => `
    <tr>
      <td><code style="font-size:11px;background:var(--bg3);padding:2px 8px;border-radius:4px">${esc(r.mandate_id)}</code></td>
      <td><code style="font-size:11px;background:var(--bg3);padding:2px 8px;border-radius:4px">${esc(r.client_code)}</code></td>
      <td>${esc(r.bank_name || '—')}</td>
      <td style="font-size:12px;font-family:monospace">${esc(r.ac_no || '—')}</td>
      <td style="font-size:12px">${esc(r.ac_type || '—')}</td>
      <td style="font-size:12px">${esc(r.ifsc || '—')}</td>
      <td style="font-weight:700">${fmtAmt(r.amount_limit)}</td>
      <td style="font-size:12px">${fmtDate(r.start_date)}</td>
      <td style="font-size:12px">${fmtDate(r.end_date)}</td>
      <td>${nseBadge(r.status, MANDATE_COLORS)}</td>
    </tr>`).join('');
  renderNsePager('mandates', 'nse-mandates-pager');
}

/* ══ EXPORT CSV ══════════════════════════════════════════ */

function exportNseCsv(type) {
  const s = nseState[type];
  if (!s.filtered.length) { showToast('No data to export', 'error'); return; }
  const colMaps = {
    clients:  ['client_code','client_name','pan','mobile','email','dob','tax_status','holding_nature','bank_name','ac_no','ac_type','ifsc','dp_id','created_at'],
    sips:     ['client_code','scheme_code','scheme_name','amount','frequency','start_date','end_date','status','folio_no','created_at'],
    mandates: ['mandate_id','client_code','bank_name','ac_no','ac_type','ifsc','amount_limit','start_date','end_date','status','created_at'],
  };
  const cols = colMaps[type];
  const csv  = [cols.join(','), ...s.filtered.map(r =>
    cols.map(c => {
      let v = String(r[c] ?? '');
      if (v.includes(',') || v.includes('"') || v.includes('\n'))
        v = '"' + v.replace(/"/g, '""') + '"';
      return v;
    }).join(',')
  )].join('\n');
  const a    = Object.assign(document.createElement('a'), {
    href:     URL.createObjectURL(new Blob([csv], { type: 'text/csv' })),
    download: `nse_${type}_${new Date().toISOString().slice(0,10)}.csv`,
  });
  a.click();
  URL.revokeObjectURL(a.href);
  showToast(`Exported ${s.filtered.length} rows`);
}

/* ══ NSE ANALYTICS ═══════════════════════════════════════ */

async function loadNseAnalytics() {
  const loading = document.getElementById('nse-analytics-loading');
  loading.style.display = 'flex';

  const [clients, sips, mandates] = await Promise.all([
    nseFetchAll('nse_client_master'),
    nseFetchAll('nse_sip_transactions'),
    nseFetchAll('nse_mandates'),
  ]);

  loading.style.display = 'none';

  /* ── KPIs ── */
  const activeSips      = sips.filter(r => r.status === 'ACTIVE');
  const totalSipAmt     = activeSips.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const approvedMandates = mandates.filter(r => r.status === 'APPROVED');
  const totalManAmt     = approvedMandates.reduce((s, r) => s + (Number(r.amount_limit) || 0), 0);
  const successRate     = sips.length ? ((activeSips.length / sips.length) * 100).toFixed(1) : '0.0';

  document.getElementById('nse-kpi-clients').textContent     = clients.length.toLocaleString('en-IN');
  document.getElementById('nse-kpi-active-sips').textContent = activeSips.length.toLocaleString('en-IN') + ' active';
  document.getElementById('nse-kpi-sip-amt').textContent     = fmtAmt(totalSipAmt);
  document.getElementById('nse-kpi-mandates').textContent    = approvedMandates.length.toLocaleString('en-IN') + ' approved';
  document.getElementById('nse-kpi-mandate-amt').textContent = fmtAmt(totalManAmt);
  document.getElementById('nse-kpi-sip-rate').textContent    = successRate + '%';

  /* ── Chart helpers ── */
  const DONUT_COLORS = ['#22c55e','#f59e0b','#ef4444','#7A8899','#E8503A','#60a5fa'];
  const GRID_COLOR   = 'rgba(255,255,255,0.05)';
  const TICK_COLOR   = '#7A8899';
  const LEGEND_OPTS  = { labels: { color: TICK_COLOR, font: { family: "'DM Sans'" }, padding: 16 } };

  function killChart(key) {
    if (nseCharts[key]) { nseCharts[key].destroy(); delete nseCharts[key]; }
  }

  function countBy(arr, key) {
    return arr.reduce((acc, r) => {
      const k = r[key] || 'UNKNOWN';
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});
  }

  /* ── Chart 1: SIP Status Donut ── */
  killChart('sipStatus');
  const sipCounts = countBy(sips, 'status');
  nseCharts.sipStatus = new Chart(document.getElementById('chart-sip-status'), {
    type: 'doughnut',
    data: {
      labels:   Object.keys(sipCounts),
      datasets: [{ data: Object.values(sipCounts), backgroundColor: DONUT_COLORS, borderWidth: 0 }],
    },
    options: {
      responsive: true, maintainAspectRatio: true, cutout: '65%',
      plugins: { legend: LEGEND_OPTS },
    },
  });

  /* ── Chart 2: Mandate Status Donut ── */
  killChart('mandateStatus');
  const manCounts = countBy(mandates, 'status');
  nseCharts.mandateStatus = new Chart(document.getElementById('chart-mandate-status'), {
    type: 'doughnut',
    data: {
      labels:   Object.keys(manCounts),
      datasets: [{ data: Object.values(manCounts), backgroundColor: DONUT_COLORS, borderWidth: 0 }],
    },
    options: {
      responsive: true, maintainAspectRatio: true, cutout: '65%',
      plugins: { legend: LEGEND_OPTS },
    },
  });

  /* ── Chart 3: SIP Amount by Frequency ── */
  killChart('sipFreq');
  const freqTotals = sips.reduce((acc, r) => {
    const k = r.frequency || 'UNKNOWN';
    acc[k] = (acc[k] || 0) + (Number(r.amount) || 0);
    return acc;
  }, {});
  nseCharts.sipFreq = new Chart(document.getElementById('chart-sip-freq'), {
    type: 'bar',
    data: {
      labels:   Object.keys(freqTotals),
      datasets: [{ label: 'SIP Amount (₹)', data: Object.values(freqTotals),
                   backgroundColor: '#E8503A', borderRadius: 8 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: TICK_COLOR }, grid: { color: GRID_COLOR } },
        y: { ticks: { color: TICK_COLOR, callback: v => '₹' + Number(v).toLocaleString('en-IN') },
             grid: { color: GRID_COLOR } },
      },
    },
  });

  /* ── Chart 4: Top 10 Clients by Active SIP Amount ── */
  killChart('top10');
  const clientTotals = activeSips.reduce((acc, r) => {
    acc[r.client_code] = (acc[r.client_code] || 0) + (Number(r.amount) || 0);
    return acc;
  }, {});
  const top10 = Object.entries(clientTotals).sort(([,a],[,b]) => b - a).slice(0, 10);
  nseCharts.top10 = new Chart(document.getElementById('chart-top10'), {
    type: 'bar',
    data: {
      labels:   top10.map(([code]) => code),
      datasets: [{ label: 'Active SIP (₹)', data: top10.map(([,v]) => v),
                   backgroundColor: 'rgba(232,80,58,0.7)', borderColor: '#E8503A',
                   borderWidth: 1, borderRadius: 6 }],
    },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: TICK_COLOR, callback: v => '₹' + Number(v).toLocaleString('en-IN') },
             grid: { color: GRID_COLOR } },
        y: { ticks: { color: TICK_COLOR }, grid: { display: false } },
      },
    },
  });

  /* ── Expiring SIPs table (next 90 days) ── */
  const today  = new Date(); today.setHours(0,0,0,0);
  const cutoff = new Date(today); cutoff.setDate(today.getDate() + 90);
  const expiring = sips
    .filter(r => r.status === 'ACTIVE' && r.end_date &&
                 new Date(r.end_date) >= today && new Date(r.end_date) <= cutoff)
    .sort((a, b) => new Date(a.end_date) - new Date(b.end_date));

  const expiryTbody = document.getElementById('nse-expiring-body');
  if (!expiring.length) {
    expiryTbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">✅</div>No SIPs expiring in the next 90 days.</div></td></tr>`;
  } else {
    expiryTbody.innerHTML = expiring.map(r => {
      const daysLeft = Math.ceil((new Date(r.end_date) - today) / 86400000);
      const urgency  = daysLeft <= 30 ? '#ef4444' : daysLeft <= 60 ? '#f59e0b' : '#22c55e';
      return `<tr>
        <td><code style="font-size:11px;background:var(--bg3);padding:2px 8px;border-radius:4px">${esc(r.client_code)}</code></td>
        <td style="max-width:200px;font-size:12px">${esc(r.scheme_name || '—')}</td>
        <td style="font-weight:700">${fmtAmt(r.amount)}</td>
        <td>${esc(r.frequency || '—')}</td>
        <td style="font-size:12px">${fmtDate(r.end_date)}</td>
        <td><span style="font-size:11px;padding:3px 10px;border-radius:100px;background:${urgency}22;color:${urgency};font-weight:700">${daysLeft}d left</span></td>
      </tr>`;
    }).join('');
  }
}

/* ══ BOOT ══ */
checkAuth();
