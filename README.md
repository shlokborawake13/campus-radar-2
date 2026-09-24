# Campus Radar

**Campus Radar** is a student-focused collegiate social network and community platform designed for students of **Sanjivani University**. It provides verified institutional authentication, anonymous public pseudonym masks, discussions, confidential confessions, campus event discovery, club engagement, real-time telemetry, and administrative moderation.

---

## Key Features

* **Institutional Account Verification**:
  * Exclusive `@sanjivani.edu.in` domain enforcement.
  * Verified dual-channel OTP delivery:
    * **Email OTP** via Resend API.
    * **Phone SMS OTP** via TextBee Android SMS Gateway.
  * OWASP-compliant `scrypt` password hashing with unique random salts.
* **Student Privacy & Public Masking**:
  * Dual-layer identity: public mask pseudonym (e.g., `Anonymous Falcon`, `@mask_42`) prevents peers from viewing real student names, emails, or phone numbers.
  * Strict DTO segregation ensuring zero private data leakage to unauthorized peers.
* **Profile Picture System**:
  * Device photo upload with live client preview.
  * Binary magic byte validation (JPG, PNG, WebP only; rejects executables, scripts, SVGs).
  * Automatic EXIF and GPS metadata stripping.
  * High-performance 512×512 square WebP compression via `sharp`.
  * Isolated user folder storage in Supabase Storage (`avatars/{userId}/...`).
  * Automated cleanup of previous avatars upon replacement or deletion.
* **Posts, Confessions & Discussions**:
  * Categorized feeds (Trending, Confessions, Events, Clubs, Academics).
  * Decoupled anonymous confessions.
  * Nested discussion replies with granular privacy controls (`who_can_comment`).
  * Upvotes, bookmarks, and bi-directional user blocking.
* **Production Security Hardening**:
  * Server-side authorization verifying identity from authenticated tokens on every mutation (IDOR/BOLA immune).
  * Tiered rate limiting (Auth, OTP Send, OTP Verify, Posts, Comments, Uploads, Admin).
  * Helmet security headers with Content Security Policy (CSP).
  * Parameterized SQL queries defending against SQL injection.
  * Database-level UNIQUE constraints preventing duplicate registration and interaction race conditions.
* **Administrative Moderation & Telemetry**:
  * Role-based access control (RBAC) isolated from student APIs.
  * Comprehensive audit logging for all staff moderation actions.
  * Privacy-preserving telemetry tracking page views and engagement without recording keystrokes or credentials.

---

## Tech Stack

* **Frontend**: React 18, Vite, Tailwind CSS, Lucide Icons
* **Backend**: Node.js, Express.js
* **Database**: PostgreSQL (Supabase)
* **Storage**: Supabase Storage (`campus-radar-media`, `avatars`)
* **Email & SMS Delivery**: Resend, TextBee Gateway
* **Image Processing**: Sharp

---

## Project Structure

```text
cr3/
├── client/                     # Vite + React Frontend
│   ├── src/
│   │   ├── components/         # Reusable UI cards, modals & legal viewers
│   │   ├── views/              # FeedView, ProfileView, SettingsView, AdminView, AuthView
│   │   ├── services/           # API communication layer & telemetry
│   │   └── App.jsx
│   └── package.json
│
└── server/                     # Node.js + Express Backend
    ├── db/                     # PostgreSQL migrations, schema & indexes
    │   ├── 01_campus_radar_schema.sql
    │   ├── 02_campus_radar_seed.sql
    │   └── 03_performance_and_security_indexes.sql
    ├── middleware/             # Auth, RBAC, Rate Limiting, Privacy serializers
    ├── routes/                 # Admin management & telemetry endpoints
    ├── services/               # Resend Email, TextBee SMS, Avatar Processing
    ├── index.js                # Express API server
    ├── security.js             # Password hashing, token management & session cache
    └── package.json
```

---

## Getting Started

### 1. Prerequisites
* Node.js (v18 or higher)
* PostgreSQL / Supabase account

### 2. Backend Setup
```bash
cd server
npm install
cp .env.example .env
# Populate environment variables in .env
npm run dev
```

### 3. Frontend Setup
```bash
cd client
npm install
npm run dev
```

### 4. Running Security & Performance Tests
```bash
cd server
node test_security_hardening.js   # 32 security, IDOR, race condition & SLA assertions
node test_avatar_system.js        # 22 avatar validation, upload, replacement & removal tests
node test_complete_fixes.js       # 52 functionality regression tests
```

---

## License & Policies

Campus Radar is intended for the collegiate network of Sanjivani University. All users are governed by the Campus Radar Terms of Service and Privacy Policy.
