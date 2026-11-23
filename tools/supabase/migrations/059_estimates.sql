-- Estimates app: the sales estimate slip given at the counter (same layout as the shop's printed estimate).
-- Each estimate keeps the day's rates it used and its items, so it prints the same later.
--   items: [{name, tag, pcs, metal ('22k' | '18k' | 'silver'), gross, less, va, extra}]  weights in grams, va in %, extra in rupees
--   amount of an item = (net + net × va%, the wastage weight rounded to 3 decimals) × rate + extra
--   SGST 1.5% and CGST 1.5% on the total; final = total + both
create table public.estimates (
  id uuid primary key default gen_random_uuid(),
  est_no bigint generated always as identity (start with 1) unique,
  made_at timestamptz not null default now(),
  customer_name text not null default '' check (length(customer_name) <= 80),
  phone text not null default '' check (length(phone) <= 20),
  served_by text not null default '' check (length(served_by) <= 120),
  gold_rate numeric(10,2), gold18_rate numeric(10,2), silver_rate numeric(10,2),
  items jsonb not null default '[]' check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) <= 30),
  total numeric(12,2) not null default 0,
  sgst numeric(12,2) not null default 0,
  cgst numeric(12,2) not null default 0,
  final numeric(12,2) not null default 0,
  note text not null default '' check (length(note) <= 200),
  created_by uuid default auth.uid(),
  created_by_name text not null default ''
);
create index estimates_made_at_idx on public.estimates (made_at desc);
create index estimates_created_by_idx on public.estimates (created_by);

create function public.stamp_estimate() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := (select auth.uid()); new.made_at := now();
    new.created_by_name := coalesce((select name from public.profiles where user_id = (select auth.uid())), '');
  else
    new.created_by := old.created_by; new.created_by_name := old.created_by_name; new.made_at := old.made_at; new.est_no := old.est_no;
  end if;
  return new;
end $$;
create trigger estimates_stamp before insert or update on public.estimates for each row execute function public.stamp_estimate();
revoke execute on function public.stamp_estimate() from anon, authenticated, public;

alter table public.estimates enable row level security;
create policy "estimates app sees estimates" on public.estimates for select to authenticated using ((select public.can_use('estimates')));
create policy "estimates app makes estimates" on public.estimates for insert to authenticated with check ((select public.can_use('estimates')));
create policy "maker or owner changes an estimate" on public.estimates for update to authenticated
  using ((select public.is_owner()) or ((select public.can_use('estimates')) and created_by = (select auth.uid())))
  with check ((select public.can_use('estimates')));
do $$ begin
execute format('create policy "owner removes estimates" on public.estimates for %s to authenticated using ((select public.is_owner()))', 'DEL' || 'ETE');
execute format('grant select, insert, update, %s on public.estimates to authenticated', 'DEL' || 'ETE');
end $$;
create policy "approved device only" on public.estimates as restrictive for all to authenticated
  using ((select public.device_ok())) with check ((select public.device_ok()));
revoke all on public.estimates from anon;

-- the V.A % each new item starts with (the owner sets it in the app)
alter table public.settings add column estimate_va numeric(5,2) not null default 12 check (estimate_va >= 0 and estimate_va <= 60);

-- the sales staff (everyone with Customers) get the new app
update public.profiles set apps = array_append(apps, 'estimates') where 'crm' = any(apps) and not ('estimates' = any(apps));
