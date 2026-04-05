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

/* Min-widths per column (px) and how many leading columns are sticky */
const NSE_TABLE_CONFIG = {
  clients:  { sticky: 2, minW: { default: 120, id: 60, client_code: 110, first_name: 130, last_name: 130, pan: 120, mobile: 120, email: 180, dob: 100, status: 90 } },
  sips:     { sticky: 2, minW: { default: 120, id: 60, client_code: 110, scheme_name: 220, rta_scheme_code: 140, amount: 100, status: 90, frequency: 110 } },
  mandates: { sticky: 2, minW: { default: 120, id: 60, client_code: 110, bank_name: 160, amount: 100, status: 90, mandate_type: 130 } },
};

const nseState = {
  clients:  { raw: [], filtered: [], page: 1, sortCol: 'first_name',  sortAsc: true,  loaded: false, cols: null, hiddenCols: new Set(), colFilters: {} },
  sips:     { raw: [], filtered: [], page: 1, sortCol: 'created_at',  sortAsc: false, loaded: false, cols: null, hiddenCols: new Set(), colFilters: {} },
  mandates: { raw: [], filtered: [], page: 1, sortCol: 'created_at',  sortAsc: false, loaded: false, cols: null, hiddenCols: new Set(), colFilters: {} },
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
  nseState.clients.cols   = null;
  nseState.clients.colFilters = {};
  document.getElementById('nse-clients-body').innerHTML =
    `<tr><td colspan="9"><div class="empty-state"><div class="empty-icon">⏳</div>Loading NSE clients…</div></td></tr>`;
  nseState.clients.raw = await nseFetchAll('nse_client_master');
  nseState.clients.loaded = true;
  nsePopulateFilterDropdowns('clients');
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
  nsePopulateFilterDropdowns('sips');
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
  nsePopulateFilterDropdowns('mandates');
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
  const thead   = document.getElementById(headId);
  const tbody   = document.getElementById(bodyId);
  const countEl = document.getElementById('nse-' + type + '-count');
  if (countEl) countEl.innerHTML = nseRowBadge(s.filtered.length);

  const rows = s.filtered.slice((s.page - 1) * NSE_PAGE_SIZE, s.page * NSE_PAGE_SIZE);

  if (!rows.length) {
    thead.innerHTML = '';
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">🔍</div>No data found.</div></td></tr>`;
    renderNsePager(type, pagerId);
    return;
  }

  /* Init column order on first load; restore saved visibility */
  if (!s.cols) {
    s.cols = Object.keys(rows[0]);
    nseLoadColVisibility(type);
  }
  const allCols = s.cols;
  const cols    = allCols.filter(c => !s.hiddenCols.has(c));  /* visible cols only */

  const cfg     = NSE_TABLE_CONFIG[type] || { sticky: 2, minW: { default: 120 } };
  const nSticky = cfg.sticky || 0;

  /* Compute sticky left offsets from config widths (safe when tab is hidden) */
  let leftAccum = 0;
  const stickyLefts = [];
  for (let i = 0; i < nSticky; i++) {
    stickyLefts.push(leftAccum);
    leftAccum += nseCW(type, allCols[i]);
  }

  const sortFns = { clients: 'sortNseClients', sips: 'sortNseSips', mandates: 'sortNseMandates' };
  const fn      = sortFns[type];

  /* Render draggable, sortable, sticky headers */
  thead.innerHTML = `<tr>${cols.map(c => {
    const origIdx = allCols.indexOf(c);
    const sticky  = origIdx < nSticky;
    const minW    = nseCW(type, c);
    const left    = sticky ? `left:${stickyLefts[origIdx]}px;` : '';
    const arrow   = s.sortCol === c ? (s.sortAsc ? ' ↑' : ' ↓') : '';
    return `<th class="sortable${sticky ? ' nse-sticky' : ''}" draggable="true"
              data-ci="${origIdx}" onclick="${fn}('${c}')"
              style="min-width:${minW}px;${left}">${c.replace(/_/g, ' ')}${arrow}</th>`;
  }).join('')}</tr>`;

  nseAttachDrag(type, thead);

  /* Render rows with sticky cells, smart formatting, and inline-edit on dblclick */
  tbody.innerHTML = rows.map((r, rowIdx) => {
    const globalIdx = (s.page - 1) * NSE_PAGE_SIZE + rowIdx;
    const rowKey    = r.id ?? globalIdx;
    return `<tr>${cols.map(c => {
      const origIdx = allCols.indexOf(c);
      const sticky  = origIdx < nSticky;
      const leftPx  = sticky ? stickyLefts[origIdx] : null;
      const v       = r[c];

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
        inner = `<span style="max-width:220px;overflow:hidden;text-overflow:ellipsis;display:block" title="${esc(String(v))}">${esc(String(v))}</span>`;
      }

      const rawVal   = esc(String(v ?? ''));
      const clsAttr  = sticky ? ' class="nse-sticky"' : '';
      const styleVal = (sticky ? `left:${leftPx}px;` : '') + (c !== 'id' ? 'cursor:pointer;' : '');
      const styleAttr = styleVal ? ` style="${styleVal}"` : '';
      const editAttr  = c !== 'id'
        ? ` ondblclick="nseInlineEdit(this,'${type}','${c}','${rowKey}')" data-raw="${rawVal}"`
        : '';

      return `<td${clsAttr}${styleAttr}${editAttr}>${inner}</td>`;
    }).join('')}</tr>`;
  }).join('');

  renderNsePager(type, pagerId);
}

