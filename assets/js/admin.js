/* ══════════════════════════════════════════════════════
   ADMIN.JS — Amirtharaj Investments Admin Dashboard
   ══════════════════════════════════════════════════════ */

const SUPABASE_URL  = window.__ENV__.SUPABASE_URL;
const SUPABASE_ANON = window.__ENV__.SUPABASE_ANON;
const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON);

const tabMeta = {
  overview:      { title: 'Overview',                          sub: "Welcome back — here's what's happening today." },
  dashboard:     { title: 'CAMS & KARVY Client Master',        sub: 'Upload CAMS/Karvy CSV, clean and push to Supabase.' },
  'trx-upload':  { title: 'CAMS & KARVY Transactions Upload',  sub: 'Upload transaction CSV, review against client master, push to Supabase.' },
  enquiries:     { title: 'Enquiries',                         sub: 'Messages submitted via the contact form.' },
  clients:       { title: 'Client Profiles',                   sub: 'Registered users and admin roles.' },
  portfolio:     { title: 'Portfolio',                         sub: 'Portfolio management module.' },
  reports:       { title: 'Reports',                           sub: 'Reporting and data export.' },
  settings:      { title: 'Settings',                          sub: 'Site configuration and preferences.' },
  'nse-clients':      { title: 'NSE Client Master',            sub: 'All NSE registered clients and their bank details.' },
  'nse-sips':         { title: 'NSE SIP Transactions',         sub: 'Active, paused and completed SIP mandates.' },
  'nse-mandates':     { title: 'NSE Mandates',                 sub: 'Bank mandate approvals and limits.' },
  'nse-analytics':    { title: 'NSE Analytics',                sub: 'SIP and mandate performance overview.' },
  'ck-contacts':           { title: 'CAMS & KARVY Contacts',           sub: 'Full client folio and scheme contact data from CAMS and KARVY.' },
  'ck-transactions':       { title: 'CAMS & KARVY Transactions',       sub: 'All buy, sell and switch transactions from CAMS and KARVY.' },
  'ck-client-analytics':   { title: 'Client Portfolio Analytics',      sub: 'Search a client and explore their full transaction history and portfolio summary.' },
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
  // CAMS & KARVY — lazy-load on first visit
  if (tab === 'ck-contacts'     && !nseState['ck-contacts'].loaded)     loadCkContacts();
  if (tab === 'ck-transactions' && !nseState['ck-transactions'].loaded) loadCkTransactions();
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

/* Min-widths per column (px) */
const NSE_TABLE_CONFIG = {
  clients:          { minW: { default: 120, id: 60, client_code: 110, first_name: 130, last_name: 130, pan: 120, mobile: 120, email: 180, dob: 100, status: 90 } },
  sips:             { minW: { default: 120, id: 60, client_code: 110, scheme_name: 220, rta_scheme_code: 140, amount: 100, status: 90, frequency: 110 } },
  mandates:         { minW: { default: 120, id: 60, client_code: 110, bank_name: 160, amount: 100, status: 90, mandate_type: 130 } },
  'ck-contacts':    { minW: { default: 130, id: 60, ai_code: 90, 'Folio No': 130, inv_name: 170, pan_no: 120, mobile_no: 120, email: 200, sch_name: 230, city: 110, rep_date: 100, unit_balance: 120, total_amount_value: 140 } },
  'ck-transactions':{ minW: { default: 130, id: 60, pan: 120, investor_name: 170, folio_no: 130, scheme_name: 240, fund_house: 150, scheme_category: 160, amount: 100, nav: 80, units: 90, trade_date: 110, trxn_type: 110 } },
};

const nseState = {
  clients:          { raw: [], filtered: [], page: 1, pageSize: 50, sortCol: 'first_name',     sortAsc: true,  loaded: false, cols: null, hiddenCols: new Set(), colFilters: {} },
  sips:             { raw: [], filtered: [], page: 1, pageSize: 50, sortCol: 'created_at',     sortAsc: false, loaded: false, cols: null, hiddenCols: new Set(), colFilters: {} },
  mandates:         { raw: [], filtered: [], page: 1, pageSize: 50, sortCol: 'created_at',     sortAsc: false, loaded: false, cols: null, hiddenCols: new Set(), colFilters: {} },
  'ck-contacts':    { raw: [], filtered: [], page: 1, pageSize: 50, sortCol: 'inv_name',       sortAsc: true,  loaded: false, cols: null, hiddenCols: new Set(), colFilters: {} },
  'ck-transactions':{ raw: [], filtered: [], page: 1, pageSize: 50, sortCol: 'trade_date',     sortAsc: false, loaded: false, cols: null, hiddenCols: new Set(), colFilters: {} },
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

function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? String(d) : dt.toLocaleDateString('en-IN');
}
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
  if (type === 'clients')        renderNseClientsTable();
  if (type === 'sips')           renderNseSipsTable();
  if (type === 'mandates')       renderNseMandatesTable();
  if (type === 'ck-contacts')    renderCkContactsTable();
  if (type === 'ck-transactions')renderCkTransactionsTable();
}

/* ── Generic pagination renderer (Supabase-style) ── */
function renderNsePager(type, pagerId) {
  const s     = nseState[type];
  const ps    = s.pageSize || NSE_PAGE_SIZE;
  const total = Math.ceil(s.filtered.length / ps) || 1;
  const el    = document.getElementById(pagerId);
  if (!el) return;

  const btnBase  = `style="display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:5px;background:#1A1F2E;border:1px solid rgba(255,255,255,0.1);font-size:14px;line-height:1;transition:background 0.15s;"`;
  const btnDis   = `style="display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:5px;background:#111820;border:1px solid rgba(255,255,255,0.06);font-size:14px;line-height:1;opacity:0.35;pointer-events:none;"`;
  const selStyle = `background:#1A1F2E;border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:#F0F4F8;font-size:12px;padding:4px 10px;cursor:pointer;outline:none;height:28px;`;
  const inpStyle = `width:40px;text-align:center;background:#1A1F2E;border:1px solid rgba(255,255,255,0.12);border-radius:5px;color:#F0F4F8;font-size:13px;padding:2px 4px;outline:none;height:26px;`;
  const rowOpts  = [25,50,100].map(n =>
    `<option value="${n}"${ps===n?' selected':''}>${n} rows</option>`
  ).join('');

  el.innerHTML = `
    <button type="button" ${s.page<=1 ? btnDis : btnBase} onclick="nseChangePage('${type}','${pagerId}',-1)" title="Previous page">&#8592;</button>
    <span style="display:inline-flex;align-items:center;gap:6px;font-size:13px;color:#7A8899">
      Page
      <input type="number" min="1" max="${total}" value="${s.page}" ${inpStyle}
        onchange="nseGoToPage('${type}','${pagerId}',+this.value)"
        onkeydown="if(event.key==='Enter')nseGoToPage('${type}','${pagerId}',+this.value)">
      of <strong style="color:#F0F4F8">${total}</strong>
    </span>
    <button type="button" ${s.page>=total ? btnDis : btnBase} onclick="nseChangePage('${type}','${pagerId}',1)" title="Next page">&#8594;</button>
    <span style="width:1px;height:20px;background:rgba(255,255,255,0.1);display:inline-block;margin:0 4px;flex-shrink:0"></span>
    <select ${selStyle} onchange="nseSetPageSize('${type}','${pagerId}',+this.value)" title="Rows per page">${rowOpts}</select>
    <span style="font-size:12px;color:#7A8899;margin-left:2px">${s.filtered.length.toLocaleString('en-IN')} records</span>
  `;
}

function nseGoToPage(type, pagerId, page) {
  const s     = nseState[type];
  const ps    = s.pageSize || NSE_PAGE_SIZE;
  const total = Math.ceil(s.filtered.length / ps) || 1;
  s.page      = Math.max(1, Math.min(total, page || 1));
  if (type === 'clients')        renderNseClientsTable();
  if (type === 'sips')           renderNseSipsTable();
  if (type === 'mandates')       renderNseMandatesTable();
  if (type === 'ck-contacts')    renderCkContactsTable();
  if (type === 'ck-transactions')renderCkTransactionsTable();
  const wrapIds = { clients: 'nse-clients-wrap', sips: 'nse-sips-wrap', mandates: 'nse-mandates-wrap', 'ck-contacts': 'nse-ck-contacts-wrap', 'ck-transactions': 'nse-ck-transactions-wrap' };
  const wrap = document.getElementById(wrapIds[type]);
  if (wrap) wrap.scrollTop = 0;
}

function nseChangePage(type, pagerId, delta) {
  const s     = nseState[type];
  const ps    = s.pageSize || NSE_PAGE_SIZE;
  const total = Math.ceil(s.filtered.length / ps) || 1;
  s.page      = Math.max(1, Math.min(total, s.page + delta));
  if (type === 'clients')        renderNseClientsTable();
  if (type === 'sips')           renderNseSipsTable();
  if (type === 'mandates')       renderNseMandatesTable();
  if (type === 'ck-contacts')    renderCkContactsTable();
  if (type === 'ck-transactions')renderCkTransactionsTable();
  const wrapIds = { clients: 'nse-clients-wrap', sips: 'nse-sips-wrap', mandates: 'nse-mandates-wrap', 'ck-contacts': 'nse-ck-contacts-wrap', 'ck-transactions': 'nse-ck-transactions-wrap' };
  const wrap = document.getElementById(wrapIds[type]);
  if (wrap) wrap.scrollTop = 0;
}

function nseSetPageSize(type, pagerId, size) {
  nseState[type].pageSize = size;
  nseState[type].page     = 1;
  if (type === 'clients')        renderNseClientsTable();
  if (type === 'sips')           renderNseSipsTable();
  if (type === 'mandates')       renderNseMandatesTable();
  if (type === 'ck-contacts')    renderCkContactsTable();
  if (type === 'ck-transactions')renderCkTransactionsTable();
}

/* ══ NSE CLIENTS ══════════════════════════════════════════ */

async function loadNseClients() {
  nseState.clients.loaded = false;
  nseState.clients.cols   = null;
  nseState.clients.colFilters = {};
  document.getElementById('nse-clients-body').innerHTML =
    `<tr><td colspan="9"><div class="empty-state"><div class="empty-icon">⏳</div>Loading NSE clients…</div></td></tr>`;
  nseState.clients.raw = await nseFetchAll('nse_client_master');
  nseState.clients.loaded = true;
  nseApplyAllFilters('clients');
}

