# Amirtharaj Investments — Website

**Data-Driven Mutual Fund Distribution**
AMFI Registered MFD · ARN-70102 · SIF Distributor

---

## Project Structure

```
amirtharaj-investments/
├── index.html                  ← Main homepage
├── assets/
│   ├── css/
│   │   └── style.css           ← All styles (brand: #E8503A)
│   ├── js/
│   │   └── main.js             ← All JavaScript (Supabase auth, animations)
│   └── images/
│       └── logo.png            ← Company logo
└── README.md
```

---

## Setup

### 1. Configure Supabase

Open `assets/js/main.js` and replace the placeholder values at the top:

```js
const SUPABASE_URL  = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON = 'YOUR_ANON_KEY_HERE';
```

Find your credentials at:  
**https://app.supabase.com → Your Project → Project Settings → API**

---

### 2. Supabase Tables Required

Ensure these tables exist in your Supabase project:

#### `profiles`
| Column      | Type    | Notes                        |
|-------------|---------|------------------------------|
| id          | uuid    | References auth.users(id)    |
| full_name   | text    |                              |
| role        | text    | `'admin'` or `'client'`      |
| ai_code     | text    | Optional                     |

#### `contact_enquiries`
| Column     | Type        | Notes          |
|------------|-------------|----------------|
| id         | uuid        | Auto-generated |
| name       | text        |                |
| email      | text        |                |
| phone      | text        |                |
| message    | text        |                |
| created_at | timestamptz | Auto-generated |

---

### 3. Auth Flows

| Button       | Action                                              |
|--------------|-----------------------------------------------------|
| Client Login | Supabase email+password → `/client-dashboard`       |
| Admin Login  | Supabase email+password → checks `profiles.role = 'admin'` → `/admin` |

---

### 4. Deployment (www.amirtharaj.com)

This is a **static site** — no build step needed.

**Option A — Drag & Drop (Netlify / Vercel)**
1. Zip the entire `amirtharaj-investments/` folder
2. Drop it into Netlify or Vercel dashboard
3. Set custom domain to `www.amirtharaj.com`

**Option B — Traditional Hosting (cPanel / FTP)**
1. Upload all files maintaining the folder structure
2. Point the domain root to where `index.html` lives

**Option C — GitHub Pages**
1. Push the folder contents to a GitHub repo
2. Enable GitHub Pages from the repo settings

---

## Brand

| Token           | Value                   |
|-----------------|-------------------------|
| Primary brand   | `#E8503A` (coral-red)   |
| Background      | `#0D1117`               |
| Surface         | `#111820`               |
| Text            | `#F0F4F8`               |
| Muted text      | `#7A8899`               |
| Display font    | Syne (Google Fonts)     |
| Body font       | DM Sans (Google Fonts)  |

---

## Sections

1. **Navbar** — Logo, nav links, Client Login + Admin Login buttons
2. **Hero** — Animated particle canvas, tagline, CTAs
3. **Stats Bar** — Animated counters on scroll
4. **Services** — 6 glassmorphism cards
5. **Why Choose Us** — Orbiting visual + feature points
6. **About** — Company story + ARN details card
7. **Contact** — Info, Google Maps embed, Supabase contact form
8. **Footer** — Links, social icons, SEBI disclaimer

---

*© 2025 Amirtharaj Investments. All rights reserved.*