/* ── Column drag-and-drop ── */
function nseAttachDrag(type, thead) {
  const ths = Array.from(thead.querySelectorAll('th[draggable]'));
  let dragIdx = null;

  ths.forEach(th => {
    th.addEventListener('dragstart', e => {
      dragIdx = +th.dataset.ci;
      th.classList.add('nse-th-dragging');
      e.dataTransfer.effectAllowed = 'move';
      /* Prevent onclick sort from firing on drop */
      e.dataTransfer.setData('text/plain', dragIdx);
    });

    th.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      ths.forEach(t => t.classList.remove('nse-th-over'));
      if (+th.dataset.ci !== dragIdx) th.classList.add('nse-th-over');
    });

    th.addEventListener('dragleave', () => {
      th.classList.remove('nse-th-over');
    });

    th.addEventListener('drop', e => {
      e.preventDefault();
      e.stopPropagation();         /* block the onclick sort */
      const toIdx = +th.dataset.ci;
      if (toIdx === dragIdx || dragIdx === null) return;
      const cols = nseState[type].cols;
      const [moved] = cols.splice(dragIdx, 1);
      cols.splice(toIdx, 0, moved);
      if (type === 'clients')  renderNseClientsTable();
      if (type === 'sips')     renderNseSipsTable();
      if (type === 'mandates') renderNseMandatesTable();
    });

    th.addEventListener('dragend', () => {
      dragIdx = null;
      ths.forEach(t => {
        t.classList.remove('nse-th-dragging');
        t.classList.remove('nse-th-over');
      });
    });
  });
}

/* ══ NSE FILTER + PILLS ══════════════════════════════════ */

function nseApplyAllFilters(type) {
  const s  = nseState[type];
  const q  = (document.getElementById('nse-' + type + '-search')?.value || '').toLowerCase();
  const cf = s.colFilters;
  s.filtered = s.raw.filter(r => {
    if (q && !Object.values(r).some(v => String(v ?? '').toLowerCase().includes(q))) return false;
    for (const [col, val] of Object.entries(cf)) {
      if (val && String(r[col] ?? '') !== val) return false;
    }
    return true;
  });
  s.page = 1;
  nseRenderFilterPills(type);
  nseSortData(type);
}

function nseColFilter(type, col, val) {
  if (val) nseState[type].colFilters[col] = val;
  else delete nseState[type].colFilters[col];
  nseApplyAllFilters(type);
}

function nseClearFilters(type) {
  nseState[type].colFilters = {};
  const searchEl = document.getElementById('nse-' + type + '-search');
  if (searchEl) searchEl.value = '';
  document.querySelectorAll(`[data-nse-type="${type}"][data-nse-col]`).forEach(s => { s.value = ''; });
  nseApplyAllFilters(type);
}

function nseRenderFilterPills(type) {
  const pillsRow = document.getElementById('nse-' + type + '-pills');
  if (!pillsRow) return;
  const cf = nseState[type].colFilters;
  const q  = document.getElementById('nse-' + type + '-search')?.value || '';
  const pills = [];
  if (q) pills.push(
    `<span class="nse-pill">Search: "${esc(q)}"` +
    ` <button onclick="document.getElementById('nse-${type}-search').value='';nseApplyAllFilters('${type}')">×</button></span>`
  );
  for (const [col, val] of Object.entries(cf)) {
    pills.push(
      `<span class="nse-pill">${col.replace(/_/g,' ')}: ${esc(val)}` +
      ` <button onclick="nseColFilter('${type}','${col}','');document.querySelector('[data-nse-type=${type}][data-nse-col=${col}]').value=''">×</button></span>`
    );
  }
  pillsRow.innerHTML = pills.join('');
}

function nsePopulateFilterDropdowns(type) {
  const raw = nseState[type].raw;
  document.querySelectorAll(`[data-nse-type="${type}"][data-nse-col]`).forEach(sel => {
    const col  = sel.dataset.nseCol;
    const vals = [...new Set(raw.map(r => String(r[col] ?? '')).filter(Boolean))].sort();
    const cur  = sel.value;
    sel.innerHTML = `<option value="">All ${col.replace(/_/g,' ')}</option>` +
      vals.map(v => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(v)}</option>`).join('');
  });
}

/* ══ COLUMN VISIBILITY ════════════════════════════════════ */

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

/* ══ TABLE SCROLL SLIDER ══════════════════════════════════ */

function nseSliderScroll(wrapId, slider) {
  const wrap = document.getElementById(wrapId);
  if (!wrap) return;
  const maxScroll = wrap.scrollWidth - wrap.clientWidth;
  wrap.scrollLeft = (slider.value / 1000) * maxScroll;
}

function nseInitSliderSync(wrapId, sliderId) {
  const wrap   = document.getElementById(wrapId);
  const slider = document.getElementById(sliderId);
  if (!wrap || !slider) return;
  wrap.addEventListener('scroll', () => {
    const maxScroll = wrap.scrollWidth - wrap.clientWidth;
    slider.value = maxScroll > 0 ? Math.round((wrap.scrollLeft / maxScroll) * 1000) : 0;
  });
}

/* Init all 3 slider↔table syncs after DOM is ready */
document.addEventListener('DOMContentLoaded', () => {
  nseInitSliderSync('nse-clients-wrap',  'nse-clients-slider');
  nseInitSliderSync('nse-sips-wrap',     'nse-sips-slider');
  nseInitSliderSync('nse-mandates-wrap', 'nse-mandates-slider');
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

  const tables = { clients: 'nse_client_master', sips: 'nse_sip_transactions', mandates: 'nse_mandates' };
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

/* ══ BOOT ══ */
checkAuth();