function applyNseClientsFilter() { nseApplyAllFilters('clients'); }

function sortNseClients(col) {
  const s = nseState.clients;
  s.sortAsc = s.sortCol === col ? !s.sortAsc : true;
  s.sortCol = col; s.page = 1;
  nseSortData('clients');
}

function renderNseClientsTable() {
  nseRenderDynamic('clients', 'nse-clients-head', 'nse-clients-body', 'nse-clients-pager');
}

/* ══ NSE SIP TRANSACTIONS ═════════════════════════════════ */

async function loadNseSips() {
  nseState.sips.loaded = false;
  nseState.sips.cols   = null;
  nseState.sips.colFilters = {};
  document.getElementById('nse-sips-body').innerHTML =
    `<tr><td colspan="9"><div class="empty-state"><div class="empty-icon">⏳</div>Loading SIP transactions…</div></td></tr>`;
  nseState.sips.raw = await nseFetchAll('nse_sip_transactions');
  nseState.sips.loaded = true;
  nseApplyAllFilters('sips');
}

function applyNseSipsFilter() { nseApplyAllFilters('sips'); }

function sortNseSips(col) {
  const s = nseState.sips;
  s.sortAsc = s.sortCol === col ? !s.sortAsc : true;
  s.sortCol = col; s.page = 1;
  nseSortData('sips');
}

function renderNseSipsTable() {
  nseRenderDynamic('sips', 'nse-sips-head', 'nse-sips-body', 'nse-sips-pager');
}

/* ══ NSE MANDATES ═════════════════════════════════════════ */

async function loadNseMandates() {
  nseState.mandates.loaded = false;
  nseState.mandates.cols   = null;
  nseState.mandates.colFilters = {};
  document.getElementById('nse-mandates-body').innerHTML =
    `<tr><td colspan="10"><div class="empty-state"><div class="empty-icon">⏳</div>Loading mandates…</div></td></tr>`;
  nseState.mandates.raw = await nseFetchAll('nse_mandates');
  nseState.mandates.loaded = true;
  nseApplyAllFilters('mandates');
}

function applyNseMandatesFilter() { nseApplyAllFilters('mandates'); }

function sortNseMandates(col) {
  const s = nseState.mandates;
  s.sortAsc = s.sortCol === col ? !s.sortAsc : true;
  s.sortCol = col; s.page = 1;
  nseSortData('mandates');
}

function renderNseMandatesTable() {
  nseRenderDynamic('mandates', 'nse-mandates-head', 'nse-mandates-body', 'nse-mandates-pager');
}

/* ══ DYNAMIC TABLE RENDERER ══════════════════════════════ */

/* Color maps for status columns */
const DATE_COLS  = new Set(['created_at','modified_at','last_modified_at','modified_at',
  'reg_date','start_date','end_date','dob','approved_date','registration_date',
  'date_of_upload','date_of_reupload','xsip_cancellation_date','next_due_date',
  'bank1_created_at','bank1_modified_at','bank2_created_at','bank2_modified_at']);
const MONEY_COLS = new Set(['amount','amount_limit','brokerage',
  'total_installment_amt_paid','nominee1_percent','nominee2_percent','nominee3_percent']);

function nseRenderDynamic(type, headId, bodyId, pagerId) {
  const s       = nseState[type];
  const ps      = s.pageSize || NSE_PAGE_SIZE;
  const thead   = document.getElementById(headId);
  const tbody   = document.getElementById(bodyId);
  const countEl = document.getElementById('nse-' + type + '-count');
  if (countEl) countEl.innerHTML = nseRowBadge(s.filtered.length);

  const rows = s.filtered.slice((s.page - 1) * ps, s.page * ps);

  if (!rows.length) {
    thead.innerHTML = '';
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">🔍</div>No data found.</div></td></tr>`;
    renderNsePager(type, pagerId);
    return;
  }

  /* Init column order on first load; restore saved order + visibility */
  if (!s.cols) {
    s.cols = Object.keys(rows[0]);
    nseLoadColOrder(type);
    nseLoadColVisibility(type);
  }
  const allCols = s.cols;
  const cols    = allCols.filter(c => !s.hiddenCols.has(c));

  const cfg  = NSE_TABLE_CONFIG[type] || { minW: { default: 120 } };

  const sortFns = { clients: 'sortNseClients', sips: 'sortNseSips', mandates: 'sortNseMandates', 'ck-contacts': 'sortCkContacts', 'ck-transactions': 'sortCkTransactions' };
  const fn      = sortFns[type];

  /* Render sortable headers — all columns draggable */
  thead.innerHTML = `<tr>${cols.map((c, visIdx) => {
    const minW  = nseCW(type, c);
    const arrow = s.sortCol === c ? (s.sortAsc ? ' ↑' : ' ↓') : '';
    return `<th class="sortable nse-col-draggable" data-col="${c}" draggable="true" onclick="${fn}('${c}')"
              style="white-space:nowrap;min-width:${minW}px;cursor:pointer;"
            >${c.replace(/_/g, ' ')}${arrow}</th>`;
  }).join('')}</tr>`;

  /* Set up column drag-and-drop (idempotent — runs once per thead) */
  nseSetupColDrag(type, headId);

  /* Render rows */
  tbody.innerHTML = rows.map((r, rowIdx) => {
    const globalIdx = (s.page - 1) * ps + rowIdx;
    const rowKey    = r.id ?? globalIdx;
    return `<tr>${cols.map(c => {
      const v = r[c];

      let inner;
      if (v === null || v === undefined || v === '') {
        inner = '—';
      } else if (c === 'status') {
        const map = type === 'mandates' ? MANDATE_COLORS : SIP_COLORS;
        inner = nseBadge(String(v), map);
      } else if (MONEY_COLS.has(c)) {
        inner = `<span style="font-weight:700;font-size:13px">${fmtAmt(v)}</span>`;
      } else if (DATE_COLS.has(c) || c.endsWith('_at')) {
        inner = `<span style="color:var(--muted)">${fmtDate(v)}</span>`;
      } else if (typeof v === 'number') {
        inner = v.toLocaleString('en-IN');
      } else {
        inner = `<span style="max-width:260px;overflow:hidden;text-overflow:ellipsis;display:block" title="${esc(String(v))}">${esc(String(v))}</span>`;
      }

      const rawVal   = esc(String(v ?? ''));
      const editAttr = c !== 'id'
        ? ` ondblclick="nseInlineEdit(this,'${type}','${c}','${rowKey}')" data-raw="${rawVal}"`
        : '';

      return `<td style="white-space:nowrap;padding:11px 16px;border-bottom:1px solid rgba(255,255,255,0.07);font-size:13px;${c !== 'id' ? 'cursor:pointer;' : ''}"${editAttr}>${inner}</td>`;
    }).join('')}</tr>`;
  }).join('');

  /* ── Force table width so columns are never squished ── */
  const table = thead.parentElement;
  if (table) {
    table.style.width          = 'max-content';
    table.style.minWidth       = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.tableLayout    = 'auto';
  }

  /* ── Sync mirror scrollbar width to actual table width ── */
  const hbarIds = { clients: 'nse-clients-hbar', sips: 'nse-sips-hbar', mandates: 'nse-mandates-hbar', 'ck-contacts': 'nse-ck-contacts-hbar', 'ck-transactions': 'nse-ck-transactions-hbar' };
  const wrapIds = { clients: 'nse-clients-wrap', sips: 'nse-sips-wrap', mandates: 'nse-mandates-wrap', 'ck-contacts': 'nse-ck-contacts-wrap', 'ck-transactions': 'nse-ck-transactions-wrap' };
  /* Use rAF to let the browser finish painting before reading scrollWidth */
  requestAnimationFrame(() => nseInitHScroll(wrapIds[type], hbarIds[type]));

  renderNsePager(type, pagerId);
}

/* ── Mirror scrollbar: keeps hbar ↔ table-wrap in sync ── */
function nseInitHScroll(wrapId, hbarId) {
  const wrap  = document.getElementById(wrapId);
  const hbar  = document.getElementById(hbarId);
  const inner = hbar ? hbar.querySelector('.nse-hscroll-inner') : null;
  if (!wrap || !hbar || !inner) return;

  /* Set inner div width = full scrollable width of the table */
  inner.style.width = wrap.scrollWidth + 'px';

  /* Remove old listeners before re-attaching (re-render case) */
  const newHbar = hbar.cloneNode(true);
  hbar.parentNode.replaceChild(newHbar, hbar);
  const newInner = newHbar.querySelector('.nse-hscroll-inner');

  /* hbar drag → scroll table */
  newHbar.addEventListener('scroll', () => { wrap.scrollLeft = newHbar.scrollLeft; });

  /* table scroll → move hbar thumb */
  wrap.addEventListener('scroll', () => {
    newHbar.scrollLeft = wrap.scrollLeft;
    newInner.style.width = wrap.scrollWidth + 'px';   /* update if table width changed */
  });
}

/* ══ NSE FILTER + PILLS ══════════════════════════════════ */

/* Operator definitions */
const NSE_OPS = [
  { val: 'contains',    label: 'contains' },
  { val: 'equals',      label: '= equals' },
  { val: 'not_equals',  label: '≠ not equals' },
  { val: 'starts',      label: 'starts with' },
  { val: 'gt',          label: '> greater than' },
  { val: 'lt',          label: '< less than' },
  { val: 'is_null',     label: 'is null' },
  { val: 'not_null',    label: 'is not null' },
];

/* Per-type: { col: { op, val } } */
function nseAdvFilters(type) { return nseState[type].advFilters || (nseState[type].advFilters = {}); }

function nseTestCell(v, op, fval) {
  if (op === 'is_null')    return v === null || v === undefined || v === '';
  if (op === 'not_null')   return v !== null && v !== undefined && v !== '';
  const s = String(v ?? '').toLowerCase();
  const f = fval.toLowerCase();
  if (op === 'contains')   return s.includes(f);
  if (op === 'equals')     return s === f;
  if (op === 'not_equals') return s !== f;
  if (op === 'starts')     return s.startsWith(f);
  const n = parseFloat(v), fn = parseFloat(fval);
  if (op === 'gt') return !isNaN(n) && !isNaN(fn) ? n > fn : s > f;
  if (op === 'lt') return !isNaN(n) && !isNaN(fn) ? n < fn : s < f;
  return true;
}

