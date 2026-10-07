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
| 4 | Expense tracker (built: `tools/expenses/`, amount, category, paid by, paid to, note; staff see and fix only their own entries on the day; month by category, CSV; anyone entering can add a category; a bill can cover a period (e.g. 2 months) and is spread over it; owner sees the daily running cost by category; which bank account paid; owner's bank check matches each bank-paid expense to money out of that account, same amount, up to 3 days later) | — | spend this month by category, daily running cost |
| 5 | Banking entry log (built: `tools/banking/`, owner keeps the accounts with opening balances; money in, money out and transfers between accounts; staff see their own entries; owner gets monthly statements with running balance, CSV, balances) | — | deposits and withdrawals, balance per account |
| 6 | CRM (built: `tools/crm/`, app name Customers: details, tags, call and WhatsApp, notes and follow-ups with outcomes, birthdays and anniversaries with WhatsApp wishes; "Enter a form" page matching the paper customer information form, visits with what they came for, bought or just looking, rating and what we didn't have; WhatsApp permission; owner insights) | customers | follow-ups due, birthdays and anniversaries |
| 7 | Design library (built: `tools/designs/`, the list of jewels to buy: what customers asked for and what the shop needs to restock, each with photos, type, purity, weight, size, how many, budget, needed-by date and supplier; Needed → Ordered → Arrived → Done or Dropped; whoever took an enquiry is notified and reminded on the home page when it arrives, with a WhatsApp message to the customer; send the photo or a buying list to a supplier without customer details; links to the customer in Customers) | customers, rates | needed, ordered, arrived, late |
| 8 | Stock to be purchased (covered by the design library: restock items) | — | — |
| 9 | Chit scheme (built: `tools/chits/`, owner sets up plans: fixed or any amount a month, saved as money or as 22K grams at the day's rate, number of months, bonus of one instalment or a percentage, other benefit; members with card numbers, linked to saved customers; payments with receipt numbers and WhatsApp receipts; staff fix their own payment on the day; progress bar of months paid and behind; Due tab with WhatsApp reminders and who is ready to redeem; redeem, cancel with a note; owner Insights: which plan customers choose (running, joined in 6 months, up to date, redeemed, cancelled, collected) and new members each month by plan; bank check: chit payments by UPI, card, transfer or cheque against bank money-in marked as chit money, day by day with a running difference) | customers, rates, banking | collected this month, running per plan, behind, ready to redeem, bank check |
| 10 | Silver sales & purchase (built: `tools/silver/`, sales: item, pieces, weight × rate per gram (today's silver rate filled in) + making + 3% GST, worked out on the screen and again in the database; purchases: old silver from customers or stock from suppliers, weight × touch % = fine weight × rate per fine gram; customer link, how paid and which bank account; day book with cash from silver in and out; staff fix their own entries on the day; owner's month: grams and value sold and bought, average rates, making and GST, by item, by payment and bank account, day by day, CSV) | customers, rates, banking | grams sold and bought this month and today, value |
| 11 | Staff report card | staff, attendance, to-do | score per person over time |

## Notes

- Attendance categories: Present, Home, Thottam, Half day (½), and under one
  Leave button: Absent, Leave applied, Week off. Days worked = Present + Home +
  Thottam + ½ × Half day.
- Notifications: a bell and a bar at the top of every page. Database triggers write them
  (`notifications` table); pages check every minute and when reopened. Tasks: managers hear about
  every finished task; the owner hears when a person's last open task is done.
- Dashboard: modules (attendance today, rate, who is online, expenses, bank, customers, tasks, design library, chit scheme, silver, days worked) that the
  owner can move, size (half or full width) and hide with Customise; the layout is saved per person in
  `user_prefs`, so it follows them to every device. Only the modules showing are loaded.
- Staff are added by the owner in People & settings (no staff are pre-loaded).
