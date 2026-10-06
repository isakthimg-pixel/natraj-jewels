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
  `APPS` in `tools/shared/natraj.js` and in the `people` function, add its tables to
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
| 4 | Expense tracker (built: `tools/expenses/`, amount, category, paid by, paid to, note; staff see and fix only their own entries on the day; month by category, CSV; owner edits the category list) | — | spend this month by category |
| 5 | Banking entry log | — | deposits and withdrawals, balance per account |
| 6 | CRM (customers, follow-ups) | customers | follow-ups due, birthdays and anniversaries |
| 7 | Design library, gold and silver (photos, design code, type, weight, purity, supplier or karigar, tags; search, filter, share on WhatsApp) | stock, customers (designs a customer liked) | designs added this month, most requested |
| 8 | Stock to be purchased | customers (customer orders), designs, rates | items needed, ordered, received |
| 9 | Chit scheme entries | customers | collected this month, dues, schemes ending soon |
| 10 | Silver sales & purchase | customers, rates | grams sold and bought, value |
| 11 | Staff report card | staff, attendance, to-do | score per person over time |

## Notes

- Attendance categories: Present, Home, Thottam, Half day (½), and under one
  Leave button: Absent, Leave applied, Week off. Days worked = Present + Home +
  Thottam + ½ × Half day.
- Staff are added by the owner in People & settings (no staff are pre-loaded).
