/* ═══════════════════════════════════════════════════════════
   Amirtharaj Investments — Admin Dashboard JavaScript
   ═══════════════════════════════════════════════════════════ */

/* ── Supabase Config — same credentials as main.js ── */
const SUPABASE_URL  = 'https://rymjasiplephtugcsqbr.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5bWphc2lwbGVwaHR1Z2NzcWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxOTQwMTQsImV4cCI6MjA4Nzc3MDAxNH0.LaVR-1UI0XbPutCcMrb1riPWGcxm4jgvksaqo97BQyQ';
const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON);

/* ══════════════════════════════════════════════════════════
   AUTH GATE — verify admin session on page load
   ══════════════════════════════════════════════════════════ */
async function checkAdminAuth() {
  try {
    const { data: { session } } = await sb.auth.getSession();

    if (!session) {
      setTimeout(() => { window.location.href = '/admin.html'; }, 1200);

      return;
    }

    const { data: profile } = await sb
      .from('profiles')
      .select('role, full_name')
      .eq('id', session.user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      await sb.auth.signOut();
      setTimeout(() => { window.location.href = '/admin.html'; }, 1200);
      return;
    }

    // Set admin display name
    document.getElementById('admin-name').textContent =
      profile.full_name || session.user.email.split('@')[0];

    // Reveal the app shell
    document.getElementById('auth-gate').style.display = 'none';
    document.getElementById('app').classList.add('ready');

    // Load initial data
    loadStats();
    loadEnquiries();

  } catch (err) {
    setTimeout(() => { window.location.href = '/admin.html'; }, 1200);
  }
}

/* ══════════════════════════════════════════════════════════
   LOGOUT
   ══════════════════════════════════════════════════════════ */
async function handleLogout() {
  await sb.auth.signOut();
  setTimeout(() => { window.location.href = '/admin.html'; }, 1200);
}

/* ══════════════════════════════════════════════════════════
   TAB SWITCHING
   ══════════════════════════════════════════════════════════ */
const tabMeta = {
  overview:  { title: 'Overview',   sub: "Welcome back — here's what's happening today." },
  dashboard: { title: 'Dashboard',  sub: 'Your integrated dashboard panel.' },
  enquiries: { title: 'Enquiries',  sub: 'Contact form submissions from your website.' },
  clients:   { title: 'Clients',    sub: 'Registered client profiles.' },
  portfolio: { title: 'Portfolio',  sub: 'Portfolio management and tracking.' },
  reports:   { title: 'Reports',    sub: 'Analytics and reporting tools.' },
  settings:  { title: 'Settings',   sub: 'Admin configuration and preferences.' },
};

let activeTab = 'overview';

function switchTab(tab) {
  // Hide current tab
  document.getElementById('tab-' + activeTab).style.display = 'none';
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

  // Show new tab
  activeTab = tab;
  document.getElementById('tab-' + tab).style.display = 'block';

  // Highlight active sidebar item
  document.querySelectorAll('.nav-item').forEach(el => {
    if (el.getAttribute('onclick') && el.getAttribute('onclick').includes("'" + tab + "'")) {
      el.classList.add('active');
    }
  });

  // Update topbar title and subtitle
  document.getElementById('page-title').textContent = tabMeta[tab].title;
  document.getElementById('page-sub').textContent   = tabMeta[tab].sub;

  // Lazy-load tab data
  if (tab === 'enquiries') loadEnquiries();
  if (tab === 'clients')   loadClients();

  // Close mobile sidebar
  closeSidebar();
}

/* ══════════════════════════════════════════════════════════
   LOAD STATS — client count + enquiry count
   ══════════════════════════════════════════════════════════ */
