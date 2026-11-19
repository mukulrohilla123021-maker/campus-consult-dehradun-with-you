# Campus Consult Dehradun

**Student Talent. Business Solutions. Local Growth.**

Campus Consult Dehradun is a full-stack, student-led micro-consulting marketplace connecting vetted university students in Dehradun (Uttarakhand, India) with local MSMEs, retailers (including Dhiman Market, Selaqui), pharmacies, restaurants, startups, and service providers for affordable project-based business, financial, and digital consulting.

The platform also preserves the complete 17-section **MBA Venture Plan (Assignment 1 — DBS Global University, Student: Mukul, Roll No: 0251MBA580)** alongside an interactive **Strategy vs. Live Database Actuals** workspace inside the authorized Admin & Super Admin portals.

---

## Core Architecture

- **Frontend:** React 19, Vite, Tailwind CSS v4, Lucide Icons
- **Backend:** Node.js + Express (`server.ts`, port `3000`)
- **Database:** Embedded persistent SQLite via Node.js native `node:sqlite` (`DatabaseSync`, WAL mode) storing 28 normalized tables in `data/campus_consult.db` (including `subscriptions` and `venture_plan_notes`)
- **Real-Time Communication:** Authenticated WebSocket server (`/ws`) via `ws` pushing live messages and notifications across active sessions
- **File Storage:** Base64-validated project, service image, and business document uploads stored on disk in `storage/uploads/` with role- and ownership-checked download streaming
- **Authentication & RBAC:**
  - `scrypt` per-user salted password hashing with `crypto.timingSafeEqual` verification
  - HMAC-SHA256 signed `HttpOnly` session cookies (`cc_session`) with Bearer token fallback for cross-origin preview iframes
  - Rate-limited auth endpoints and server-enforced RBAC across 4 distinct roles:
    1. **Customer** (`/api/bookings` with project title, budget INR, auto-assign/consultant selector, and inline supporting document upload, projects, chat, payments, invoices, verified reviews, support)
    2. **Student Consultant** (verification approval queue, weekly availability calendar, tasks/milestones/deliverables, earnings/payouts, review replies)
    3. **Admin** (approvals, full Service & Category Create/Edit/Enable/Delete CRUD with image upload & duplicate guards, quotation issuance, consultant assignment, payment recording, payout execution, expenses, date-filtered BI revenue/category/trend analytics, financial CSV/print reports, review/chat moderation, support tickets, audit logs, 17-section Venture Plan)
    4. **Super Admin** (one-time bootstrap, admin account provisioning, configurable platform commission % with 15% standard preset, tax %, duplicate booking policy, Monthly Retainer Subscriptions management, editable Venture Plan assumptions vs. live SQLite actuals, database table health monitor, full JSON backup export)

---

## Quick Start (Local Development)

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   Copy `.env.example` to `.env` and set a strong `SESSION_SECRET`:
   ```bash
   cp .env.example .env
   ```

3. **Run the development server (Express + Vite middlewares on port 3000):**
   ```bash
   npm run dev
   ```

4. **Production build & start:**
   ```bash
   npm run build
   npm start
   ```
   (`npm start` runs `node server.ts`, requiring Node.js v22+ for native TypeScript stripping and `node:sqlite`.)

---

## First-Time Super Admin Setup

Public `/api/auth/register` strictly creates `customer` or `consultant` accounts. To initialize the first `super_admin`:

- **Option A (Interactive UI):** Start the app, open `/login` (or click **Portal Login**), and follow the one-time **Super Admin Bootstrap** prompt (available only when zero `super_admin` accounts exist in SQLite).
- **Option B (Environment Seed):** Set `SEED_SUPERADMIN_EMAIL` and `SEED_SUPERADMIN_PASSWORD` (and optionally `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`) in `.env` before the first boot.

Once initialized, the Super Admin can create additional Admin or Super Admin accounts from **Super Admin Panel → Admin Accounts**.

---

## Environment Variables (`.env.example`)

| Variable | Required | Purpose |
| --- | --- | --- |
| `SESSION_SECRET` | Recommended | Signs `HttpOnly` session cookies (`cc_session`). |
| `SEED_SUPERADMIN_EMAIL` / `SEED_SUPERADMIN_PASSWORD` | Optional | Auto-seeds first Super Admin on empty database. |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | Optional | Auto-seeds an initial Admin account on boot. |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Optional | Enables Razorpay checkout (otherwise Manual UPI/Cash/Bank billing workflow is active). |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Optional | Outbound SMTP email delivery (verification/reset links appear inline in UI response when unconfigured). |
| `WHATSAPP_API_TOKEN` | Optional | External WhatsApp Business notifications (inactive until configured). |

---

## End-to-End Business Workflow

1. **Service Discovery & Category Directory:** Visitors browse 16+ service categories (including Sales & Business Development) and INR service packages on the public marketplace, inspect full deliverables/timelines in the Service Details Modal, and jump straight into booking.
2. **Consultant Onboarding:** Students register as consultants, configure academic credentials, skills, portfolio, and weekly availability, and enter the Admin Verification Queue.
3. **Booking, Document Upload & Quotation:** Verified Customers submit a booking with Project Title, Budget (INR), Delivery Date, Auto-Assign or preferred Consultant choice, and optional supporting documents (`Pending` → optional Admin Quotation → Customer Accept/Decline → Admin assigns verified Consultant).
4. **Atomic Project Provisioning:** Assigning a consultant automatically creates the active `project`, starter `milestones`, pending `transaction`, and numbered GST/service `invoice` (`CCD-YYYY-XXXX`).
5. **Delivery & Billing:** Consultants manage tasks, milestone statuses, and file deliverables; Customers monitor progress, chat in real time, approve deliverables, and record/settle payments via Admin.
6. **Verified Reviews Only:** Customers can submit ratings/reviews exclusively on `Completed` projects.
7. **Financial Ledger, Retainers & BI Analytics:** Admins and Super Admins record payments, manage recurring monthly retainer subscriptions, release consultant payouts (`100% - platform_commission_pct`), log operating expenses, explore date-range filtered BI revenue/category/booking trend charts, and export real CSV financial reports.

---

## Deployment Notes

- Designed for Node.js 22+ stateful hosting (e.g., Cloud Run, Railway, Render, Fly.io, or a VPS with persistent volume mounted at `/data` and `/storage`).
- Serverless-only static hosts without persistent disk (such as default Vercel static builds) do not persist SQLite files across invocations unless connected to an external hosted database.
