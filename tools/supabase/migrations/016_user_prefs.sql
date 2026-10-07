-- Per-person settings that should follow them to every device, starting with the owner's
-- dashboard layout: which modules show, in what order, and whether each is half or full width.
create table public.user_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  dashboard jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.user_prefs enable row level security;
create policy "see own prefs" on public.user_prefs for select to authenticated using (user_id = (select auth.uid()));
create policy "add own prefs" on public.user_prefs for insert to authenticated with check (user_id = (select auth.uid()));
create policy "change own prefs" on public.user_prefs for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.user_prefs from anon;
