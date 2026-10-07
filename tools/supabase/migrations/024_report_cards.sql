-- Staff report card: one card per staff member per month. The owner rates the month, writes remarks
-- and a target, and can share the card; sharing stores a copy of the month's figures (metrics), so
-- the staff member sees exactly what the owner saw without needing access to the other apps.
-- The owner sees and changes every card; a staff member sees only their own shared cards.
create table public.report_cards (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  ratings jsonb not null default '{}'::jsonb,
  remarks text not null default '' check (length(remarks) <= 1000),
  target text not null default '' check (length(target) <= 500),
  metrics jsonb not null default '{}'::jsonb,
  score numeric(5,1) check (score is null or (score >= 0 and score <= 100)),
  grade text not null default '' check (length(grade) <= 3),
  shared boolean not null default false,
  shared_at timestamptz,
  updated_by_name text not null default '',
  updated_at timestamptz not null default now(),
  unique (staff_id, month)
);
create index report_cards_month_idx on public.report_cards (month);

create function public.stamp_report_card() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.updated_by_name := coalesce((select name from public.profiles where user_id = (select auth.uid())), '');
  new.updated_at := now();
  if new.shared and (tg_op = 'INSERT' or not old.shared or new.metrics is distinct from old.metrics) then new.shared_at := now(); end if;
  if not new.shared then new.shared_at := null; end if;
  return new;
end $$;
create trigger report_cards_stamp before insert or update on public.report_cards for each row execute function public.stamp_report_card();
revoke execute on function public.stamp_report_card() from anon, authenticated, public;

alter table public.report_cards enable row level security;
create policy "owner sees all, staff their own shared cards" on public.report_cards for select to authenticated
  using ((select public.is_owner()) or (shared and staff_id = (select p.staff_id from public.profiles p where p.user_id = (select auth.uid()))));
create policy "owner adds cards" on public.report_cards for insert to authenticated with check ((select public.is_owner()));
create policy "owner changes cards" on public.report_cards for update to authenticated using ((select public.is_owner())) with check ((select public.is_owner()));
create policy "owner removes cards" on public.report_cards for delete to authenticated using ((select public.is_owner()));
revoke all on public.report_cards from anon;
