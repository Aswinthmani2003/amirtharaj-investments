/* ═══════════════════════════════════════════════════════════
   Amirtharaj Investments — Main JavaScript
   ═══════════════════════════════════════════════════════════ */

/* ── Supabase Config
   Replace these two values with your actual Supabase project credentials.
   Find them at: https://app.supabase.com → Project Settings → API
   ─────────────────────────────────────────────────────────── */

const SUPABASE_URL  = window.__ENV__.SUPABASE_URL;
const SUPABASE_ANON = window.__ENV__.SUPABASE_ANON;
const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON);

/* ══════════════════════════════════════════════════════════
   NAVBAR — scroll effect
   ══════════════════════════════════════════════════════════ */
window.addEventListener('scroll', () => {
  document.getElementById('navbar')
    .classList.toggle('scrolled', window.scrollY > 40);
});

/* ══════════════════════════════════════════════════════════
   MOBILE NAV
   ══════════════════════════════════════════════════════════ */
function openMobileNav() {
  document.getElementById('mobileNav').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeMobileNav() {
  document.getElementById('mobileNav').classList.remove('open');
  document.body.style.overflow = '';
}

/* ══════════════════════════════════════════════════════════
   MODALS — open / close
   ══════════════════════════════════════════════════════════ */
function openModal(type) {
  const id = type === 'client' ? 'clientModal' : 'adminModal';
  document.getElementById(id).classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeModal(type) {
  const id = type === 'client' ? 'clientModal' : 'adminModal';
  document.getElementById(id).classList.remove('open');
  document.body.style.overflow = '';
}

// Close modal by clicking backdrop
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) {
      overlay.classList.remove('open');
      document.body.style.overflow = '';
    }
  });
});

// Close modal with Escape key
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay')
      .forEach(o => o.classList.remove('open'));
    document.body.style.overflow = '';
  }
});

/* ══════════════════════════════════════════════════════════
   AUTH — Client Login
   Supabase email+password → redirect to /client-dashboard
   ══════════════════════════════════════════════════════════ */
async function handleClientLogin() {
  const email    = document.getElementById('cl-email').value.trim();
  const password = document.getElementById('cl-password').value;
  const btn      = document.getElementById('cl-submit');
  const msg      = document.getElementById('cl-msg');

  if (!email || !password) {
    showMsg(msg, 'Please fill in all fields.', 'error');
    return;
  }

  btn.disabled    = true;
  btn.textContent = 'Signing in…';

  try {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;

    showMsg(msg, 'Login successful! Redirecting…', 'success');
    setTimeout(() => { window.location.href = '/client-dashboard'; }, 1200);
  } catch (err) {
    showMsg(msg, err.message || 'Login failed. Check your credentials.', 'error');
    btn.disabled    = false;
    btn.textContent = 'Sign In →';
  }
}

/* ══════════════════════════════════════════════════════════
   AUTH — Admin Login
   Supabase email+password → check profiles.role = 'admin'
   → redirect to /admin
   ══════════════════════════════════════════════════════════ */
async function handleAdminLogin() {
  const email    = document.getElementById('al-email').value.trim();
  const password = document.getElementById('al-password').value;
  const btn      = document.getElementById('al-submit');
  const msg      = document.getElementById('al-msg');

  if (!email || !password) {
    showMsg(msg, 'Please fill in all fields.', 'error');
    return;
  }

  btn.disabled    = true;
  btn.textContent = 'Signing in…';

  try {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;

    // Verify admin role in profiles table
    const { data: profile, error: pErr } = await sb
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single();

    if (pErr || !profile || profile.role !== 'admin') {
      await sb.auth.signOut();
      throw new Error('Access denied. Admin privileges required.');
    }

    showMsg(msg, 'Admin verified! Redirecting…', 'success');
    setTimeout(() => { window.location.href = '/admin.html'; }, 1200);
  } catch (err) {
    showMsg(msg, err.message || 'Login failed.', 'error');
    btn.disabled    = false;
    btn.textContent = 'Admin Sign In →';
  }
}

