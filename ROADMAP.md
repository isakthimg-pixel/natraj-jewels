# Natraj Jewels tools: plan

Small apps for running the shop, sharing one online database and one sign-in,
with a dashboard that only the owner can see. Every app uses the website's
design (see `natraj-jewels-website/index.html`; first built in `staff-attendance/`).

## Setup

- **Database and sign-in:** Supabase (free plan), project `natraj-tools`, Mumbai region.
- **Hosting:** Cloudflare Workers static assets (free; page visits are not charged), project
  `natrajtools`, live at https://natrajtools.isakthimg.workers.dev. Update by uploading the
  `tools/` folder (without `supabase/` and `demo/`) as a new deployment in Cloudflare.
- **Supabase project:** `natraj-tools`, ref `uottxgpjgakinqprexsp`. Database changes are in
  `tools/supabase/migrations/`, the sign-in server code in `tools/supabase/functions/people/`.
- **Adding an app:** add its tables and access rules (use `can_use('<app>')`), add it to
  `APPS` (and an icon to `ICONS`) in `tools/shared/natraj.js` and in the `people` function, add its tables to
  `TABLES` (backup), and give it a section on the dashboard.
- **Sign-in:** each person uses their name and PIN. The owner switches on which
  apps each person can use. Only the owner sees the dashboard.
- **Shared lists:** `staff` (attendance, to-do, report card, leave) and
  `customers` (CRM, chit scheme, silver sales, stock orders).
- **Photos (design library):** Supabase Storage; photos are shrunk on the
  phone before upload (about 200 KB each), so the free 1 GB holds roughly
  5,000 designs.
- **Backups:** the free plan has no daily backups, so the dashboard gets an
  owner-only "Export everything" button.

## Apps, in build order

| # | App | Shares with | Feeds the dashboard |
|---|-----|-------------|---------------------|
| 1 | Foundation + Attendance & Leave (built in `tools/`: online database, sign-in, home, people & settings, dashboard) | staff | who is in today, leave waiting, days worked |
| 2 | Gold & silver rate (built: `tools/rates/`, rupees per gram for 22K, 24K, 18K and silver; WhatsApp message; history charts) | silver sales, stock | today's rate, trend |
| 3 | To-do list (built: `tools/todo/`, give tasks to anyone who signs in, due dates, high priority, tick done with a note) | staff | open and overdue tasks per person |
| 4 | Expense tracker (built: `tools/expenses/`, amount, category, paid by, paid to, note; staff see and fix only their own entries on the day; month by category, CSV; anyone entering can add a category; a bill can cover a period (e.g. 2 months) and is spread over it; owner sees the daily running cost by category) | — | spend this month by category, daily running cost |
| 5 | Banking entry log (built: `tools/banking/`, owner keeps the accounts with opening balances; money in, money out and transfers between accounts; staff see their own entries; owner gets monthly statements with running balance, CSV, balances) | — | deposits and withdrawals, balance per account |
| 6 | CRM (built: `tools/crm/`, app name Customers: details, tags, call and WhatsApp, notes and follow-ups with outcomes, birthdays and anniversaries with WhatsApp wishes; "Enter a form" page matching the paper customer information form, visits with what they came for, bought or just looking, rating and what we didn't have; WhatsApp permission; owner insights) | customers | follow-ups due, birthdays and anniversaries |
| 7 | Design library, gold and silver (built: `tools/designs/`, up to 8 photos each, shrunk on the phone and kept in a private bucket; auto design code like G-NEC-0012; type, purity, weight, wastage, supplier or karigar, tags, in the shop / can order / sold; search and filter by metal, type, status and weight; share the photo on WhatsApp without supplier or wastage; only the owner deletes) | stock, customers (designs a customer liked) | gold and silver in the shop, added and sold this month, newest photos |
| 8 | Stock to be purchased | customers (customer orders), designs, rates | items needed, ordered, received |
| 9 | Chit scheme entries | customers | collected this month, dues, schemes ending soon |
| 10 | Silver sales & purchase | customers, rates | grams sold and bought, value |
| 11 | Staff report card | staff, attendance, to-do | score per person over time |

## Notes

- Attendance categories: Present, Home, Thottam, Half day (½), and under one
  Leave button: Absent, Leave applied, Week off. Days worked = Present + Home +
  Thottam + ½ × Half day.
- Notifications: a bell and a bar at the top of every page. Database triggers write them
  (`notifications` table); pages check every minute and when reopened. Tasks: managers hear about
  every finished task; the owner hears when a person's last open task is done.
- Dashboard: modules (attendance today, rate, expenses, bank, customers, tasks, design library, days worked) that the
  owner can move, size (half or full width) and hide with Customise; the layout is saved per person in
  `user_prefs`, so it follows them to every device. Only the modules showing are loaded.
- Staff are added by the owner in People & settings (no staff are pre-loaded).
