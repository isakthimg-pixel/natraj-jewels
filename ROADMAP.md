# Natraj Jewels tools: plan

Small apps for running the shop, sharing one online database and one sign-in,
with a dashboard that only the owner can see. Every app uses the website's
design (see `natraj-jewels-website/index.html`; first built in `staff-attendance/`).

## Setup

- **Database and sign-in:** Supabase (free plan), project `natraj-tools`, Mumbai region.
- **Hosting:** one Netlify site, e.g. `natraj-tools.netlify.app/<app>`, with the
  dashboard at the root.
- **Sign-in:** each person uses their name and PIN. The owner switches on which
  apps each person can use. Only the owner sees the dashboard.
- **Shared lists:** `staff` (attendance, to-do, report card, leave) and
  `customers` (CRM, chit scheme, silver sales, stock orders).
- **Backups:** the free plan has no daily backups, so the dashboard gets an
  owner-only "Export everything" button.

## Apps, in build order

| # | App | Shares with | Feeds the dashboard |
|---|-----|-------------|---------------------|
| 1 | Foundation + Attendance & Leave (built, works on one device for now) | staff | who is in today, leave waiting, days worked |
| 2 | Gold & silver rate | silver sales, stock | today's rate, trend |
| 3 | To-do list (assign to a person) | staff | open and overdue tasks per person |
| 4 | Expense tracker | — | spend this month by category |
| 5 | Banking entry log | — | deposits and withdrawals, balance per account |
| 6 | CRM (customers, follow-ups) | customers | follow-ups due, birthdays and anniversaries |
| 7 | Stock to be purchased | customers (customer orders), rates | items needed, ordered, received |
| 8 | Chit scheme entries | customers | collected this month, dues, schemes ending soon |
| 9 | Silver sales & purchase | customers, rates | grams sold and bought, value |
| 10 | Staff report card | staff, attendance, to-do | score per person over time |

## Notes

- Attendance categories: Present, Home, Thottam, Half day (½), and under one
  Leave button: Absent, Leave applied, Week off. Days worked = Present + Home +
  Thottam + ½ × Half day.
- Starting staff: Senthil Kumar (Store Manager), Ponraj, Narasimman, Anand.
