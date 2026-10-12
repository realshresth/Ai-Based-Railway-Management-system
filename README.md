# Railway Reservation Management System

**Tagline:** Book Your Journey. Travel With Confidence.

A full-stack railway booking platform: React (Vite) frontend, Node.js +
Express REST API, MySQL database. Users can search trains, view schedules,
book tickets with real seat/fare logic, generate PNR numbers, manage saved
passengers and their booking history. Admins get a dashboard to manage
trains, stations, routes, fares, bookings and users.

This is a real, runnable codebase — not a static mockup. Every button and
form calls an actual backend endpoint, backed by MySQL tables.

## Project structure

```
railway-reservation-system/
├── database/schema.sql      # tables + realistic sample data (8 trains, 12 stations)
├── backend/                 # Express REST API
│   ├── config/db.js         # MySQL connection pool
│   ├── middleware/auth.js   # JWT verification + admin guard
│   ├── routes/              # auth, stations, trains, routes, bookings, passengers, users
│   ├── utils/pnr.js         # unique PNR generator
│   ├── utils/seedAdmin.js   # creates the first admin account
│   └── server.js
└── frontend/                # React (Vite) app
    └── src/
        ├── api/client.js    # axios instance with JWT auto-attach
        ├── context/AuthContext.jsx
        ├── components/      # Navbar, Footer, ServiceCard, RailScene, etc.
        └── pages/           # Home, Schedule, Booking, PNRStatus, MyBookings,
                              # Passengers, Login, Register, AdminLogin,
                              # ForgotPassword, AdminDashboard
```

## Quick start (updated)

1. Make sure MySQL is running. Open `backend/.env` and put your MySQL password in `DB_PASSWORD`.
2. `cd backend && npm install && npm run dev` — on first start the server **creates the database,
   tables, sample trains and a default admin by itself** (no manual SQL or seed step needed).
3. `cd frontend && npm install && npm run dev`, then open http://localhost:5173.

Logins: **Admin** `admin@railsarthi.in` / `admin123` at `/admin-login` (admin signup code: `admin2026`).
**Clients** register at `/login` -> Sign Up. Both can open **Profile** from the navbar (edit details, change password).
Check http://localhost:5000/api/health — it must say `"db":"connected"`; if not, fix `DB_USER`/`DB_PASSWORD`.

## 1. Set up the database (manual option)

Install MySQL 8+ locally (or use a cloud instance), then:

```bash
mysql -u root -p < database/schema.sql
```

This creates the `railway_reservation` database, all tables, and seeds
12 stations, 8 trains with realistic routes/timings, their intermediate
stops, and fare classes (Sleeper / 3A / 2A / 1A).

## 2. Run the backend

```bash
cd backend
npm install
cp .env.example .env
# edit .env: set DB_PASSWORD to your MySQL password, and set a real JWT_SECRET
npm run seed:admin     # creates the admin login from ADMIN_EMAIL/ADMIN_PASSWORD in .env
npm run dev            # starts on http://localhost:5000
```

Default seeded admin (unless you changed `.env`): `admin@railsarthi.in` / `admin123`.

## 3. Run the frontend

```bash
cd frontend
npm install
npm run dev             # starts on http://localhost:5173
```

The Vite dev server proxies `/api/*` to `http://localhost:5000`, so the
frontend and backend talk to each other with no extra config. Open
`http://localhost:5173`.

## What's actually wired up (not just UI)

- **Client auth**: one combined Sign In / Sign Up page at `/login` (toggle
  between modes, no separate register page needed).
- **Admin auth**: one combined Admin Sign In / Sign Up page at
  `/admin-login`. Admin signup requires the `ADMIN_SIGNUP_CODE` from the
  backend's `.env` — share that code only with staff. This prevents
  random visitors from self-promoting to admin.