function nseApplyAllFilters(type) {
  const s  = nseState[type];
  const q  = (document.getElementById('nse-' + type + '-search')?.value || '').toLowerCase();
  const af = nseAdvFilters(type);
  s.filtered = s.raw.filter(r => {
    if (q && !Object.values(r).some(v => String(v ?? '').toLowerCase().includes(q))) return false;
    for (const [col, rule] of Object.entries(af)) {
      if (!rule.active) continue;
      if (!nseTestCell(r[col], rule.op, rule.val || '')) return false;
    }
    return true;
  });
  s.page = 1;
  nseRenderFilterPills(type);
  nseSortData(type);
}

function nseClearFilters(type) {
  nseState[type].advFilters = {};
  const searchEl = document.getElementById('nse-' + type + '-search');
  if (searchEl) searchEl.value = '';
  /* Re-render panel if open */
  const panel = document.getElementById('nse-' + type + '-adv-panel');
  if (panel && panel.style.display !== 'none') nseRenderAdvPanel(type);
  nseApplyAllFilters(type);
}

function nseRenderFilterPills(type) {
  const pillsRow = document.getElementById('nse-' + type + '-pills');
  if (!pillsRow) return;
  const af = nseAdvFilters(type);
  const q  = document.getElementById('nse-' + type + '-search')?.value || '';
  const pills = [];
  if (q) pills.push(
    `<span class="nse-pill">Search: "${esc(q)}"` +
    ` <button onclick="document.getElementById('nse-${type}-search').value='';nseApplyAllFilters('${type}')">×</button></span>`
  );
  for (const [col, rule] of Object.entries(af)) {
    if (!rule.active) continue;
    const opLabel = NSE_OPS.find(o => o.val === rule.op)?.label || rule.op;
    const valPart = (rule.op === 'is_null' || rule.op === 'not_null') ? '' : `: "${esc(rule.val)}"`;
    pills.push(
      `<span class="nse-pill">${col.replace(/_/g,' ')} ${opLabel}${valPart}` +
      ` <button onclick="nseRemoveAdvFilter('${type}','${col}')">×</button></span>`
    );
  }
  pillsRow.innerHTML = pills.join('');
}

function nseRemoveAdvFilter(type, col) {
  delete nseAdvFilters(type)[col];
  const panel = document.getElementById('nse-' + type + '-adv-panel');
  if (panel && panel.style.display !== 'none') nseRenderAdvPanel(type);
  nseApplyAllFilters(type);
}

/* ── Advanced Filter Panel ── */
function nseToggleAdvFilter(type) {
  const panel = document.getElementById('nse-' + type + '-adv-panel');
  if (!panel) return;
  if (panel.style.display === 'none') {
    nseRenderAdvPanel(type);
    panel.style.display = 'block';
  } else {
    panel.style.display = 'none';
  }
}

function nseRenderAdvPanel(type) {
  const panel = document.getElementById('nse-' + type + '-adv-panel');
  const s     = nseState[type];
  const af    = nseAdvFilters(type);
  if (!panel) return;

  const cols  = s.cols || [];
  const active = Object.values(af).filter(r => r.active).length;

  const rows = cols.map(c => {
    const rule   = af[c] || { active: false, op: 'contains', val: '' };
    const noVal  = rule.op === 'is_null' || rule.op === 'not_null';
    const opOpts = NSE_OPS.map(o =>
      `<option value="${o.val}"${rule.op === o.val ? ' selected' : ''}>${o.label}</option>`
    ).join('');
    return `
      <div class="nse-adv-row">
        <label class="nse-adv-check">
          <input type="checkbox" ${rule.active ? 'checked' : ''}
            onchange="nseAdvToggleRow('${type}','${c}',this.checked)">
          <span class="nse-adv-colname">${c.replace(/_/g, ' ')}</span>
        </label>
        <select class="nse-adv-op" id="nse-adv-op-${type}-${c}"
          ${!rule.active ? 'disabled' : ''}
          onchange="nseAdvSetOp('${type}','${c}',this.value)">${opOpts}</select>
        <input type="text" class="nse-adv-val" id="nse-adv-val-${type}-${c}"
          value="${esc(rule.val || '')}"
          placeholder="value…"
          ${!rule.active || noVal ? 'disabled' : ''}
          oninput="nseAdvSetVal('${type}','${c}',this.value)">
      </div>`;
  }).join('');

  panel.innerHTML = `
    <div class="nse-adv-panel-header">
      <span>Column Filters</span>
      <button type="button" class="nse-adv-close" onclick="nseToggleAdvFilter('${type}')">×</button>
    </div>
    <div class="nse-adv-cols-wrap">${rows}</div>
    <div class="nse-adv-panel-footer">
      <button type="button" class="btn-sm" onclick="nseApplyAllFilters('${type}')">Apply</button>
      <button type="button" class="btn-sm" onclick="nseClearFilters('${type}')">Clear All</button>
      <span class="nse-adv-active-count">${active} filter${active !== 1 ? 's' : ''} active</span>
    </div>`;
}

function nseAdvToggleRow(type, col, active) {
  const af   = nseAdvFilters(type);
  if (!af[col]) af[col] = { active: false, op: 'contains', val: '' };
  af[col].active = active;
  /* enable/disable sibling inputs */
  const opEl  = document.getElementById('nse-adv-op-'  + type + '-' + col);
  const valEl = document.getElementById('nse-adv-val-' + type + '-' + col);
  if (opEl)  opEl.disabled  = !active;
  const noVal = opEl ? (opEl.value === 'is_null' || opEl.value === 'not_null') : false;
  if (valEl) valEl.disabled = !active || noVal;
  nseApplyAllFilters(type);
}

function nseAdvSetOp(type, col, op) {
  const af = nseAdvFilters(type);
  if (!af[col]) af[col] = { active: true, op, val: '' };
  af[col].op = op;
  const valEl = document.getElementById('nse-adv-val-' + type + '-' + col);
  if (valEl) valEl.disabled = (op === 'is_null' || op === 'not_null');
  nseApplyAllFilters(type);
}

function nseAdvSetVal(type, col, val) {
  const af = nseAdvFilters(type);
  if (!af[col]) af[col] = { active: true, op: 'contains', val };
  af[col].val = val;
  nseApplyAllFilters(type);
}

/* ══ COLUMN VISIBILITY (kept for ⚙ Columns button) ════════ */

function nseCW(type, col) {
  const cfg = NSE_TABLE_CONFIG[type];
  if (!cfg) return 120;
  return cfg.minW[col] ?? cfg.minW.default ?? 120;
}

function nseLoadColVisibility(type) {
  try {
    const stored = localStorage.getItem('nse_hidden_' + type);
    nseState[type].hiddenCols = stored ? new Set(JSON.parse(stored)) : new Set();
  } catch { nseState[type].hiddenCols = new Set(); }
}

function nseSaveColVisibility(type) {
  localStorage.setItem('nse_hidden_' + type, JSON.stringify([...nseState[type].hiddenCols]));
}

/* ══ COLUMN ORDER — persist drag-reordered layout ══════════ */

function nseSaveColOrder(type) {
  try {
    localStorage.setItem('nse_col_order_' + type, JSON.stringify(nseState[type].cols));
  } catch {}
}

function nseLoadColOrder(type) {
  try {
    const stored = localStorage.getItem('nse_col_order_' + type);
    if (!stored) return;
    const saved   = JSON.parse(stored);
    const current = nseState[type].cols;
    const curSet  = new Set(current);
    const savSet  = new Set(saved);
    // saved order for existing cols + any new cols appended at end
    nseState[type].cols = [
      ...saved.filter(c => curSet.has(c)),
      ...current.filter(c => !savSet.has(c)),
    ];
  } catch {}
}

/* ══ COLUMN DRAG-AND-DROP ══════════════════════════════════ */

const _colDragSetup = new Set();   // headIds that already have listeners
let   _colDrag      = null;        // { type, col, headId }

function nseSetupColDrag(type, headId) {
  if (_colDragSetup.has(headId)) return;
  _colDragSetup.add(headId);

  const thead = document.getElementById(headId);
  if (!thead) return;

  thead.addEventListener('dragstart', e => {
    const th = e.target.closest('th[data-col]');
    if (!th) return;
    _colDrag = { type, col: th.dataset.col, headId };
    th.classList.add('nse-col-dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', th.dataset.col); // required in Firefox
  });

  thead.addEventListener('dragover', e => {
    const th = e.target.closest('th[data-col]');
    if (!th || !_colDrag || _colDrag.headId !== headId) return;
    if (th.dataset.col === _colDrag.col) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    // Show left/right indicator based on mouse position within the th
    const rect   = th.getBoundingClientRect();
    const isLeft = e.clientX < rect.left + rect.width / 2;
    thead.querySelectorAll('th').forEach(h => h.classList.remove('nse-drag-left', 'nse-drag-right'));
    th.classList.add(isLeft ? 'nse-drag-left' : 'nse-drag-right');
  });

  thead.addEventListener('dragleave', e => {
    if (!e.relatedTarget || !thead.contains(e.relatedTarget))
      thead.querySelectorAll('th').forEach(h => h.classList.remove('nse-drag-left', 'nse-drag-right'));
  });

  thead.addEventListener('drop', e => {
    e.preventDefault();
    thead.querySelectorAll('th').forEach(h => h.classList.remove('nse-drag-left', 'nse-drag-right', 'nse-col-dragging'));

    const th = e.target.closest('th[data-col]');
    if (!th || !_colDrag || _colDrag.headId !== headId) { _colDrag = null; return; }

    const targetCol = th.dataset.col;
    const srcCol    = _colDrag.col;
    _colDrag = null;
    if (srcCol === targetCol) return;

    const s    = nseState[type];
    const cols = s.cols;
    const from = cols.indexOf(srcCol);
    let   to   = cols.indexOf(targetCol);
    if (from < 0 || to < 0) return;

    // Determine insert before or after based on mouse position
    const rect   = th.getBoundingClientRect();
    const isLeft = e.clientX < rect.left + rect.width / 2;
    if (!isLeft && to < cols.length - 1) to += 1;

    cols.splice(from, 1);
    const insertAt = from < to ? to - 1 : to;
    cols.splice(insertAt, 0, srcCol);

    nseSaveColOrder(type);

    // Re-render
    if (type === 'clients')          renderNseClientsTable();
    else if (type === 'sips')        renderNseSipsTable();
    else if (type === 'mandates')    renderNseMandatesTable();
    else if (type === 'ck-contacts')    renderCkContactsTable();
    else if (type === 'ck-transactions')renderCkTransactionsTable();
  });

  thead.addEventListener('dragend', () => {
    thead.querySelectorAll('th').forEach(h =>
      h.classList.remove('nse-col-dragging', 'nse-drag-left', 'nse-drag-right'));
    _colDrag = null;
  });
}

