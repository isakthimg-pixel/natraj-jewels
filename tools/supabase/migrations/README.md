# Database changes

These files record the SQL applied to the Supabase project `natraj-tools`
(ref `uottxgpjgakinqprexsp`, Mumbai region), in order. They are kept here so
the database can be rebuilt or reviewed.

- `001_foundation.sql` — staff, profiles (people who can sign in), settings,
  access helpers, sign-in screen helpers. Applied.
- `002_attendance.sql` — attendance and leave tables and their access rules. Applied.
- `003_leave_requests.sql` — public leave form functions. Applied.
- `004_decide_leave.sql` — approve, decline or cancel leave. Run this one in the
  Supabase SQL editor (Supabase asks for confirmation because it clears
  attendance days when approved leave is cancelled).
- `005_foreign_key_indexes.sql` — two indexes suggested by the Supabase advisor. Applied.

The Supabase security advisor lists the four functions that work without
signing in (`login_names`, `setup_needed`, `leave_staff`, `request_leave`).
That is intended: they power the sign-in screen and the public leave form.
- `006_rates.sql` — gold & silver rate app. Applied.
- `007_rate_assignee.sql` — rate due-by time (and a single assigned person, replaced by 008). Applied.
- `009_tasks.sql` — to-do list: tasks, who can see and change them. Applied.
- `010_expenses.sql` — expense tracker: expenses, category list in settings, who can see and change entries. Applied.
- `011_expense_periods.sql` — the days an expense covers (for the daily running cost), and `add_expense_category`. Applied.
- `012_notifications.sql` — notifications (bell and bar at the top of every page); a task ticked done notifies managers and the person who gave it, and the owner when someone's last open task is done. Applied.
- `013_banking.sql` — bank accounts, bank entries (transfers share a `transfer_id`), `bank_balances(date)`. Applied.
- `014_crm.sql` — customers (shared list for later apps), customer notes and follow-ups, `crm_people()`. Applied.
- `015_crm_form.sql` — customer form fields (pincode, WhatsApp, family function) and form visits in the history. Applied.
- `016_user_prefs.sql` — each person's own settings (the owner's dashboard layout). Applied.
- `017_designs.sql` — design library: designs table and the private `designs` photo bucket (2 MB images; the app sees and adds, only the owner deletes). Applied.
- `018_designs_requests.sql` — the design library becomes a list of jewels to buy: customer enquiries and restock items, Needed → Ordered → Arrived → Done; the person who took an enquiry is notified when it arrives. Applied.
- `018a_comment_user_prefs.sql` — a description on the settings table. Applied.
- `019_chits.sql` — chit scheme: plans (owner), members with card numbers, payments with receipt numbers; staff fix their own payment on the day. Applied.
- `020_bank_chit_flag.sql` — bank money-in entries can be marked as chit money, so the owner can check chit payments (not cash) against the bank. Applied.
- `021_presence.sql` — who is online: each open page checks in once a minute (`heartbeat`), signing out calls `presence_out`; the owner sees everyone. Applied.
- `022_expense_account.sql` — which bank account an expense was paid from (not for cash); `bank_account_choices()` lists the accounts to people who enter expenses. Applied.
- `023_silver.sql` — silver sales and purchases; fine weight and amount worked out in the database; staff fix their own entries on the day; bank account for non-cash. Applied.
- `024_report_cards.sql` — staff report cards: one per staff member per month; the owner rates and shares; staff see only their own shared cards. Applied.
- `025_campaigns.sql` — marketing campaigns, their contact lists (sent, came, bought) and costs. Applied.
- `026_device_lock.sql` — staff only on approved devices: the owner approves the shop computer and switches the lock on; owners are never limited. Applied.
- `027_two_step.sql` — two-step sign-in: someone who has set up an authenticator app gets nothing from the database until they type its code. Applied.
- `028_expense_gst.sql` — GST claimable on expenses: rate, supplier GSTIN, bill number; GST worked out from the bill total; the owner marks it claimed. Applied.
- `029_change_requests.sql` — staff add, change and remove entries dated today or yesterday only (Expenses, Banking, Silver, Chit payments); older days go to the owner as change requests to approve. Applied.
- `030_device_site.sql` — records the web address each device was approved at, so the blocked screen can say which address to use. Applied.
- `031_silver_final_amount.sql` — silver sales keep the final amount typed (rate per gram worked out from it); a shared silver item list anyone with the app can add to. Applied.
- `032_silver_purchase_final_amount.sql` — silver purchases keep the final amount typed too (rate per fine gram worked out from it). Applied.
- `033_jobs.sql` — Repairs & orders: jobs with repair slip number, service, customer, item, weight, photos, promised date, advance, karigar and what they were paid, amount collected, free repairs (bought within 15 days / owner’s friend); stages Received → With karigar → Ready → Delivered; photo bucket "jobs". Applied (as 033, 033a, 033b, 033c).
- `034_entry_queries.sql` — queries on entries: the owner asks about an expense (and later bank, silver or chit entries); the staff member who made it is notified and explains; the owner replies or closes it. Table `entry_queries` (read only through row rules), functions `ask_query`, `reply_query`, `close_query`. Applied.
- `008_rate_updaters_many.sql` — any number of people can update the daily rate (everyone with the `rates` app). Applied.