async function loadStats() {
  try {
    const [{ count: clients }, { count: enquiries }] = await Promise.all([
      sb.from('profiles').select('*', { count: 'exact', head: true }),
      sb.from('contact_enquiries').select('*', { count: 'exact', head: true }),
    ]);

    document.getElementById('stat-clients').textContent   = clients   ?? '—';
    document.getElementById('stat-enquiries').textContent = enquiries ?? '—';
    document.getElementById('client-change').textContent  = (clients ?? 0) + ' total';
    document.getElementById('enq-change').textContent     = (enquiries ?? 0) + ' total';

    if (enquiries > 0) {
      const badge = document.getElementById('enquiry-count');
      badge.textContent    = enquiries;
      badge.style.display  = 'inline';
    }
  } catch (e) { /* silent fail — RLS may block */ }
}

/* ══════════════════════════════════════════════════════════
   LOAD ENQUIRIES — from contact_enquiries table
   ══════════════════════════════════════════════════════════ */
async function loadEnquiries() {
  const tbody = document.getElementById('enquiries-body');
  tbody.innerHTML = `<tr><td colspan="6">
    <div class="empty-state"><div class="empty-icon">⏳</div>Loading…</div>
  </td></tr>`;

  try {
    const { data, error } = await sb
      .from('contact_enquiries')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!data || data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6">
        <div class="empty-state"><div class="empty-icon">📭</div>No enquiries yet.</div>
      </td></tr>`;
      return;
    }

    tbody.innerHTML = data.map(row => `
      <tr>
        <td><strong>${esc(row.name)}</strong></td>
        <td><a href="mailto:${esc(row.email)}" style="color:var(--brand)">${esc(row.email)}</a></td>
        <td>${esc(row.phone || '—')}</td>
        <td style="max-width:260px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--muted)">
          ${esc(row.message)}
        </td>
        <td style="white-space:nowrap;color:var(--muted)">${formatDate(row.created_at)}</td>
        <td><span class="badge badge-new">New</span></td>
      </tr>
    `).join('');

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6">
      <div class="empty-state"><div class="empty-icon">⚠️</div>Failed to load. Check RLS policies.</div>
    </td></tr>`;
  }
}

/* ══════════════════════════════════════════════════════════
   LOAD CLIENTS — from profiles table
   ══════════════════════════════════════════════════════════ */
async function loadClients() {
  const tbody = document.getElementById('clients-body');
  tbody.innerHTML = `<tr><td colspan="5">
    <div class="empty-state"><div class="empty-icon">⏳</div>Loading…</div>
  </td></tr>`;

  try {
    const { data, error } = await sb
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!data || data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5">
        <div class="empty-state"><div class="empty-icon">👤</div>No clients yet.</div>
      </td></tr>`;
      return;
    }

    tbody.innerHTML = data.map(row => `
      <tr>
        <td><strong>${esc(row.full_name || '—')}</strong></td>
        <td>
          <span class="badge ${row.role === 'admin' ? 'badge-new' : 'badge-read'}">
            ${esc(row.role)}
          </span>
        </td>
        <td style="color:var(--muted)">${esc(row.ai_code || '—')}</td>
        <td style="color:var(--muted);font-size:11px;font-family:monospace">
          ${esc(row.id.substring(0, 16))}…
        </td>
        <td style="color:var(--muted);white-space:nowrap">${formatDate(row.created_at)}</td>
      </tr>
    `).join('');

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5">
      <div class="empty-state"><div class="empty-icon">⚠️</div>Failed to load. Check RLS policies.</div>
    </td></tr>`;
  }
}

/* ══════════════════════════════════════════════════════════
   MOBILE SIDEBAR
   ══════════════════════════════════════════════════════════ */
function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebarOverlay').classList.add('show');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('show');
}

/* ══════════════════════════════════════════════════════════
   TOAST NOTIFICATION
   ══════════════════════════════════════════════════════════ */
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = (type === 'success' ? '✓ ' : '⚠ ') + msg;
  t.className   = 'toast ' + type + ' show';
  setTimeout(() => { t.className = 'toast'; }, 3500);
}

/* ── Helpers ── */
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

/* ── Set current date in topbar ── */
document.getElementById('current-date').textContent =
  new Date().toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
  });

/* ── Boot: check auth on page load ── */
checkAdminAuth();