- **AI-Based Search**: a natural-language bar at the top of the home hero
  ("fastest train from Lucknow to Mumbai tomorrow evening"). It's a
  lightweight heuristic parser (matches station names/cities/codes in the
  text, understands "today"/"tomorrow" and "fastest") — not a paid LLM
  call, so it works offline. See `parseQuery()` in
  `frontend/src/components/AIHeroSearch.jsx` if you want to swap it for a
  real LLM-backed query later.
- **Plan Travel**: a multi-leg trip builder at `/plan-travel` — add as
  many legs as you want (leg 2 pre-fills its "from" with leg 1's "to"),
  pick a train + class per leg, then book the whole trip in one action
  (it books each leg as its own PNR against the same passenger list).
- **Schedule search**: filter the timetable by train number or name,
  with live per-class fares and seat availability shown on each card
  (pulled straight from `train_classes`, so admin fare edits show up
  immediately).
- **Search & booking**: live seat availability and fares pulled from
  `train_classes`; booking a seat decrements availability in a DB
  transaction and issues a unique PNR; overbooking automatically produces
  a "Waiting" status instead of a seat number.
- **PNR status**: public endpoint, no login required — matches how real
  PNR lookup works.
- **My Bookings**: cancelling releases the seats back to the class pool;
  "download ticket" exports a real text file built from the booking data.
- **Passenger Management**: full CRUD scoped to the logged-in user.
- **Admin Dashboard**: live stats (from real COUNT/SUM queries), and CRUD
  for trains, stations, routes/stops, fares, bookings and user roles.

## Adding train & route photos

Schedule and the home page's popular-destinations cards look for real
photos and fall back to a styled placeholder if none exist, so nothing
breaks either way:

- Train photo: `frontend/public/images/trains/<train_number>.jpg`
  (e.g. `12430.jpg`)
- Destination photo: `frontend/public/images/destinations/<slug>.jpg`
  (slugs used today: `lucknow-newdelhi`, `mumbai-chennai`,
  `patna-kolkata`, `chennai-bengaluru`)

Use your own licensed images (a free stock site like Pexels/Unsplash, or
your own photos) — nothing is hotlinked from the internet in this
codebase on purpose, so there's nothing to break or attribute later.

## Troubleshooting: "Admin login failed" / "Login failed"

The client and admin auth pages now distinguish two different failures —
worth checking which one you're actually seeing:

- **"Invalid admin credentials."** (a specific message from the server) →
  the email/password really don't match what's in the database. Re-run
  `npm run seed:admin` in `backend/` and confirm the email/password match
  what's in your `.env`.
- **"Couldn't reach the server. Is the backend running?"** (a generic
  network failure) → the frontend never got a response at all. Check:
  1. Is `npm run dev` still running in `backend/` with no errors in that
     terminal?
  2. Are you opening the app through the Vite dev server URL
     (`http://localhost:5173`) rather than a built/static copy? The
     `/api` proxy to the backend is configured in `vite.config.js` and
     only applies to the dev server — a production build needs its own
     reverse proxy or a full backend URL in `api/client.js`.
  3. Does `backend/.env` actually exist (copied from `.env.example`) with
     a working `DB_PASSWORD`? Check the backend terminal for MySQL
     connection errors on startup.

## Known limitations / good next steps

- No payment gateway is integrated — "Confirm & Pay" simulates payment
  and books immediately. Wiring in Razorpay/Stripe would be the natural
  next step.
- Forgot-password returns the token directly instead of emailing it —
  fine for local dev, not for production.
- Admin train editing has a backend endpoint (`PUT /api/trains/:id`) but
  no dedicated edit form in the UI yet — only add/remove. Wiring up an
  edit modal in `AdminDashboard.jsx` reuses that existing endpoint.
- No automated tests yet — worth adding integration tests against the
  Express routes (e.g. with `supertest` + a test MySQL database).

## Verification note

Every backend `.js` file passed `node --check`, and every frontend
`.jsx` file was compiled with esbuild to confirm valid syntax. Full
`npm install` + an actual running MySQL instance were not available in
the environment this was built in, so please run it locally to confirm
end-to-end behavior, and open an issue-style note back if anything
doesn't line up — happy to fix it.