function nseToggleColDropdown(type) {
  const wrap = document.getElementById('nse-' + type + '-col-vis');
  const dd   = wrap?.querySelector('.nse-col-dropdown');
  if (!dd) return;
  const open = dd.style.display === 'block';
  document.querySelectorAll('.nse-col-dropdown').forEach(d => { d.style.display = 'none'; });
  if (!open) { nseRenderColDropdown(type); dd.style.display = 'block'; }
}

function nseRenderColDropdown(type) {
  const s  = nseState[type];
  const dd = document.querySelector('#nse-' + type + '-col-vis .nse-col-dropdown');
  if (!dd || !s.cols) return;
  dd.innerHTML = s.cols.map(c =>
    `<label><input type="checkbox" ${s.hiddenCols.has(c) ? '' : 'checked'}
      onchange="nseToggleCol('${type}','${c}',this.checked)"> ${c.replace(/_/g, ' ')}</label>`
  ).join('');
}

function nseToggleCol(type, col, visible) {
  const s = nseState[type];
  if (visible) s.hiddenCols.delete(col);
  else s.hiddenCols.add(col);
  nseSaveColVisibility(type);
  if (type === 'clients')  renderNseClientsTable();
  if (type === 'sips')     renderNseSipsTable();
  if (type === 'mandates') renderNseMandatesTable();
}

/* Close col-vis dropdown when clicking outside */
document.addEventListener('click', e => {
  if (!e.target.closest('.nse-col-vis-wrap'))
    document.querySelectorAll('.nse-col-dropdown').forEach(d => { d.style.display = 'none'; });
});

/* ══ INLINE CELL EDITING ══════════════════════════════════ */

function nseInlineEdit(td, type, col, rowKey) {
  if (td.classList.contains('nse-editing')) return;
  const orig = td.dataset.raw || '';
  const saved = td.innerHTML;
  td.classList.add('nse-editing');
  td.innerHTML = `<input type="text" value="${esc(orig)}">`;
  const inp = td.querySelector('input');
  inp.focus(); inp.select();
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); nseSaveEdit(td, type, col, rowKey, inp.value, saved); }
    if (e.key === 'Escape') { nseRestoreCell(td, saved); }
  });
  inp.addEventListener('blur', () => {
    setTimeout(() => { if (td.classList.contains('nse-editing')) nseSaveEdit(td, type, col, rowKey, inp.value, saved); }, 120);
  });
}

function nseRestoreCell(td, saved) {
  td.classList.remove('nse-editing');
  td.innerHTML = saved;
}

async function nseSaveEdit(td, type, col, rowKey, newVal, saved) {
  if (!td.classList.contains('nse-editing')) return;
  td.classList.remove('nse-editing');
  if (newVal === (td.dataset.raw || '')) { td.innerHTML = saved; return; }

  const tables = { clients: 'nse_client_master', sips: 'nse_sip_transactions', mandates: 'nse_mandates', 'ck-contacts': 'CAMS_KARVY_Contact', 'ck-transactions': 'transactions' };
  td.innerHTML = `<span style="opacity:0.5;font-size:12px">Saving…</span>`;

  const { error } = await sb.from(tables[type]).update({ [col]: newVal || null }).eq('id', rowKey);
  if (error) { showToast('Update failed: ' + error.message, 'error'); td.innerHTML = saved; return; }

  /* Update in-memory data */
  const dbVal = newVal || null;
  [nseState[type].raw, nseState[type].filtered].forEach(arr => {
    const row = arr.find(r => String(r.id) === String(rowKey));
    if (row) row[col] = dbVal;
  });

  /* Re-render just this cell */
  td.dataset.raw = newVal;
  let inner;
  if (!newVal) inner = '—';
  else if (DATE_COLS.has(col) || col.endsWith('_at'))
    inner = `<span style="color:var(--muted)">${fmtDate(newVal)}</span>`;
  else if (MONEY_COLS.has(col))
    inner = `<span style="font-weight:700;font-size:13px">${fmtAmt(Number(newVal))}</span>`;
  else
    inner = `<span style="max-width:220px;overflow:hidden;text-overflow:ellipsis;display:block" title="${esc(newVal)}">${esc(newVal)}</span>`;
  td.innerHTML = inner;
  showToast(`${col.replace(/_/g, ' ')} updated`);
}

/* ══ EXPORT CSV ══════════════════════════════════════════ */

function exportNseCsv(type) {
  const s = nseState[type];
  if (!s.filtered.length) { showToast('No data to export', 'error'); return; }

  /* Use all columns from the actual data */
  const cols = Object.keys(s.filtered[0]);
  const csv  = [cols.join(','), ...s.filtered.map(r =>
    cols.map(c => {
      let v = String(r[c] ?? '');
      if (v.includes(',') || v.includes('"') || v.includes('\n'))
        v = '"' + v.replace(/"/g, '""') + '"';
      return v;
    }).join(',')
  )].join('\n');
  const a = Object.assign(document.createElement('a'), {
    href:     URL.createObjectURL(new Blob([csv], { type: 'text/csv' })),
    download: `nse_${type}_${new Date().toISOString().slice(0,10)}.csv`,
  });
  a.click();
  URL.revokeObjectURL(a.href);
  showToast(`Exported ${s.filtered.length} rows · ${cols.length} columns`);
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
  const totalManAmt     = approvedMandates.reduce((s, r) => s + (Number(r.amount) || 0), 0);
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

/* ══ CLIENT PERFORMANCE LOOKUP ══════════════════════════ */

const CPL_SIP_COLORS = {
  ACTIVE:           '#00C853',
  PAUSE:            '#FF8F00',
  CXL:              '#FF1744',
  MATURED:          '#2979FF',
  AUTHREJECT:       '#B71C1C',
};
const CPL_MAN_COLORS = {
  APPROVED:              '#00C853',
  PENDING:               '#FF8F00',
  REJECTED:              '#FF1744',
  'UNDER PROCESSING':    '#2979FF',
  'ASSIGNED TO AGENCY':  '#AA00FF',
};

function cplBadge(status, map) {
  const color = map[status] || '#7A8899';
  return `<span style="font-size:11px;padding:3px 10px;border-radius:100px;background:${color}22;color:${color};font-weight:600">${esc(status || '—')}</span>`;
}

let cplDebounceTimer = null;
let cplSearchCache   = [];

function cplOnInput(val) {
  clearTimeout(cplDebounceTimer);
  const dd = document.getElementById('cpl-dropdown');
  if (val.length < 2) { dd.style.display = 'none'; return; }
  cplDebounceTimer = setTimeout(() => cplSearch(val.trim()), 300);
}

async function cplSearch(q) {
  const dd = document.getElementById('cpl-dropdown');
  dd.style.display = 'block';
  dd.innerHTML = `<div style="padding:12px 16px;font-size:13px;color:var(--muted)">Searching…</div>`;

  const lq = q.toLowerCase();
  const { data, error } = await sb
    .from('nse_client_master')
    .select('client_code,first_name,last_name')
    .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
    .limit(20);

  if (error || !data || !data.length) {
    dd.innerHTML = `<div style="padding:12px 16px;font-size:13px;color:var(--muted)">No clients found</div>`;
    return;
  }

  cplSearchCache = data;
  dd.innerHTML = data.map((c, i) => `
    <div onclick="cplSelectClient(${i})"
      style="padding:9px 16px;cursor:pointer;display:flex;align-items:center;gap:12px;
             border-bottom:1px solid rgba(255,255,255,0.05);transition:background 0.15s"
      onmouseover="this.style.background='rgba(255,255,255,0.04)'"
      onmouseout="this.style.background=''">
      <div>
        <div style="font-size:13px;font-weight:600">${esc(c.first_name || '')} ${esc(c.last_name || '')}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:1px">${esc(c.client_code || '')}</div>
      </div>
    </div>`).join('');
}

async function cplSelectClient(idx) {
  const client = cplSearchCache[idx];
  if (!client) return;

  /* Close dropdown, fill input */
  document.getElementById('cpl-dropdown').style.display = 'none';
  document.getElementById('cpl-search-input').value =
    `${client.first_name || ''} ${client.last_name || ''}`.trim();

  /* Show loading state */
  document.getElementById('cpl-placeholder').style.display = 'none';
  document.getElementById('cpl-panel').style.display       = 'none';
  document.getElementById('cpl-client-name').textContent   = 'Loading…';

  const code = client.client_code;

  /* Fetch SIPs + Mandates in parallel */
  const [sipRes, manRes] = await Promise.all([
    sb.from('nse_sip_transactions').select('*').eq('client_code', code),
    sb.from('nse_mandates').select('*').eq('client_code', code),
  ]);

  const sips     = sipRes.data  || [];
  const mandates = manRes.data  || [];

  /* ── KPIs ── */
  const activeSips = sips.filter(r => r.status === 'ACTIVE');
  const sipAmt     = activeSips.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const appMan     = mandates.filter(r => r.status === 'APPROVED');
  const manLimit   = appMan.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const sipRate    = sips.length ? ((activeSips.length / sips.length) * 100).toFixed(1) : '0.0';

  const kpiData = [
    { label: 'Active SIPs',   value: activeSips.length },
    { label: 'Active SIP Amt',value: fmtAmt(sipAmt) },
    { label: 'Mandates',      value: mandates.length },
    { label: 'Approved Limit',value: fmtAmt(manLimit) },
    { label: 'SIP Success',   value: sipRate + '%' },
  ];
  document.getElementById('cpl-kpis').innerHTML = kpiData.map(k => `
    <div style="background:#1A1F2E;border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:12px">
      <div style="font-size:11px;color:var(--muted);margin-bottom:4px">${k.label}</div>
      <div style="font-size:15px;font-weight:700;font-family:var(--font-display)">${k.value}</div>
    </div>`).join('');

  /* ── Chart: SIP Status Donut ── */
  const TICK_COLOR  = '#7A8899';
  const LEGEND_OPTS = { labels: { color: TICK_COLOR, font: { family: "'DM Sans'" }, padding: 12, boxWidth: 12 }, position: 'bottom' };
  if (nseCharts.cplSip) { nseCharts.cplSip.destroy(); delete nseCharts.cplSip; }
  const sipGroups = sips.reduce((acc, r) => {
    const k = r.status || 'UNKNOWN';
    acc[k] = (acc[k] || 0) + 1; return acc;
  }, {});
  const sipLabels = Object.keys(sipGroups);
  nseCharts.cplSip = new Chart(document.getElementById('cpl-chart-sip'), {
    type: 'doughnut',
    data: {
      labels:   sipLabels,
      datasets: [{ data: Object.values(sipGroups),
        backgroundColor: sipLabels.map(l => (CPL_SIP_COLORS[l] || '#7A8899') + 'CC'),
        borderWidth: 0 }],
    },
    options: { responsive: true, maintainAspectRatio: false, cutout: '60%', plugins: { legend: LEGEND_OPTS } },
  });

  /* ── Chart: Top 5 schemes by SIP amount ── */
  if (nseCharts.cplSchemes) { nseCharts.cplSchemes.destroy(); delete nseCharts.cplSchemes; }
  const schemeMap = sips.reduce((acc, r) => {
    const k = r.scheme_name || r.rta_scheme_code || 'Unknown';
    acc[k] = (acc[k] || 0) + (Number(r.amount) || 0); return acc;
  }, {});
  const top5 = Object.entries(schemeMap).sort(([,a],[,b]) => b - a).slice(0, 5);
  nseCharts.cplSchemes = new Chart(document.getElementById('cpl-chart-schemes'), {
    type: 'bar',
    data: {
      labels:   top5.map(([name]) => name.length > 20 ? name.slice(0, 18) + '…' : name),
      datasets: [{ label: '₹', data: top5.map(([,v]) => v),
        backgroundColor: 'rgba(232,80,58,0.75)', borderRadius: 5, borderWidth: 0 }],
    },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: TICK_COLOR, font: { size: 10 }, callback: v => '₹' + Number(v).toLocaleString('en-IN') },
             grid: { color: 'rgba(255,255,255,0.05)' } },
        y: { ticks: { color: TICK_COLOR, font: { size: 10 } }, grid: { display: false } },
      },
    },
  });

  /* ── Active SIPs table ── */
  const sipBody = document.getElementById('cpl-sips-body');
  if (!sips.length) {
    sipBody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--muted);font-size:12px;padding:16px">No SIPs found</td></tr>`;
  } else {
    sipBody.innerHTML = sips.map(r => `<tr>
      <td style="font-size:12px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
        title="${esc(r.scheme_name||'')}">${esc(r.scheme_name || r.rta_scheme_code || '—')}</td>
      <td style="font-weight:700">${fmtAmt(r.amount)}</td>
      <td>${esc(r.frequency || '—')}</td>
      <td style="color:var(--muted)">${fmtDate(r.start_date)}</td>
      <td style="color:var(--muted)">${fmtDate(r.end_date)}</td>
      <td>${cplBadge(r.status, CPL_SIP_COLORS)}</td>
      <td style="font-size:11px;color:var(--muted)">${esc(r.folio_number || r.folio_no || '—')}</td>
    </tr>`).join('');
  }

  /* ── Mandates table ── */
  const manBody = document.getElementById('cpl-mandates-body');
  if (!mandates.length) {
    manBody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--muted);font-size:12px;padding:16px">No mandates found</td></tr>`;
  } else {
    manBody.innerHTML = mandates.map(r => `<tr>
      <td style="font-size:11px;font-family:monospace">${esc(r.mandate_id || r.id || '—')}</td>
      <td style="font-size:12px">${esc(r.bank_name || '—')}</td>
      <td style="font-size:11px;color:var(--muted)">${esc(r.bank_account_no || '—')}</td>
      <td style="font-weight:700">${fmtAmt(r.amount)}</td>
      <td style="color:var(--muted)">${fmtDate(r.start_date)}</td>
      <td style="color:var(--muted)">${fmtDate(r.end_date)}</td>
      <td>${cplBadge(r.status, CPL_MAN_COLORS)}</td>
    </tr>`).join('');
  }

  /* Show panel */
  document.getElementById('cpl-client-name').textContent =
    `${client.first_name || ''} ${client.last_name || ''}`.trim() + `  ·  ${code}`;
  document.getElementById('cpl-panel').style.display = 'block';
}

