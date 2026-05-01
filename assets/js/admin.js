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

  /* ── Top 10 Clients by Active SIP Amount (with client names) ── */
  killChart('top10');
  /* Build client_code → full name lookup from already-fetched clients */
  const nameMap = {};
  clients.forEach(c => {
    nameMap[c.client_code] =
      `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.client_code;
  });
  const clientTotals = activeSips.reduce((acc, r) => {
    acc[r.client_code] = (acc[r.client_code] || 0) + (Number(r.amount) || 0);
    return acc;
  }, {});
  const top10 = Object.entries(clientTotals).sort(([,a],[,b]) => b - a).slice(0, 10);
  nseCharts.top10 = new Chart(document.getElementById('chart-top10'), {
    type: 'bar',
    data: {
      labels: top10.map(([code]) => {
        const name = nameMap[code] || code;
        return name.length > 24 ? name.slice(0, 22) + '…' : name;
      }),
      datasets: [{ label: 'Active SIP (₹)', data: top10.map(([,v]) => v),
                   backgroundColor: 'rgba(232,80,58,0.75)', borderColor: '#E8503A',
                   borderWidth: 1, borderRadius: 6 }],
    },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: TICK_COLOR, callback: v => '₹' + Number(v).toLocaleString('en-IN') },
             grid: { color: GRID_COLOR } },
        y: { ticks: { color: TICK_COLOR, font: { size: 11 } }, grid: { display: false } },
      },
    },
  });
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
    .select('client_code,first_name,last_name,ai_code')
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
  document.getElementById('cpl-placeholder').style.display    = 'none';
  document.getElementById('cpl-panel').style.display          = 'none';
  document.getElementById('cpl-report-section').style.display = 'none';
  document.getElementById('cpl-client-name').textContent      = 'Loading…';

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
  const clientFullName = `${client.first_name || ''} ${client.last_name || ''}`.trim();
  document.getElementById('cpl-client-name').textContent =
    clientFullName + `  ·  ${code}`;
  document.getElementById('cpl-panel').style.display = 'block';

  /* Kick off detailed investment report (async, non-blocking) */
  const aiCode = client.ai_code || (sips.length ? sips[0].ai_code : null);
  cplRenderReport(sips, sipAmt, clientFullName, aiCode).catch(console.error);
}

/* Close CPL dropdown on outside click */
document.addEventListener('click', e => {
  if (!e.target.closest('#cpl-search-wrap'))
    document.getElementById('cpl-dropdown').style.display = 'none';
});

/* ══ CPL — INVESTMENT REPORT (Growth Chart + Projections + Detailed Table) ══ */

function fmtCrLakh(v) {
  if (v >= 10000000) return '₹' + (v / 10000000).toFixed(2) + ' Cr';
  if (v >= 100000)   return '₹' + (v / 100000).toFixed(1) + ' L';
  return '₹' + Math.round(v).toLocaleString('en-IN');
}

function cplCalcInstallments(startDate, status, endDate) {
  if (!startDate) return 0;
  const start = new Date(startDate);
  const today = new Date();
  let end;
  if (status === 'ACTIVE') {
    end = today;
  } else {
    /* For CXL/PAUSE/MATURED SIPs, NSE often stores end_date as 2099.
       Always cap at today to avoid showing 900+ instalments. */
    const e = endDate ? new Date(endDate) : today;
    end = e < today ? e : today;
  }
  if (end <= start) return 1;
  return Math.max(1,
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth())
  );
}

function cplBuildTimeline(sips) {
  /* Only ACTIVE SIPs are included. NSE stores end_date = 2099 for all SIPs
     (even cancelled ones), so there is no reliable way to know when a CXL
     SIP actually stopped — including them would inflate historical bars. */
  const activeSips = sips.filter(r => r.status === 'ACTIVE');
  if (!activeSips.length) return { labels: [], invested: [] };

  const today = new Date(); today.setDate(1); today.setHours(0, 0, 0, 0);
  let earliest = new Date(today);
  activeSips.forEach(r => {
    if (!r.start_date) return;
    const d = new Date(r.start_date); d.setDate(1); d.setHours(0, 0, 0, 0);
    if (d < earliest) earliest = new Date(d);
  });

  const labels = [], invested = [];
  const cursor = new Date(earliest);
  let running = 0;

  while (cursor <= today) {
    activeSips.forEach(r => {
      if (!r.start_date) return;
      const s = new Date(r.start_date); s.setDate(1); s.setHours(0, 0, 0, 0);
      if (cursor >= s) running += Number(r.amount) || 0;
    });
    labels.push(cursor.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }));
    invested.push(running);
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return { labels, invested };
}

/* Standard SIP FV with optional annual step-up, monthly compounding */
function cplSipFV(monthlyAmt, annualRate, totalMonths, stepUpPct = 0) {
  const r = annualRate / 100 / 12;
  let fv = 0, amt = monthlyAmt;
  for (let m = 1; m <= totalMonths; m++) {
    fv = (fv + amt) * (1 + r);
    if (stepUpPct > 0 && m % 12 === 0) amt *= (1 + stepUpPct / 100);
  }
  return fv;
}

/* Months needed to reach goal from existing corpus + ongoing SIP */
function cplMonthsToGoal(goal, existing, monthly, annualRate, stepUpPct = 0) {
  if (existing >= goal) return 0;
  const r = annualRate / 100 / 12;
  let fv = existing, amt = monthly;
  for (let m = 1; m <= 600; m++) {
    fv = (fv + amt) * (1 + r);
    if (stepUpPct > 0 && m % 12 === 0) amt *= (1 + stepUpPct / 100);
    if (fv >= goal) return m;
  }
  return null;
}

function cplFmtMonths(m) {
  if (m == null) return '>50y';
  if (m === 0)   return 'Already there!';
  const y = Math.floor(m / 12), mo = m % 12;
  if (y === 0) return `${mo}m`;
  if (mo === 0) return `${y}y`;
  return `${y}y ${mo}m`;
}

async function cplRenderReport(sips, sipAmt, clientName, aiCode) {
  const RATE = 12;
  const TC   = '#7A8899';

  /* 1 ── Fetch CAMS/KARVY holdings for this AI code */
  let cams = [];
  if (aiCode) {
    const { data } = await sb
      .from('CAMS_KARVY_Contact')
      .select('"Folio No",sch_name,unit_balance,nav_value,total_amount_value,amc_code')
      .eq('ai_code', aiCode);
    cams = data || [];
  }

  const camsMap = {};
  cams.forEach(c => {
    const k = String(c['Folio No'] || '').trim();
    if (k) camsMap[k] = c;
  });
  const totalCV = cams.reduce((s, c) => s + (Number(c.total_amount_value) || 0), 0);

  /* 2 ── Build investment timeline */
  const { labels, invested } = cplBuildTimeline(sips);
  const totalInvested = invested.length ? invested[invested.length - 1] : 0;

  /* 3 ── Render Growth Chart */
  if (nseCharts.cplGrowth) { nseCharts.cplGrowth.destroy(); delete nseCharts.cplGrowth; }

  const cvData = Array(labels.length).fill(null);
  if (labels.length && totalCV > 0) cvData[cvData.length - 1] = totalCV;

  nseCharts.cplGrowth = new Chart(document.getElementById('cpl-chart-growth'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Invested',
          data: invested,
          borderColor: '#60a5fa',
          backgroundColor: 'rgba(96,165,250,0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.35,
          pointRadius: 0,
          pointHoverRadius: 4,
        },
        ...(totalCV > 0 ? [{
          label: 'Current Value',
          data: cvData,
          borderColor: '#22c55e',
          backgroundColor: '#22c55e',
          borderWidth: 0,
          pointRadius: 9,
          pointHoverRadius: 11,
          fill: false,
          showLine: false,
        }] : []),
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: TC, font: { family: "'DM Sans'" }, boxWidth: 12 }, position: 'top' },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.dataset.label}: ₹${Number(ctx.raw).toLocaleString('en-IN')}`,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: TC, font: { size: 10 }, maxTicksLimit: 14, maxRotation: 0 },
          grid:  { color: 'rgba(255,255,255,0.04)' },
        },
        y: {
          ticks: {
            color: TC,
            font: { size: 10 },
            callback: v => {
              if (v >= 10000000) return '₹' + (v / 10000000).toFixed(1) + 'Cr';
              if (v >= 100000)   return '₹' + (v / 100000).toFixed(0) + 'L';
              if (v >= 1000)     return '₹' + (v / 1000).toFixed(0) + 'K';
              return '₹' + v;
            },
          },
          grid: { color: 'rgba(255,255,255,0.04)' },
        },
      },
    },
  });

  /* Growth summary chips */
  const profit    = totalCV - totalInvested;
  const profitPct = totalInvested > 0 && totalCV > 0
    ? ((profit / totalInvested) * 100).toFixed(1) : null;
  const pColor = profit >= 0 ? '#22c55e' : '#ef4444';
  document.getElementById('cpl-growth-summary').innerHTML =
    `<span>Invested: <strong>${fmtAmt(totalInvested)}</strong></span>` +
    (totalCV > 0
      ? `<span>Value: <strong style="color:#22c55e">${fmtAmt(totalCV)}</strong></span>` +
        (profitPct != null
          ? `<span style="color:${pColor};font-weight:700">${profit >= 0 ? '+' : ''}${profitPct}% return</span>`
          : '')
      : '');

  /* 3.5 ── Monthly SIP Investment Bar Chart */
  if (nseCharts.cplMonthly) { nseCharts.cplMonthly.destroy(); delete nseCharts.cplMonthly; }

  /* Derive per-month invested amounts from cumulative timeline */
  const monthlyAmts = invested.map((v, i) => (i === 0 ? v : v - invested[i - 1]));

  /* Color each bar: green if higher than prev month, red if lower, blue if same */
  const barColors = monthlyAmts.map((v, i) => {
    if (i === 0) return 'rgba(96,165,250,0.75)';
    if (v > monthlyAmts[i - 1]) return 'rgba(34,197,94,0.8)';
    if (v < monthlyAmts[i - 1]) return 'rgba(239,68,68,0.75)';
    return 'rgba(96,165,250,0.75)';
  });

  const currentMonthly = monthlyAmts.length ? monthlyAmts[monthlyAmts.length - 1] : 0;
  const peakMonthly    = monthlyAmts.length ? Math.max(...monthlyAmts) : 0;

  nseCharts.cplMonthly = new Chart(document.getElementById('cpl-chart-monthly'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Monthly SIP (₹)',
        data: monthlyAmts,
        backgroundColor: barColors,
        borderRadius: 4,
        borderWidth: 0,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: ([ctx]) => ctx.label,
            label: ctx => `Monthly SIP: ₹${Number(ctx.raw).toLocaleString('en-IN')}`,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: TC, font: { size: 10 }, maxTicksLimit: 16, maxRotation: 0 },
          grid:  { display: false },
        },
        y: {
          ticks: {
            color: TC,
            font: { size: 10 },
            callback: v => {
              if (v >= 100000) return '₹' + (v / 100000).toFixed(0) + 'L';
              if (v >= 1000)   return '₹' + (v / 1000).toFixed(0) + 'K';
              return '₹' + v;
            },
          },
          grid: { color: 'rgba(255,255,255,0.04)' },
          beginAtZero: true,
        },
      },
    },
  });

  /* Monthly summary chips */
  document.getElementById('cpl-monthly-summary').innerHTML =
    `<span>Current: <strong style="color:#22c55e">${fmtAmt(currentMonthly)}/mo</strong></span>` +
    (peakMonthly !== currentMonthly
      ? `<span>Peak: <strong>${fmtAmt(peakMonthly)}/mo</strong></span>`
      : '') +
    `<span style="font-size:11px;color:var(--muted)">
       <span style="display:inline-block;width:8px;height:8px;background:rgba(34,197,94,0.8);border-radius:2px;margin-right:4px"></span>increase
       <span style="display:inline-block;width:8px;height:8px;background:rgba(239,68,68,0.75);border-radius:2px;margin:0 4px 0 10px"></span>decrease
     </span>`;

  /* 4 ── Scenario Projection Cards */
  const scenarios = [
    { label: 'Keep Current SIP',    stepUp: 0,  color: '#60a5fa' },
    { label: '+10% Annual Step-up', stepUp: 10, color: '#f59e0b' },
    { label: '+20% Annual Step-up', stepUp: 20, color: '#22c55e' },
  ];
  const horizons = [3, 5, 10];

  const scenarioHtml = scenarios.map(sc => {
    const vals = horizons.map(yrs => {
      const sipPart  = cplSipFV(sipAmt, RATE, yrs * 12, sc.stepUp);
      const corpPart = totalCV * Math.pow(1 + RATE / 100, yrs);
      return sipPart + corpPart;
    });
    return `
      <div style="background:#1A1F2E;border:1px solid rgba(255,255,255,0.07);
                  border-radius:10px;padding:12px 14px">
        <div style="font-size:11px;font-weight:700;color:${sc.color};
                    margin-bottom:8px;letter-spacing:0.02em">${sc.label}</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">
          ${horizons.map((yr, i) => `
            <div style="text-align:center;padding:7px 4px;
                        background:rgba(255,255,255,0.03);border-radius:6px">
              <div style="font-size:9px;color:var(--muted);font-weight:600;
                          text-transform:uppercase;letter-spacing:0.05em;margin-bottom:3px">${yr}Y</div>
              <div style="font-size:12px;font-weight:700;color:${sc.color};
                          font-family:var(--font-display)">${fmtCrLakh(vals[i])}</div>
            </div>`).join('')}
        </div>
      </div>`;
  }).join('');

  /* 5 ── Milestone Checkpoints */
  const allMilestones = [
    { goal: 500000,   label: '₹5 Lakhs'   },
    { goal: 1000000,  label: '₹10 Lakhs'  },
    { goal: 2500000,  label: '₹25 Lakhs'  },
    { goal: 5000000,  label: '₹50 Lakhs'  },
    { goal: 10000000, label: '₹1 Crore'   },
    { goal: 25000000, label: '₹2.5 Crore' },
    { goal: 50000000, label: '₹5 Crore'   },
  ];
  const nextMs = allMilestones.filter(m => m.goal > totalCV).slice(0, 3);

  const milestoneHtml = nextMs.length ? `
    <div style="font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;
                color:var(--muted);padding:4px 0 2px">Reach Your Goals Faster</div>
    ${nextMs.map(m => {
      const m0  = cplMonthsToGoal(m.goal, totalCV, sipAmt, RATE, 0);
      const m10 = cplMonthsToGoal(m.goal, totalCV, sipAmt, RATE, 10);
      const m20 = cplMonthsToGoal(m.goal, totalCV, sipAmt, RATE, 20);
      const s10 = m0 && m10 ? m0 - m10 : 0;
      const s20 = m0 && m20 ? m0 - m20 : 0;
      return `
        <div style="background:#1A1F2E;border:1px solid rgba(255,255,255,0.07);
                    border-radius:10px;padding:12px 14px">
          <div style="font-size:12px;font-weight:700;margin-bottom:8px">🎯 ${m.label}</div>
          <div style="display:flex;flex-direction:column;gap:5px">
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px">
              <span style="color:var(--muted)">Current pace</span>
              <span style="font-weight:600;color:#60a5fa">${cplFmtMonths(m0)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px">
              <span style="color:var(--muted)">+10% step-up</span>
              <span style="font-weight:600;color:#f59e0b">${cplFmtMonths(m10)}
                ${s10 > 0 ? `<span style="font-size:10px;opacity:0.75"> (−${cplFmtMonths(s10)} faster)</span>` : ''}
              </span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px">
              <span style="color:var(--muted)">+20% step-up</span>
              <span style="font-weight:600;color:#22c55e">${cplFmtMonths(m20)}
                ${s20 > 0 ? `<span style="font-size:10px;opacity:0.75"> (−${cplFmtMonths(s20)} faster)</span>` : ''}
              </span>
            </div>
          </div>
        </div>`;
    }).join('')}` : '';

  document.getElementById('cpl-projection-wrap').innerHTML = scenarioHtml + milestoneHtml;

  /* 6 ── Detailed SIP Portfolio Report Table (ACTIVE SIPs only) */
  const activeSipsOnly = sips.filter(r => r.status === 'ACTIVE');
  let totAmt = 0, totPaid = 0, totInv = 0, totVal = 0;

  document.getElementById('cpl-report-body').innerHTML = activeSipsOnly.map((r, i) => {
    const folioKey = String(r.folio_number || r.folio_no || '').trim();
    const camsRec  = camsMap[folioKey] || null;
    const instPaid = cplCalcInstallments(r.start_date, r.status, r.end_date);
    const amtInv   = (Number(r.amount) || 0) * instPaid;
    const currVal  = camsRec ? (Number(camsRec.total_amount_value) || 0) : 0;
    const retPct   = amtInv > 0 && currVal > 0
      ? (((currVal - amtInv) / amtInv) * 100).toFixed(1) : null;

    totAmt  += Number(r.amount) || 0;
    totPaid += instPaid;
    totInv  += amtInv;
    totVal  += currVal;

    const sColor = CPL_SIP_COLORS[r.status] || '#7A8899';
    const rColor = retPct != null ? (Number(retPct) >= 0 ? '#22c55e' : '#ef4444') : 'var(--muted)';

    return `<tr>
      <td style="color:var(--muted);font-size:11px">${i + 1}</td>
      <td style="max-width:220px">
        <div style="font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;
                    white-space:nowrap" title="${esc(r.scheme_name || '')}">
          ${esc(r.scheme_name || r.rta_scheme_code || '—')}
        </div>
        ${camsRec?.amc_code ? `<div style="font-size:10px;color:var(--muted);margin-top:2px">${esc(camsRec.amc_code)}</div>` : ''}
      </td>
      <td style="font-size:11px;font-family:monospace;color:var(--muted)">${esc(folioKey || '—')}</td>
      <td style="font-size:11px">SIP</td>
      <td><span style="font-size:11px;padding:2px 9px;border-radius:100px;
                       background:${sColor}22;color:${sColor};font-weight:600">
            ${esc(r.status || '—')}</span></td>
      <td style="font-size:12px;color:var(--muted)">${fmtDate(r.start_date)}</td>
      <td style="font-size:12px;text-align:center;font-weight:600">${r.period_day != null ? r.period_day : '—'}</td>
      <td style="font-weight:700">${fmtAmt(r.amount)}</td>
      <td style="font-size:12px;text-align:center">${instPaid}</td>
      <td style="font-size:12px">${fmtAmt(amtInv)}</td>
      <td style="font-size:12px;font-weight:600;color:${currVal > 0 ? '#22c55e' : 'var(--muted)'}">
        ${currVal > 0 ? fmtAmt(currVal) : '—'}
      </td>
      <td style="font-weight:700;font-size:12px;color:${rColor}">
        ${retPct != null ? (Number(retPct) >= 0 ? '+' : '') + retPct + '%' : '—'}
      </td>
    </tr>`;
  }).join('');

  const totRetPct = totInv > 0 && totVal > 0
    ? (((totVal - totInv) / totInv) * 100).toFixed(1) : null;
  const totRColor = totRetPct != null
    ? (Number(totRetPct) >= 0 ? '#22c55e' : '#ef4444') : 'var(--muted)';

  document.getElementById('cpl-report-foot').innerHTML = `
    <tr style="background:rgba(255,255,255,0.03)">
      <td colspan="7" style="font-size:11px;font-weight:700;color:var(--muted);
                              letter-spacing:0.05em">TOTAL</td>
      <td style="font-weight:700">${fmtAmt(totAmt)}</td>
      <td style="font-size:12px;text-align:center;font-weight:700">${totPaid}</td>
      <td style="font-weight:700">${fmtAmt(totInv)}</td>
      <td style="font-weight:700;color:#22c55e">${totVal > 0 ? fmtAmt(totVal) : '—'}</td>
      <td style="font-weight:700;color:${totRColor}">
        ${totRetPct != null ? (Number(totRetPct) >= 0 ? '+' : '') + totRetPct + '%' : '—'}
      </td>
    </tr>`;

  document.getElementById('cpl-report-subtitle').textContent =
    `${activeSipsOnly.length} active SIP${activeSipsOnly.length !== 1 ? 's' : ''} · ${clientName}`;

  document.getElementById('cpl-report-section').style.display = 'block';
  document.getElementById('cpl-report-section')
    .scrollIntoView({ behavior: 'smooth', block: 'start' });
}

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


/* ══ BOOT ══ */
checkAuth();