/* ══════════════════════════════════════════════════════════
   CONTACT FORM → Supabase contact_enquiries table
   ══════════════════════════════════════════════════════════ */
async function submitContactForm() {
  const name    = document.getElementById('cf-name').value.trim();
  const phone   = document.getElementById('cf-phone').value.trim();
  const email   = document.getElementById('cf-email').value.trim();
  const message = document.getElementById('cf-message').value.trim();
  const btn     = document.getElementById('cf-submit');
  const msg     = document.getElementById('cf-msg');

  if (!name || !email || !message) {
    showMsg(msg, 'Please fill in Name, Email, and Message.', 'error');
    return;
  }

  btn.disabled    = true;
  btn.textContent = 'Sending…';

  try {
    const { error } = await sb
      .from('contact_enquiries')
      .insert([{ name, email, phone, message }]);

    if (error) throw error;

    showMsg(msg, "✓ Message sent! We'll get back to you shortly.", 'success');
    ['cf-name', 'cf-phone', 'cf-email', 'cf-message']
      .forEach(id => { document.getElementById(id).value = ''; });
    btn.textContent = 'Message Sent ✓';
  } catch (err) {
    showMsg(msg, 'Failed to send. Please email us directly.', 'error');
    btn.disabled    = false;
    btn.textContent = 'Send Message →';
  }
}

/* ── Helper: show form message ── */
function showMsg(el, text, type) {
  el.textContent = text;
  el.className   = 'form-msg ' + type;
  if (type === 'success') {
    setTimeout(() => { el.textContent = ''; }, 5000);
  }
}

/* ══════════════════════════════════════════════════════════
   SCROLL REVEAL — IntersectionObserver
   ══════════════════════════════════════════════════════════ */
const revealObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.reveal')
  .forEach(el => revealObserver.observe(el));

/* ══════════════════════════════════════════════════════════
   STATS COUNTER — animated count-up on scroll
   ══════════════════════════════════════════════════════════ */
function animateCounter(el) {
  const target   = Number(el.dataset.target);
  const duration = 1800;
  const start    = performance.now();

  function step(timestamp) {
    const progress = Math.min((timestamp - start) / duration, 1);
    const eased    = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    el.textContent = Math.round(eased * target);
    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      el.textContent = target;
    }
  }
  requestAnimationFrame(step);
}

const counterObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.querySelectorAll('.counter')
        .forEach(animateCounter);
      counterObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.3 });

const statsSection = document.getElementById('stats');
if (statsSection) counterObserver.observe(statsSection);

/* ══════════════════════════════════════════════════════════
   HERO PARTICLE CANVAS
   Floating connected-node network animation
   ══════════════════════════════════════════════════════════ */
(function initParticles() {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas) return;

  const ctx   = canvas.getContext('2d');
  const COUNT = 60;
  let W, H, particles = [];

  /* Resize canvas to fill parent */
  function resize() {
    W = canvas.width  = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
  }

  /* Particle constructor */
  function Particle() {
    this.x  = Math.random() * W;
    this.y  = Math.random() * H;
    this.r  = Math.random() * 1.5 + 0.3;
    this.vx = (Math.random() - 0.5) * 0.3;
    this.vy = (Math.random() - 0.5) * 0.3;
    this.a  = Math.random() * 0.5 + 0.1;
  }

  function init() {
    resize();
    particles = Array.from({ length: COUNT }, () => new Particle());
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    /* Draw dots */
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0) p.x = W;
      if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H;
      if (p.y > H) p.y = 0;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(232, 80, 58, ${p.a})`;
      ctx.fill();
    });

    /* Draw connecting lines */
    for (let i = 0; i < COUNT; i++) {
      for (let j = i + 1; j < COUNT; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const d  = Math.sqrt(dx * dx + dy * dy);
        if (d < 120) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(232, 80, 58, ${0.07 * (1 - d / 120)})`;
          ctx.lineWidth   = 0.6;
          ctx.stroke();
        }
      }
    }

    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize);
  init();
  draw();
})();