/* Close CPL dropdown on outside click */
document.addEventListener('click', e => {
  if (!e.target.closest('#cpl-search-wrap'))
    document.getElementById('cpl-dropdown').style.display = 'none';
});

/* ══ MISSED SIP TRANSACTIONS UPLOAD ═════════════════════════ */

let missedSipProcessed = null;
let missedSipExcelReady = false;

async function processMissedSIP() {
  const fileInput = document.getElementById('missed-sip-file');
  const file = fileInput.files[0];
  const status = document.getElementById('process-status');

  if (!file) {
    status.textContent = '⚠ Select a file first';
    status.style.color = 'var(--warning)';
    return;
  }

  status.textContent = '⏳ Processing...';
  status.style.color = 'var(--muted)';

  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch('/upload/missed-sip/process', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) throw new Error('Upload failed');

    const result = await response.json();
    missedSipProcessed = result;
    missedSipExcelReady = false;

    // Show stats
    document.getElementById('stat-total').textContent = result.total_rows;
    document.getElementById('stat-matched').textContent = result.matched_ai_codes;
    document.getElementById('stat-unmatched').textContent = result.unmatched_ai_codes;
    document.getElementById('stat-rejected').textContent = result.rejected_count;

    // Failure reasons
    const reasons = Object.entries(result.reason_breakdown)
      .map(([k, v]) => `${k}: ${v}`)
      .join(' | ');
    document.getElementById('failure-reasons').textContent = reasons || 'None';

    // Show stats + Step 2 re-upload; Step 3 only shown after Excel re-upload
    document.getElementById('stats-cards').style.display = 'block';
    document.getElementById('step-2-preview').style.display = 'block';
    document.getElementById('step-3-push').style.display = 'none';
    document.getElementById('preview-table-wrap').style.display = 'none';
    document.getElementById('review-upload-status').textContent = '';

    if (result.unmatched_ai_codes > 0) {
      document.getElementById('push-warning').textContent =
        `⚠ ${result.unmatched_ai_codes} rows have missing AI codes`;
    }

    status.textContent = '✅ File processed — download Excel, review, then re-upload below';
    status.style.color = '#00C853';

  } catch (error) {
    status.textContent = `❌ Error: ${error.message}`;
    status.style.color = 'var(--danger)';
  }
}

async function downloadMissedSIPPreview() {
  if (!missedSipProcessed || missedSipProcessed.processed === 0) {
    alert('No data to download');
    return;
  }

  try {
    const response = await fetch('/upload/missed-sip/download-excel');
    if (!response.ok) throw new Error('Download failed');

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'missed-sip-preview.xlsx';
    a.click();
    window.URL.revokeObjectURL(url);
  } catch (error) {
    alert(`Error: ${error.message}`);
  }
}

async function uploadReviewedExcel() {
  const fileInput = document.getElementById('missed-sip-review-file');
  const file = fileInput.files[0];
  const status = document.getElementById('review-upload-status');

  if (!file) {
    status.textContent = '⚠ Select the reviewed Excel file first';
    status.style.color = 'var(--warning)';
    return;
  }

  status.textContent = '⏳ Loading...';
  status.style.color = 'var(--muted)';

  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch('/upload/missed-sip/preview-excel', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) throw new Error('Upload failed');

    const result = await response.json();
    missedSipExcelReady = true;

    // Populate preview table
    const tbody = document.getElementById('preview-tbody');
    tbody.innerHTML = '';
    for (const row of result.preview) {
      const tr = document.createElement('tr');
      tr.innerHTML = [
        row.ai_code, row.client_code, row.client_name, row.internal_ref_no,
        row.scheme_name, row.installment_amt, row.order_date, row.order_status, row.order_remark
      ].map(v => `<td style="padding:6px 8px;border-bottom:1px solid var(--border)">${v ?? ''}</td>`).join('');
      tbody.appendChild(tr);
    }

    document.getElementById('preview-table-wrap').style.display = 'block';
    document.getElementById('push-count').textContent = result.total;
    document.getElementById('step-3-push').style.display = 'block';

    status.textContent = `✅ ${result.total} rows loaded (showing first 10)`;
    status.style.color = '#00C853';

  } catch (error) {
    status.textContent = `❌ Error: ${error.message}`;
    status.style.color = 'var(--danger)';
  }
}

async function pushMissedSIPToSupabase() {
  if (!missedSipExcelReady) {
    alert('Please re-upload the reviewed Excel in Step 2 first');
    return;
  }

  const status = document.getElementById('push-status');
  status.textContent = '⏳ Pushing to Supabase...';
  status.style.color = 'var(--muted)';

  try {
    const response = await fetch('/upload/missed-sip/push', {
      method: 'POST'
    });

    if (!response.ok) throw new Error('Push failed');

    const result = await response.json();

    // Show success banner
    const banner = document.getElementById('success-banner');
    document.getElementById('success-text').textContent = result.message;
    banner.style.display = 'block';

    status.textContent = '✅ Push complete';
    status.style.color = '#00C853';

    // Reset form after 3 seconds
    setTimeout(() => {
      document.getElementById('missed-sip-file').value = '';
      document.getElementById('missed-sip-review-file').value = '';
      document.getElementById('process-status').textContent = '';
      document.getElementById('review-upload-status').textContent = '';
      document.getElementById('stats-cards').style.display = 'none';
      document.getElementById('step-2-preview').style.display = 'none';
      document.getElementById('preview-table-wrap').style.display = 'none';
      document.getElementById('step-3-push').style.display = 'none';
      document.getElementById('success-banner').style.display = 'none';
      document.getElementById('preview-tbody').innerHTML = '';
      missedSipProcessed = null;
      missedSipExcelReady = false;
    }, 3000);
  } catch (error) {
    status.textContent = `❌ Error: ${error.message}`;
    status.style.color = 'var(--danger)';
  }
}

/* ══ CAMS & KARVY TRANSACTIONS UPLOAD ═══════════════════════ */

// Per-source state: tracks whether a file has been processed / excel loaded
const trxState = {
  CAMS:  { processed: false, excelReady: false },
  KARVY: { processed: false, excelReady: false },
};

