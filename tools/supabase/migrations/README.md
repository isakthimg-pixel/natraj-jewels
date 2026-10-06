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
