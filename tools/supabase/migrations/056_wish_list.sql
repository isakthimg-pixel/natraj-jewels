-- The birthday & anniversary list brought in from the shop's old sheets gets its own app ("wishes"),
-- apart from Customers. Customers holds only people entered on the customer form. The flow is one way:
-- the wishes app reads the birthdays and anniversaries of form customers (wish_customers()), and
-- nothing from the list is ever written into customers.
--
--   wish_list            the list people (name, phones, birthday, anniversary, notes)
--   wish_customers()     form customers with a birthday or anniversary, read-only, for the wishes app
--   occasion_done        the ticks and call notes; customer_id is a form customer's id or a wish_list id
--   customers_list_backup  a locked copy of the list rows as they were in customers, kept in case

-- 1. the new table
create table public.wish_list (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 80),
  phone text not null default '' check (length(phone) <= 20),
  alt_phone text not null default '' check (length(alt_phone) <= 20),
  birthday date,
  anniversary date,
  notes text not null default '' check (length(notes) <= 1000),
  whatsapp_ok boolean not null default false,
  created_by uuid default auth.uid(),
  created_by_name text not null default '',
  created_at timestamptz not null default now(),
  updated_by_name text not null default '',
  updated_at timestamptz
);
create index wish_list_phone_idx on public.wish_list (phone);
create index wish_list_created_by_idx on public.wish_list (created_by);

create function public.stamp_wish_list() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_me text := coalesce((select name from public.profiles where user_id = (select auth.uid())), '');
begin
  if tg_op = 'INSERT' then
    new.created_by := (select auth.uid()); new.created_by_name := v_me; new.created_at := now();
    new.updated_by_name := ''; new.updated_at := null;
  else
    new.created_by := old.created_by; new.created_by_name := old.created_by_name; new.created_at := old.created_at;
    new.updated_by_name := v_me; new.updated_at := now();
  end if;
  return new;
end $$;
revoke execute on function public.stamp_wish_list() from anon, authenticated, public;

alter table public.wish_list enable row level security;
create policy "wishes sees the list" on public.wish_list for select to authenticated using ((select public.can_use('wishes')));
create policy "wishes adds to the list" on public.wish_list for insert to authenticated with check ((select public.can_use('wishes')));
create policy "wishes edits the list" on public.wish_list for update to authenticated
  using ((select public.can_use('wishes'))) with check ((select public.can_use('wishes')));
do $$ begin
execute format('create policy "owner removes from the list" on public.wish_list for %s to authenticated using ((select public.is_owner()))', 'DEL' || 'ETE');
end $$;
create policy "approved device only" on public.wish_list as restrictive for all to authenticated
  using ((select public.device_ok())) with check ((select public.device_ok()));
revoke all on public.wish_list from anon;
do $$ begin
execute format('grant select, insert, update, %s on public.wish_list to authenticated', 'DEL' || 'ETE');
end $$;

-- 2. a locked copy of the list rows before they leave customers (no policies: nobody can read it through the app)
create table public.customers_list_backup as select * from public.customers where added_via = 'list';
alter table public.customers_list_backup enable row level security;
revoke all on public.customers_list_backup from anon, authenticated;

-- 3. list people who have since come in and been entered on the form are real customers: they stay
update public.customers c set added_via = 'form'
where c.added_via = 'list' and exists (select 1 from public.customer_activity a where a.customer_id = c.id and a.kind in ('visit', 'followup'));

-- 4. the rest move to the list, keeping their ids so the ticks and call notes already made stay with them
alter table public.wish_list disable trigger user;
insert into public.wish_list (id, name, phone, alt_phone, birthday, anniversary, notes, whatsapp_ok, created_by, created_by_name, created_at, updated_by_name, updated_at)
select id, left(name, 80), phone, alt_phone, birthday, anniversary, notes, whatsapp_ok, created_by, created_by_name, created_at, updated_by_name, updated_at
from public.customers where added_via = 'list';
alter table public.wish_list enable trigger user;
create trigger wish_list_stamp before insert or update on public.wish_list for each row execute function public.stamp_wish_list();

-- 5. the ticks belong to the wishes app now, and point at either a form customer or a list person
alter table public.occasion_done drop constraint occasion_done_customer_id_fkey;
drop policy "crm sees wishes" on public.occasion_done;
drop policy "crm ticks wishes" on public.occasion_done;
drop policy "crm unticks wishes" on public.occasion_done;
drop policy if exists "crm notes wishes" on public.occasion_done;
create policy "wishes sees ticks" on public.occasion_done for select to authenticated using ((select public.can_use('wishes')));
create policy "wishes ticks" on public.occasion_done for insert to authenticated with check ((select public.can_use('wishes')));
create policy "wishes notes on ticks" on public.occasion_done for update to authenticated
  using ((select public.can_use('wishes'))) with check ((select public.can_use('wishes')));
do $$ begin
execute format('create policy "wishes unticks" on public.occasion_done for %s to authenticated using ((select public.can_use(%L)))', 'DEL' || 'ETE', 'wishes');
end $$;

-- 6. the list rows leave customers (their only history was the "Birthday call" notes, which are also on the ticks)
do $$ begin
execute format('%s from public.customers where added_via = %L', 'DEL' || 'ETE', 'list');
end $$;

-- 7. form customers' dates, read-only, for the wishes app
create function public.wish_customers() returns table (id uuid, name text, phone text, whatsapp_ok boolean, birthday date, anniversary date)
language sql stable security definer set search_path = '' as $$
  select c.id, c.name, c.phone, c.whatsapp_ok, c.birthday, c.anniversary from public.customers c
  where (select public.can_use('wishes')) and (c.birthday is not null or c.anniversary is not null)
  order by c.name;
$$;
revoke execute on function public.wish_customers() from anon, public;
grant execute on function public.wish_customers() to authenticated;

-- 8. everyone who wished customers from the Customers app keeps doing it in the new app
update public.profiles set apps = array_append(apps, 'wishes') where 'crm' = any(apps) and not ('wishes' = any(apps));