function _trxPfx(source) {
  return source === 'KARVY' ? 'karvy-trx' : 'cams-trx';
}

async function processTrxUpload(source) {
  source = (source || 'CAMS').toUpperCase();
  const pfx = _trxPfx(source);
  const fileInput = document.getElementById(`${pfx}-file`);
  const file = fileInput.files[0];
  const status = document.getElementById(`${pfx}-process-status`);

  if (!file) { status.textContent = '⚠ Select a file first'; status.style.color = 'var(--warning)'; return; }

  status.textContent = '⏳ Processing…';
  status.style.color = 'var(--muted)';

  const fd = new FormData();
  fd.append('file', file);
  fd.append('source', source);

  try {
    const res = await fetch('/upload/transactions/process', { method: 'POST', body: fd });
    if (!res.ok) {
      if (res.status === 413) throw new Error('File is too large. Please split the CSV into smaller files (under 500 MB) and try again.');
      let errMsg = `Upload failed (HTTP ${res.status})`;
      if (res.status === 502 || res.status === 503 || res.status === 504) {
        errMsg = `Server is temporarily unavailable (${res.status}) — please wait a moment and try again.`;
      } else {
        try {
          const rawText = await res.text();
          try { errMsg = JSON.parse(rawText).error || errMsg; }
          catch {
            const stripped = rawText.replace(/<style[\s\S]*?<\/style>/gi,'').replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim().slice(0,150);
            if (stripped) errMsg = `Server error (${res.status}): ${stripped}`;
          }
        } catch {}
      }
      throw new Error(errMsg);
    }
    const data = await res.json();
    trxState[source].processed = true;
    trxState[source].excelReady = false;

    document.getElementById(`${pfx}-stat-total`).textContent     = data.total_rows;
    document.getElementById(`${pfx}-stat-matched`).textContent   = data.matched_clients;
    document.getElementById(`${pfx}-stat-unmatched`).textContent = data.unmatched_clients;
    document.getElementById(`${pfx}-stat-amount`).textContent    = data.with_amount;

    document.getElementById(`${pfx}-stats-cards`).style.display  = 'block';
    document.getElementById(`${pfx}-step2`).style.display        = 'block';
    document.getElementById(`${pfx}-step3`).style.display        = 'none';
    document.getElementById(`${pfx}-preview-wrap`).style.display = 'none';
    document.getElementById(`${pfx}-review-status`).textContent  = '';

    if (data.unmatched_clients > 0)
      document.getElementById(`${pfx}-push-warning`).textContent =
        `⚠ ${data.unmatched_clients} rows have no matching client`;

    // Show "Download Missing Contacts" button only when there are unmatched rows
    const missingBtn = document.getElementById(`${source.toLowerCase()}-trx-missing-btn`);
    if (missingBtn) missingBtn.style.display = data.unmatched_clients > 0 ? 'inline-block' : 'none';

    status.textContent = '✅ Processed — download Excel, review, then re-upload below';
    status.style.color = '#00C853';
  } catch (e) {
    status.textContent = `❌ ${e.message}`;
    status.style.color = 'var(--danger)';
  }
}

function _trxShowDownloadError(source, msg) {
  const pfx = source.toLowerCase();
  const el = document.getElementById(`${pfx}-process-status`);
  if (el) { el.textContent = `❌ ${msg}`; el.style.color = 'var(--danger)'; }
}

async function downloadTrxPreview(source) {
  source = (source || 'CAMS').toUpperCase();
  try {
    const res = await fetch(`/upload/transactions/download-excel?source=${source}`);
    if (!res.ok) {
      const raw = await res.text();
      if (res.status === 502 || res.status === 503 || res.status === 504) {
        _trxShowDownloadError(source, 'Server timeout — re-process the file, then try again.');
      } else if (raw && raw.includes('No data')) {
        _trxShowDownloadError(source, 'No processed data — re-process the file first, then download.');
      } else {
        _trxShowDownloadError(source, `Download failed (${res.status})`);
      }
      return;
    }
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `transactions-${source.toLowerCase()}-preview.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  } catch (e) { _trxShowDownloadError(source, e.message); }
}

async function downloadMissingContacts(source) {
  source = (source || 'CAMS').toUpperCase();
  try {
    const res = await fetch(`/upload/transactions/download-missing-contacts?source=${source}`);
    if (!res.ok) {
      const raw = await res.text();
      if (res.status === 502 || res.status === 503 || res.status === 504) {
        _trxShowDownloadError(source, 'Server timeout — re-process the file, then try again.');
      } else if (raw && (raw.includes('No data') || raw.includes('No missing'))) {
        _trxShowDownloadError(source, 'No missing-contact rows found.');
      } else {
        _trxShowDownloadError(source, `Download failed (${res.status})`);
      }
      return;
    }
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `missing-contacts-${source.toLowerCase()}.xlsx`;
    a.click();
    URL.revokeObjectURL(a.href);
  } catch (e) { _trxShowDownloadError(source, e.message); }
}

async function uploadTrxReviewedExcel(source) {
  source = (source || 'CAMS').toUpperCase();
  const pfx = _trxPfx(source);
  const fileInput = document.getElementById(`${pfx}-review-file`);
  const file = fileInput.files[0];
  const status = document.getElementById(`${pfx}-review-status`);

  if (!file) { status.textContent = '⚠ Select the reviewed Excel first'; status.style.color = 'var(--warning)'; return; }

  status.textContent = '⏳ Loading…';
  status.style.color = 'var(--muted)';

  const fd = new FormData();
  fd.append('file', file);
  fd.append('source', source);

  try {
    const res = await fetch('/upload/transactions/preview-excel', { method: 'POST', body: fd });
    if (!res.ok) {
      if (res.status === 413) throw new Error('File is too large. Please split the file and try again.');
      let errMsg = `Upload failed (HTTP ${res.status})`;
      if (res.status === 502 || res.status === 503 || res.status === 504) {
        errMsg = `Server is temporarily unavailable (${res.status}) — please wait a moment and try again.`;
      } else {
        try {
          const rawText = await res.text();
          try { errMsg = JSON.parse(rawText).error || errMsg; }
          catch {
            const stripped = rawText.replace(/<style[\s\S]*?<\/style>/gi,'').replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim().slice(0,150);
            if (stripped) errMsg = `Server error (${res.status}): ${stripped}`;
          }
        } catch {}
      }
      throw new Error(errMsg);
    }
    const data = await res.json();
    trxState[source].excelReady = true;

    const tbody = document.getElementById(`${pfx}-preview-tbody`);
    tbody.innerHTML = '';
    for (const r of data.preview) {
      const tr = document.createElement('tr');
      const matched = r.client_matched === 'Y' || r.client_matched === true;
      tr.innerHTML = [r.pan, r.investor_name, r.folio_no, r.scheme_name, r.trade_date, r.trxn_type, r.amount,
        `<span style="font-size:11px;padding:2px 8px;border-radius:100px;
          background:${matched ? 'rgba(0,229,160,0.15)' : 'rgba(255,143,0,0.15)'};
          color:${matched ? '#00E5A0' : '#FF8F00'}">${r.client_matched || '—'}</span>`
      ].map(v => `<td style="padding:6px 8px;border-bottom:1px solid var(--border)">${v ?? '—'}</td>`).join('');
      tbody.appendChild(tr);
    }

    document.getElementById(`${pfx}-preview-wrap`).style.display = 'block';
    document.getElementById(`${pfx}-push-count`).textContent     = data.total;
    document.getElementById(`${pfx}-step3`).style.display        = 'block';
    status.textContent = `✅ ${data.total} rows loaded (showing first 10)`;
    status.style.color = '#00C853';
  } catch (e) {
    status.textContent = `❌ ${e.message}`;
    status.style.color = 'var(--danger)';
  }
}

async function pushTrxToSupabase(source) {
  source = (source || 'CAMS').toUpperCase();
  const pfx = _trxPfx(source);

  if (!trxState[source].excelReady) {
    alert('Please re-upload the reviewed Excel in Step 2 first');
    return;
  }

  const status = document.getElementById(`${pfx}-push-status`);
  status.textContent = '⏳ Pushing to Supabase…';
  status.style.color = 'var(--muted)';

  let chunkIdx   = 0;
  let totalPushed = 0;

  try {
    while (true) {
      const res = await fetch('/upload/transactions/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, chunk_idx: chunkIdx }),
      });
      const rawPush = await res.text();
      if (!res.ok) {
        if (res.status === 502 || res.status === 503 || res.status === 504) {
          throw new Error('Server is temporarily unavailable (timeout). Try again shortly.');
        }
        let errMsg = 'Push failed';
        try { errMsg = JSON.parse(rawPush).error || errMsg; }
        catch { errMsg = rawPush.replace(/<[^>]+>/g, '').trim().slice(0, 200) || errMsg; }
        throw new Error(errMsg);
      }
      const data = JSON.parse(rawPush);
      totalPushed += data.pushed;

      if (data.total_clean) {
        const pct = Math.min(100, Math.round(totalPushed / data.total_clean * 100));
        status.textContent = `⏳ Pushing… ${pct}% (${totalPushed.toLocaleString()} / ${data.total_clean.toLocaleString()})`;
      }

      if (data.done) {
        document.getElementById(`${pfx}-success-text`).textContent = data.message;
        document.getElementById(`${pfx}-success`).style.display    = 'block';
        status.textContent = '✅ Push complete';
        status.style.color = '#00C853';

        setTimeout(() => {
          [`${pfx}-file`, `${pfx}-review-file`].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
          });
          [`${pfx}-stats-cards`, `${pfx}-step2`, `${pfx}-preview-wrap`, `${pfx}-step3`, `${pfx}-success`]
            .forEach(id => document.getElementById(id).style.display = 'none');
          document.getElementById(`${pfx}-process-status`).textContent = '';
          document.getElementById(`${pfx}-preview-tbody`).innerHTML    = '';
          trxState[source].processed  = false;
          trxState[source].excelReady = false;
        }, 3000);
        break;
      }

      chunkIdx = data.next_chunk;
    }
  } catch (e) {
    status.textContent = `❌ ${e.message}`;
    status.style.color = 'var(--danger)';
  }
}

/* ══ CAMS & KARVY CONTACTS ══════════════════════════════════ */

