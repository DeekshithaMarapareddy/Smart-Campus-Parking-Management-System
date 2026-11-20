# Smart Campus Parking Management System (SCPMS)

A web-based platform that lets a campus centralize and manage parking: vehicle registration,
zones and slots, reservations, payments and complaints.

| Layer | Technology |
|---|---|
| Web app + API | Next.js (App Router) with Next.js API Routes |
| Structured / transactional data | PostgreSQL (`pg`) |
| Flexible logs (activity + sensor events) | MongoDB (`mongodb`) |
| Auth | bcrypt password hashes + signed JWT in an httpOnly cookie, role-based access |

## What it does

* **Students and staff**: register, add vehicles, search free slots for a date and time, book and pay,
  cancel (with automatic refund), and raise complaints about a slot.
* **Admins**: manage zones and slots, block or promote users, resolve complaints, view analytical
  reports, and inspect the MongoDB activity and sensor logs.

## Database concepts demonstrated

| Concept | Where |
|---|---|
| ER diagram to tables (PK, FK, UNIQUE, CHECK) | `database/schema.sql` |
| **Transactions** | `lib/db.js` `withTransaction`; booking + payment is one atomic unit (`app/api/bookings/route.js`, registration creates user + staff rows) |
| **Row locking** against double-booking | `fn_create_booking` locks the slot row with `FOR UPDATE` |
| **Indexing** (B-tree, composite, partial) | `idx_bookings_slot_date`, `idx_bookings_active` (partial), etc. |
| **Triggers** | booking validation, booking audit trail, refund on cancel, complaint `resolved_at`, maintenance guard |
| **Views** | `v_booking_details`, `v_slot_overview`, `v_daily_revenue`, `v_user_activity` |
| **Stored functions** | `fn_calculate_fee`, `fn_is_slot_available`, `fn_create_booking`, `fn_pay_booking`, `fn_cancel_booking`, `fn_complete_expired_bookings`, `fn_zone_utilization` |
| **Joins, window functions, aggregation, subqueries** | `app/api/admin/reports/route.js`, `database/queries.sql` |
| **MongoDB** collections, TTL index, aggregation pipelines | `scripts/seed.js`, `app/api/admin/logs/route.js` |

## Project structure

```
database/schema.sql      tables, indexes, functions, triggers, views
database/queries.sql     demo queries for the viva
scripts/setup-db.js      one command to create + seed everything
scripts/seed.js          demo data (users, vehicles, zones, ~80 bookings, complaints, Mongo logs)
lib/                     db, mongo, auth, api helpers
app/api/...              REST API routes
app/(app)/...            logged-in pages (dashboard, book, bookings, vehicles, complaints, admin/*)
app/login, app/register  public pages
components/              navbar, auth provider, UI pieces
```

## How to run

### 1. Install the prerequisites
* **Node.js 20 or newer** (https://nodejs.org)
* **PostgreSQL 14 or newer** running locally (remember the `postgres` user's password)
* **MongoDB** (optional but recommended): MongoDB Community Server on `localhost:27017`.
  Without it the app still works, only the Logs page is empty.

### 2. Install the packages
```bash
cd scpms
npm install
```

### 3. Configure the environment
```bash
cp .env.example .env.local        # on Windows: copy .env.example .env.local
```
Open `.env.local` and set `DATABASE_URL` with your PostgreSQL password, for example
`postgresql://postgres:YOUR_PASSWORD@localhost:5432/scpms`, and change `JWT_SECRET` to any long random text.

### 4. Create the databases and demo data
```bash
npm run db:setup
```
This creates the `scpms` database if it does not exist, builds all tables, triggers and views,
loads demo data and seeds MongoDB. **It wipes the `public` schema of that database, so run it only on a dev database.**
Run it again at any time to reset the demo data.

### 5. Start the app
```bash
npm run dev
```
Open http://localhost:3000

For a production-style run: `npm run build` then `npm start`.

### Demo logins

| Role | Email | Password |
|---|---|---|
| Admin | admin@scpms.edu | Admin@123 |
| Staff | ravi.kumar@scpms.edu | Password@123 |
| Student | ananya@scpms.edu | Password@123 |

## Business rules (enforced in the database)

* A slot cannot be booked twice for overlapping times; neither can a vehicle.
* The vehicle must belong to the user, be active, and match the slot type (Car / Bike / EV).
* Parking hours are 06:00 to 22:00, and past times cannot be booked.
* Fees: Car ₹20/hour, Bike ₹10/hour, EV ₹30/hour, rounded up to the full hour.
* Cancelling refunds a paid payment (or cancels a pending one) automatically; a started booking can only be cancelled by an admin.
* A slot with upcoming bookings cannot be put into maintenance.

## Troubleshooting

* **`password authentication failed`**: wrong password in `DATABASE_URL`.
* **`ECONNREFUSED 5432`**: PostgreSQL is not running.
* **MongoDB warning during setup**: MongoDB is not running. Start it and run `npm run db:setup` again.
* **Logged out immediately / `JWT_SECRET` error**: set `JWT_SECRET` (16+ characters) in `.env.local`.
