/* ══════════════════════════════════════════════════════
   ADMIN.JS — Amirtharaj Investments Admin Dashboard
   ══════════════════════════════════════════════════════ */

const SUPABASE_URL  = window.__ENV__.SUPABASE_URL;
const SUPABASE_ANON = window.__ENV__.SUPABASE_ANON;
const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON);

const tabMeta = {
  overview:  { title: 'Overview',                          sub: "Welcome back — here's what's happening today." },
  dashboard: { title: 'CAMS & KARVY Client Master Upload', sub: 'Upload CAMS/Karvy CSV, clean and push to Supabase.' },
  enquiries: { title: 'Enquiries',                         sub: 'Messages submitted via the contact form.' },
  clients:   { title: 'Client Profiles',                   sub: 'Registered users and admin roles.' },
  portfolio: { title: 'Portfolio',                         sub: 'Portfolio management module.' },
  reports:   { title: 'Reports',                           sub: 'Reporting and data export.' },
  settings:  { title: 'Settings',                          sub: 'Site configuration and preferences.' },
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

/* ══ BOOT ══ */
checkAuth();