async function loadCkContacts() {
  nseState['ck-contacts'].loaded = false;
  nseState['ck-contacts'].cols   = null;
  nseState['ck-contacts'].colFilters = {};
  document.getElementById('nse-ck-contacts-body').innerHTML =
    `<tr><td colspan="9"><div class="empty-state"><div class="empty-icon">⏳</div>Loading contacts…</div></td></tr>`;
  nseState['ck-contacts'].raw = await nseFetchAll('CAMS_KARVY_Contact');
  nseState['ck-contacts'].loaded = true;
  nseApplyAllFilters('ck-contacts');
}

function applyCkContactsFilter() { nseApplyAllFilters('ck-contacts'); }

function sortCkContacts(col) {
  const s = nseState['ck-contacts'];
  s.sortAsc = s.sortCol === col ? !s.sortAsc : true;
  s.sortCol = col; s.page = 1;
  nseSortData('ck-contacts');
}

function renderCkContactsTable() {
  nseRenderDynamic('ck-contacts', 'nse-ck-contacts-head', 'nse-ck-contacts-body', 'nse-ck-contacts-pager');
}

/* ══ CAMS & KARVY TRANSACTIONS ═══════════════════════════════ */

async function loadCkTransactions() {
  nseState['ck-transactions'].loaded = false;
  nseState['ck-transactions'].cols   = null;
  nseState['ck-transactions'].colFilters = {};
  document.getElementById('nse-ck-transactions-body').innerHTML =
    `<tr><td colspan="9"><div class="empty-state"><div class="empty-icon">⏳</div>Loading transactions…</div></td></tr>`;
  nseState['ck-transactions'].raw = await nseFetchAll('transactions');
  nseState['ck-transactions'].loaded = true;
  nseApplyAllFilters('ck-transactions');
}

function applyCkTransactionsFilter() { nseApplyAllFilters('ck-transactions'); }

function sortCkTransactions(col) {
  const s = nseState['ck-transactions'];
  s.sortAsc = s.sortCol === col ? !s.sortAsc : true;
  s.sortCol = col; s.page = 1;
  nseSortData('ck-transactions');
}

function renderCkTransactionsTable() {
  nseRenderDynamic('ck-transactions', 'nse-ck-transactions-head', 'nse-ck-transactions-body', 'nse-ck-transactions-pager');
}

/* ══ CLIENT PORTFOLIO ANALYTICS ════════════════════════════ */

let ckaSearchCache  = [];
let ckaAllTrx       = [];
let ckaFilteredTrx  = [];
let ckaSortCol      = 'trade_date';
let ckaSortAsc      = false;
let ckaShownRows    = 60;
let ckaDebounce;
let ckaTypeSet      = new Set();

// type → colour mapping
const CKA_TYPE_COLORS = {
  purchase: '#00E5A0', redemption: '#FF5252', switch: '#2979FF', other: '#FF8F00'
};
function ckaTypeColor(cls) { return CKA_TYPE_COLORS[cls] || '#aaa'; }
function ckaTypeCls(t) {
  const s = (t || '').toLowerCase();
  if (s.includes('redempt'))                                   return 'redemption';
  if (s.includes('switch') || s.includes('transfer'))          return 'switch';
  if (s.includes('purchase') || s.includes('sip') || s.includes('nfo') || s.includes('buy')) return 'purchase';
  return 'other';
}

/* ── search ── */
function ckaOnInput(val) {
  clearTimeout(ckaDebounce);
  const dd = document.getElementById('cka-dropdown');
  if (val.length < 2) { dd.style.display = 'none'; return; }
  ckaDebounce = setTimeout(() => ckaSearch(val.trim()), 280);
}

async function ckaSearch(q) {
  const dd = document.getElementById('cka-dropdown');
  dd.style.display = 'block';
  dd.innerHTML = `<div style="padding:12px 16px;font-size:13px;color:var(--muted)">Searching…</div>`;

  const { data, error } = await sb
    .from('clients')
    .select('ai_code,full_name,pan')
    .or(`full_name.ilike.%${q}%,ai_code.ilike.%${q}%`)
    .limit(20);

  if (error || !data || !data.length) {
    dd.innerHTML = `<div style="padding:14px 16px;font-size:13px;color:var(--muted)">No clients found</div>`;
    return;
  }
  ckaSearchCache = data;
  dd.innerHTML = data.map((c, i) => `
    <div onclick="ckaSelectClient(${i})"
      style="padding:12px 16px;cursor:pointer;display:flex;justify-content:space-between;
             align-items:center;border-bottom:1px solid rgba(255,255,255,.05);transition:background .12s"
      onmouseover="this.style.background='rgba(255,255,255,.05)'"
      onmouseout="this.style.background=''">
      <div>
        <div style="font-size:13px;font-weight:600">${esc(c.full_name || '—')}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px">
          ${esc(c.ai_code || '')}${c.pan ? ' · ' + esc(c.pan) : ''}</div>
      </div>
      <div style="font-size:11px;color:var(--brand);opacity:.7">View →</div>
    </div>`).join('');
}

async function ckaSelectClient(idx) {
  const client = ckaSearchCache[idx];
  if (!client) return;

  document.getElementById('cka-dropdown').style.display    = 'none';
  document.getElementById('cka-search-input').value        = client.full_name || client.ai_code;
  document.getElementById('cka-clear-btn').style.display   = 'inline-block';
  document.getElementById('cka-placeholder').style.display = 'none';
  document.getElementById('cka-panel').style.display       = 'none';
  document.getElementById('cka-loading').style.display     = 'flex';

  try {
    const res  = await fetch(`/api/client-analytics?ai_code=${encodeURIComponent(client.ai_code)}`);
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to load analytics');
    const data = await res.json();
    ckaRender(data);
  } catch (e) {
    document.getElementById('cka-loading').style.display    = 'none';
    document.getElementById('cka-placeholder').style.display = 'flex';
    document.getElementById('cka-placeholder').innerHTML =
      `<div style="font-size:36px">⚠</div>
       <div style="font-size:14px;color:var(--danger)">${esc(e.message)}</div>`;
  }
}

function ckaClear() {
  document.getElementById('cka-search-input').value        = '';
  document.getElementById('cka-clear-btn').style.display   = 'none';
  document.getElementById('cka-panel').style.display       = 'none';
  document.getElementById('cka-loading').style.display     = 'none';
  document.getElementById('cka-placeholder').style.display = 'flex';
  document.getElementById('cka-placeholder').innerHTML =
    `<div style="font-size:48px;opacity:.5">📊</div>
     <div style="font-size:15px;font-weight:600;color:var(--white)">Search for a client above</div>
     <div style="font-size:12px;max-width:320px;line-height:1.6">
       Type a client name or AI code to view their complete portfolio — investment summary,
       scheme-wise breakdown, fund house exposure, and full transaction history.
     </div>`;
  ckaAllTrx = []; ckaFilteredTrx = []; ckaTypeSet = new Set();
}

/* ── helpers ── */
function fmtINR(n) {
  n = Number(n) || 0;
  if (Math.abs(n) >= 1e7) return '₹' + (n/1e7).toFixed(2) + ' Cr';
  if (Math.abs(n) >= 1e5) return '₹' + (n/1e5).toFixed(2) + ' L';
  return '₹' + n.toLocaleString('en-IN', {maximumFractionDigits: 2});
}

/* ── render ── */
function ckaRender(data) {
  document.getElementById('cka-loading').style.display = 'none';

  const c = data.client || {};
  const s = data.stats  || {};

  // Identity
  document.getElementById('cka-client-name').textContent  = c.full_name || c.ai_code || '—';
  document.getElementById('cka-client-aicode').textContent = c.ai_code  || '—';
  document.getElementById('cka-client-pan').textContent   = c.pan       || '—';
  document.getElementById('cka-client-since').textContent = s.first_transaction  || '—';
  document.getElementById('cka-client-last').textContent  = s.latest_transaction || '—';

  // Source badges (CAMS / KARVY)
  const sb_el = document.getElementById('cka-source-badges');
  sb_el.innerHTML = Object.entries(s.source_breakdown || {}).map(([src, cnt]) => {
    const col = src === 'KARVY' ? '#2979FF' : '#FF6B35';
    return `<span style="font-size:11px;padding:4px 12px;border-radius:100px;
                         background:${col}22;color:${col};border:1px solid ${col}44">
              ${esc(src)}: ${cnt} txns</span>`;
  }).join('');

  // Investment KPIs
  document.getElementById('cka-kpi-invested').textContent = fmtINR(s.total_invested);
  document.getElementById('cka-kpi-redeemed').textContent = fmtINR(s.total_redeemed);
  document.getElementById('cka-kpi-net').textContent      = fmtINR(s.net_investment);

  // Portfolio stats
  document.getElementById('cka-kpi-total').textContent   = (s.total_transactions || 0).toLocaleString();
  document.getElementById('cka-kpi-schemes').textContent = (s.unique_schemes     || 0).toLocaleString();
  document.getElementById('cka-kpi-folios').textContent  = (s.unique_folios      || 0).toLocaleString();
  document.getElementById('cka-kpi-fh').textContent      = (s.unique_fund_houses || 0).toLocaleString();

  // Year-wise bars
  ckaRenderYearBars(data.yearly_summary || []);

  // Scheme table
  const sTbody = document.getElementById('cka-scheme-tbody');
  sTbody.innerHTML = (data.scheme_summary || []).map(r => {
    const net = r.net || 0;
    const netCol = net >= 0 ? '#00E5A0' : '#FF5252';
    return `<tr onmouseover="this.style.background='rgba(255,255,255,.03)'"
                onmouseout="this.style.background=''">
      <td style="padding:8px 12px;border-bottom:1px solid var(--border);
                 max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
          title="${esc(r.scheme_name)}">${esc(r.scheme_name)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid var(--border);color:var(--muted);
                 white-space:nowrap">${esc(r.fund_house || '—')}</td>
      <td style="padding:8px 12px;border-bottom:1px solid var(--border);text-align:right">${r.transactions}</td>
      <td style="padding:8px 12px;border-bottom:1px solid var(--border);text-align:right;color:#00E5A0">
        ${fmtINR(r.total_invested)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid var(--border);text-align:right;color:#FF5252">
        ${r.total_redeemed ? fmtINR(r.total_redeemed) : '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid var(--border);text-align:right;
                 font-weight:600;color:${netCol}">
        ${fmtINR(net)}</td>
    </tr>`;
  }).join('') || `<tr><td colspan="6" style="padding:24px;text-align:center;color:var(--muted)">No data</td></tr>`;

  // Fund house list
  const maxFH = Math.max(...(data.fund_house_summary || []).map(r => r.total_invested), 1);
  document.getElementById('cka-fh-list').innerHTML = (data.fund_house_summary || []).slice(0, 8).map(r => {
    const pct = Math.round((r.total_invested / maxFH) * 100);
    return `<div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px">
        <span style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
                     max-width:130px" title="${esc(r.fund_house)}">${esc(r.fund_house)}</span>
        <span style="color:var(--muted);white-space:nowrap;margin-left:6px">${fmtINR(r.total_invested)}</span>
      </div>
      <div style="height:4px;background:rgba(255,255,255,.08);border-radius:2px">
        <div style="height:4px;width:${pct}%;background:var(--brand);border-radius:2px;
                    transition:width .4s"></div>
      </div>
    </div>`;
  }).join('') || `<div style="color:var(--muted);font-size:12px;padding:8px 0">No data</div>`;

  // Transaction type list
  document.getElementById('cka-type-list').innerHTML = (data.type_summary || []).map(r => {
    const col = ckaTypeColor(r.cls || ckaTypeCls(r.trxn_type));
    return `<div style="display:flex;justify-content:space-between;align-items:center;
                        padding:7px 0;border-bottom:1px solid rgba(255,255,255,.05)">
      <div>
        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;
                     background:${col};margin-right:7px"></span>
        <span style="font-size:12px;font-weight:600">${esc(r.trxn_type || 'Unknown')}</span>
      </div>
      <div style="text-align:right">
        <div style="font-size:12px;font-weight:700">${fmtINR(r.total_amount)}</div>
        <div style="font-size:10px;color:var(--muted)">${r.count} txns</div>
      </div>
    </div>`;
  }).join('') || `<div style="color:var(--muted);font-size:12px;padding:8px 0">No data</div>`;

  // Transaction table
  ckaAllTrx = data.transactions || [];
  // Build type filter options
  ckaTypeSet = new Set(ckaAllTrx.map(t => t.trxn_type).filter(Boolean));
  const typeFilter = document.getElementById('cka-type-filter');
  typeFilter.innerHTML = '<option value="">All Types</option>' +
    [...ckaTypeSet].sort().map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join('');

  ckaFilteredTrx = [...ckaAllTrx];
  ckaSortCol = 'trade_date'; ckaSortAsc = false; ckaShownRows = 60;
  document.getElementById('cka-trx-search').value = '';
  ckaRenderTrxTable();

  document.getElementById('cka-panel').style.display = 'block';
}

