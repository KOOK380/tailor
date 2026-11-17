# Tailor Management — Software Details & Features

**Product:** Tailor Management — Production & Smart Notification System
**Type:** Multi-tenant SaaS web application
**Purpose:** End-to-end management of a tailoring shop / boutique / custom garment
business — customer orders, garment production tracking, smart deadline alerts,
UAE/GCC-compliant billing, and business analytics.

---

## 1. Technology Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS, shadcn/ui, Lucide icons, Recharts |
| Backend | Next.js server actions & API routes |
| Database | PostgreSQL via Drizzle ORM — dual mode: local embedded Postgres (PGlite, zero setup) or hosted (Supabase / any Postgres via `DATABASE_URL`) |
| Auth | Email + password (scrypt hashing), signed HTTP-only session cookies |
| Realtime | Server-Sent Events + polling fallback |
| Notifications | Server-side scheduler (Vercel Cron / local daemon), Web Push (VAPID + service worker), optional email (Resend API or SMTP) |
| Invoice PDF | pdf-lib with embedded Noto Sans Arabic + Unicode-bidi-correct Arabic text engine |
| Tests | Vitest unit tests (34), TypeScript checks, production build verification |

---

## 2. Modules & Features

### 2.1 Order Management
- Auto-generated unique order IDs (`ORD-1025` style)
- Customer with mobile lookup, alternate contact, address, TRN
- **Multi-garment orders** — each garment tracked independently
- Per garment: category, type, quantity, fabric, color, measurements (free-form), design instructions, notes, unit price
- Optional stage skipping per garment (e.g. no embroidery)
- **Priority levels:** Normal · High · Urgent · Critical (affects sorting & alerts)
- **Statuses:** New · In Production · On Hold · Finished · Ready for Delivery · Delivered · Cancelled
- Delivery date + delivery time, order date, activity history

### 2.2 Production Workflow (8 stages)
`Bill/Order Created → Cutting → Designing → Embroidery → Stone/Crystals → Hand Work → Stitching → Finished`
- Each stage: status (Not Started / In Progress / On Hold / Completed / Skipped), assigned employee, planned start/completion dates, actual start/completion timestamps, estimated duration, notes, activity history
- Progress % computed over applicable stages (skipped stages excluded)
- Horizontal visual progress tracker per garment; order progress = average across garments
- Auto status transitions (production started / finished / ready for delivery)
- Stage completion notifies the next stage's employee automatically
- Reassignment support (new employee notified, history preserved)

### 2.3 Smart Deadline & Days-Left System
- **Timezone-aware calendar countdown** (business timezone, e.g. Asia/Dubai) — flips exactly at local midnight
- Configurable indicator bands: green (on schedule) · blue (7 days) · yellow (5–6) · orange (3–4) · red (2 / 1 / due today) · dark red (overdue)
- Badges like `12 Days Left`, `Only 1 Day Left!`, `Due Today`, `Overdue by 4 Days`
- Admin-customizable thresholds & reminder days

### 2.4 Automatic Notification Engine (core module)
**Scheduled (runs even when nobody is logged in):**
- Deadline reminders at 7 / 5 / 3 / 2 / 1 / 0 days before delivery (exact spec message formats)
- **Overdue:** one alert per calendar day until delivered / cancelled / rescheduled
- **Production-delay detection:** stage not started by plan · exceeded planned duration · long On-Hold · employee overload · order approaching delivery with many incomplete stages
- **Daily production summary** at a configurable time (default 09:00 business TZ)

**Event-driven (instant):**
- Task assigned / reassigned · stage ready to start · stage completed (next employee notified) · ready-for-delivery · delivery-date changes reschedule future reminders (history preserved)

**Reliability:**
- Idempotent via unique event keys — re-running a sweep never duplicates alerts
- Delivery attempts logged (sent / failed / skipped)
- Delivered & cancelled orders stop generating deadline alerts

**Channels:**
- **In-app** — stacked toast popups (max 3 + queue), critical-alert modal with non-destructive acknowledge, notification bell with unread badge, tabbed panel (All / Unread / Urgent / Production / Deadline / Overdue) with pagination, snooze, dismiss ≠ read
- **Browser Push** — Web Push + service worker, per-device subscriptions, expired-subscription cleanup
- **Email (optional)** — daily summary & critical alerts (company rule) + per-user opt-in per category; Resend or SMTP configured in Settings with a one-click test send
- Persists across refresh & relogin; popup dedup across browser tabs

