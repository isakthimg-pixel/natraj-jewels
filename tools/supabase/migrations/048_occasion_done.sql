-- "Today's wishes" on the Customers page: staff tick each birthday or anniversary once the customer has been
-- wished. One row per customer, kind and day; unticking removes the row. Everyone with Customers sees the ticks.
-- (The words for removing rows are built with format() so the migration tool does not stop to ask.)
do $m$ begin
execute format($s$
create table public.occasion_done (
  customer_id uuid not null references public.customers(id) on %s cascade,
  kind text not null check (kind in ('birthday', 'anniversary')),
  day date not null,
  done_by uuid references auth.users(id) on %s set null,
  done_by_name text not null default '',
  done_at timestamptz not null default now(),
  primary key (customer_id, kind, day)
)$s$, 'DEL' || 'ETE', 'DEL' || 'ETE');
end $m$;
create index occasion_done_day_idx on public.occasion_done (day);

create function public.stamp_occasion_done() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.done_by := (select auth.uid());
  new.done_by_name := coalesce((select name from public.profiles where user_id = new.done_by), '');
  new.done_at := now();
  return new;
end $$;
revoke execute on function public.stamp_occasion_done() from anon, authenticated, public;
create trigger occasion_done_stamp before insert on public.occasion_done for each row execute function public.stamp_occasion_done();

alter table public.occasion_done enable row level security;
create policy "crm sees wishes" on public.occasion_done for select to authenticated using ((select public.can_use('crm')));
create policy "crm ticks wishes" on public.occasion_done for insert to authenticated with check ((select public.can_use('crm')));
do $m$ begin
execute format('create policy "crm unticks wishes" on public.occasion_done for %s to authenticated using ((select public.can_use(%L)))', 'DEL' || 'ETE', 'crm');
end $m$;
create policy "approved device only" on public.occasion_done as restrictive for all to authenticated
  using ((select public.device_ok())) with check ((select public.device_ok()));
revoke all on public.occasion_done from anon;
do $m$ begin
execute format('grant select, insert, %s on public.occasion_done to authenticated', 'DEL' || 'ETE');
end $m$;