function ckaRenderYearBars(yearly) {
  const wrap = document.getElementById('cka-yearly-bars');
  if (!yearly.length) { wrap.innerHTML = `<div style="color:var(--muted);font-size:12px">No yearly data</div>`; return; }
  const maxVal = Math.max(...yearly.map(y => Math.max(y.invested, y.redeemed)), 1);
  const barH   = 80; // max bar height px

  wrap.innerHTML = yearly.map(y => {
    const invH = Math.round((y.invested / maxVal) * barH);
    const redH = Math.round((y.redeemed / maxVal) * barH);
    return `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;min-width:52px">
      <div style="font-size:10px;color:var(--muted);font-weight:600">${y.count}</div>
      <div style="display:flex;align-items:flex-end;gap:3px;height:${barH}px">
        <div style="width:16px;height:${invH}px;background:#00E5A0;border-radius:3px 3px 0 0;
                    cursor:default" title="Invested: ${fmtINR(y.invested)}"></div>
        <div style="width:16px;height:${Math.max(redH,1)}px;background:#FF5252;
                    border-radius:3px 3px 0 0;opacity:${y.redeemed?1:0.1};cursor:default"
             title="Redeemed: ${fmtINR(y.redeemed)}"></div>
      </div>
      <div style="font-size:10px;color:var(--muted);white-space:nowrap">${y.year}</div>
    </div>`;
  }).join('') +
  `<div style="display:flex;flex-direction:column;justify-content:flex-end;gap:6px;
               margin-left:12px;padding-bottom:20px">
    <div style="display:flex;align-items:center;gap:6px;font-size:10px;color:var(--muted)">
      <div style="width:10px;height:10px;background:#00E5A0;border-radius:2px"></div> Invested
    </div>
    <div style="display:flex;align-items:center;gap:6px;font-size:10px;color:var(--muted)">
      <div style="width:10px;height:10px;background:#FF5252;border-radius:2px"></div> Redeemed
    </div>
  </div>`;
}

function ckaRenderTrxTable() {
  const tbody  = document.getElementById('cka-trx-tbody');
  const rows   = ckaFilteredTrx;
  const shown  = rows.slice(0, ckaShownRows);

  tbody.innerHTML = shown.map(t => {
    const cls = ckaTypeCls(t.trxn_type);
    const col = ckaTypeColor(cls);
    const src = (t.source || '').toUpperCase();
    const srcCol = src === 'KARVY' ? '#2979FF' : '#FF6B35';
    return `<tr onmouseover="this.style.background='rgba(255,255,255,.02)'"
                onmouseout="this.style.background=''">
      <td style="padding:7px 12px;border-bottom:1px solid var(--border);white-space:nowrap;
                 font-size:11px">${esc(t.trade_date || '—')}</td>
      <td style="padding:7px 12px;border-bottom:1px solid var(--border)">
        <span style="font-size:10px;padding:2px 8px;border-radius:100px;
                     background:${srcCol}22;color:${srcCol}">${esc(src || '—')}</span></td>
      <td style="padding:7px 12px;border-bottom:1px solid var(--border);color:var(--muted);
                 white-space:nowrap;font-size:11px">${esc(t.folio_no || '—')}</td>
      <td style="padding:7px 12px;border-bottom:1px solid var(--border);
                 max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px"
          title="${esc(t.scheme_name || '')}">${esc(t.scheme_name || '—')}</td>
      <td style="padding:7px 12px;border-bottom:1px solid var(--border)">
        <span style="font-size:10px;padding:2px 8px;border-radius:100px;
                     background:${col}22;color:${col}">${esc(t.trxn_type || '—')}</span></td>
      <td style="padding:7px 12px;border-bottom:1px solid var(--border);text-align:right;
                 white-space:nowrap;font-size:11px;color:var(--muted)">
        ${t.units != null ? Number(t.units).toFixed(3) : '—'}</td>
      <td style="padding:7px 12px;border-bottom:1px solid var(--border);text-align:right;
                 white-space:nowrap;font-size:11px;font-weight:600;color:${col}">
        ${t.amount != null ? fmtINR(Number(t.amount)) : '—'}</td>
      <td style="padding:7px 12px;border-bottom:1px solid var(--border);text-align:right;
                 white-space:nowrap;font-size:11px;color:var(--muted)">
        ${t.nav != null ? Number(t.nav).toFixed(4) : '—'}</td>
    </tr>`;
  }).join('') ||
  `<tr><td colspan="8" style="padding:32px;text-align:center;color:var(--muted)">
     No transactions found</td></tr>`;

  // Update count + show-more
  const total = rows.length;
  const countEl = document.getElementById('cka-trx-count');
  const moreWrap = document.getElementById('cka-show-more-wrap');
  countEl.textContent = total > ckaShownRows
    ? `${Math.min(ckaShownRows, total)} of ${total.toLocaleString()} transactions`
    : `${total.toLocaleString()} transaction${total !== 1 ? 's' : ''}`;
  moreWrap.style.display = total > ckaShownRows ? 'block' : 'none';

  // Update sort icons
  ['trade_date','units','amount'].forEach(col => {
    const el = document.getElementById(`cka-sort-${col}`);
    if (!el) return;
    const icon = el.querySelector('.cka-sort-icon');
    if (icon) icon.textContent = ckaSortCol !== col ? '↕' : (ckaSortAsc ? '↑' : '↓');
  });
}

function ckaShowMore() {
  ckaShownRows += 60;
  ckaRenderTrxTable();
}

function ckaFilterTrx(q) {
  const lq      = (q || '').trim().toLowerCase();
  const typeVal = (document.getElementById('cka-type-filter')?.value || '').toLowerCase();

  ckaFilteredTrx = ckaAllTrx.filter(t => {
    const typeMatch = !typeVal || (t.trxn_type || '').toLowerCase() === typeVal;
    const textMatch = !lq ||
      (t.scheme_name || '').toLowerCase().includes(lq) ||
      (t.trxn_type   || '').toLowerCase().includes(lq) ||
      (t.folio_no    || '').toLowerCase().includes(lq) ||
      (t.fund_house  || '').toLowerCase().includes(lq) ||
      (t.source      || '').toLowerCase().includes(lq);
    return typeMatch && textMatch;
  });
  ckaShownRows = 60;
  ckaRenderTrxTable();
}

function ckaSortTrx(col) {
  ckaSortAsc = ckaSortCol === col ? !ckaSortAsc : (col !== 'trade_date');
  ckaSortCol = col;
  ckaFilteredTrx.sort((a, b) => {
    let av = a[col], bv = b[col];
    if (col === 'amount' || col === 'units') { av = Number(av) || 0; bv = Number(bv) || 0; }
    else { av = av || ''; bv = bv || ''; }
    if (av < bv) return ckaSortAsc ? -1 : 1;
    if (av > bv) return ckaSortAsc ?  1 : -1;
    return 0;
  });
  ckaRenderTrxTable();
}

function ckaExportCsv() {
  if (!ckaFilteredTrx.length) { alert('No transactions to export'); return; }
  const cols = ['trade_date','post_date','source','folio_no','scheme_name','fund_house',
                'trxn_type','trxn_no','units','amount','nav','isin','scheme_category','pan'];
  const header = cols.join(',');
  const body = ckaFilteredTrx.map(t =>
    cols.map(c => {
      const v = t[c] ?? '';
      return String(v).includes(',') ? `"${String(v).replace(/"/g,'""')}"` : v;
    }).join(',')
  ).join('\n');
  const blob = new Blob([header + '\n' + body], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `portfolio-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ── close dropdown on outside click ── */
document.addEventListener('click', e => {
  const wrap = document.getElementById('cka-search-wrap');
  if (wrap && !wrap.contains(e.target))
    document.getElementById('cka-dropdown').style.display = 'none';
});

/* ══ BOOT ══ */
checkAuth();