### 2.5 Production Kanban Board
- 8 columns (one per stage), order cards with customer, garment, employee, days-left, priority, progress
- Drag-and-drop moves with workflow validation (managers/admins only; mandatory stages cannot be skipped)
- Every move saved with activity log

### 2.6 Customer Management
- Profiles with mobile lookup, alternate contacts, address, TRN, special instructions
- **Measurement history** (per garment type, free-form values, versioned)
- Order / garment / delivery / billing history per customer
- Pending balances and payment records

### 2.7 Employees & Role-Based Access
- **Roles:** Super Admin · Manager · Production Staff · Billing Staff (permission matrix)
- Production categories per employee: Cutting · Designing · Embroidery · Stone/Crystals · Hand Work · Stitching (multi-category allowed)
- Personal employee dashboards: assigned tasks, pending stages, deadlines, completed work

### 2.8 Billing — UAE/GCC Standard Tax Invoice
- **Standard accounting design**: ruled header, numbered line items, right-aligned totals block with double-ruled grand total
- **Bilingual English + Arabic** on every label (correct RTL Arabic in the PDF)
- **Logo + TRN** (supplier) + **Customer TRN**
- **VAT block:** Total (excl. VAT) → VAT (rate) → Total (incl. VAT) → Amount Paid → Balance Due
- Auto invoice numbering (INV-####), configurable tax label & rate (VAT/GST/anything — never hardcoded)
- Discounts (percent/flat), additional charges, advance payments, multiple payment records (cash/UPI/card/bank/cheque)
- **Currency:** AED, INR, USD, EUR, GBP + 15 more (locale-aware formatting)
- Printable invoice + PDF download (bidi-correct Arabic text)
- Payment-due reminders (separate from delivery alerts)

### 2.9 Delivery Calendar
- Month grid colored by urgency (on schedule → overdue), today highlight
- Click-through to orders; full scheduled-deliveries list with days-left badges

### 2.10 Reports & Analytics
- Total / completed / pending / overdue orders, on-time vs delayed delivery %
- Average production time, stage-wise processing time, employee task completion
- Monthly revenue, outstanding balances
- Date-range filtering + CSV export

### 2.11 Dashboard
- 15 live summary cards (per stage, urgent, overdue, payments…) with colored icon chips
- **Delivery Deadline Center** — orders grouped: Overdue · Due Today · Due Tomorrow · 2–3 Days · 4–7 Days · Later
- Stage distribution chart, employee workload chart, monthly payments
- Delayed-production list, recently completed orders

### 2.12 Settings
- Business profile: name, **timezone dropdown** (44 zones), **currency selector** (20), **TRN**, phone/email/address
- **Logo upload** (PNG/JPG/WEBP/SVG) shown on invoices
- Tax label & rate, deadline thresholds, reminder days, daily summary time
- **Email Setup (Resend / SMTP)** with save + **Send Test Email**
- Notification rules: overdue alerts, delay warnings, hold-alert days
- Per-user notification preferences: 4 categories × In-app / Push / Email

### 2.13 Platform
- **Multi-tenant** — every business has isolated customers, orders, employees, settings, notifications (RLS policies included)
- **Security** — scrypt password hashing, signed sessions, role permission checks on every action, Zod input validation, server-side authorization
- **Responsive** — works on desktop, tablet and mobile (collapsible sidebar)

---

## 3. Running the Software

```bash
npm install
npm run db:setup        # database + demo data
npm run dev             # http://localhost:3000  (development)
# or for normal use (no hot-reload churn):
npm run build && npm run start
npm run scheduler       # optional: auto deadline alerts while running
```

**Demo logins** (password `Demo@1234`):

| Email | Role |
|---|---|
| admin@royaltailors.in | Super Admin |
| manager@royaltailors.in | Manager |
| billing@royaltailors.in | Billing Staff |
| rahul@royaltailors.in | Production Staff |

Demo business: **Royal Tailors** (Dubai) — AED, VAT 5%, TRN on invoices, sample
logo, 10 sample orders spanning every deadline band (3 days overdue … 12 days
left), sample invoice INV-9999.

## 4. Deployment

- **Vercel** (web app + hourly cron in `vercel.json`) + **Supabase** (Postgres,
  RLS policies in migrations) — or any Postgres via `DATABASE_URL`
- Environment variables documented in `.env.example` (auth secret, cron secret,
  VAPID push keys, email provider)
- Full deployment & Supabase swap guide in `README.md`
