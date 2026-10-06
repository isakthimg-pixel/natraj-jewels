-- CRM: customers (shared by later apps: chit schemes, silver sales, stock orders, designs)
-- and their activity: notes, and follow-ups with a due date that someone ticks done.
-- Everyone with the 'crm' app sees and edits customers; only the owner removes a customer.
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 80),
  phone text not null default '' check (phone ~ '^[0-9+ ]{0,20}$'),
  alt_phone text not null default '' check (alt_phone ~ '^[0-9+ ]{0,20}$'),
  area text not null default '' check (length(area) <= 60),
  address text not null default '' check (length(address) <= 300),
  birthday date,
  anniversary date,
  tags text[] not null default '{}',
  source text not null default '' check (length(source) <= 40),
  notes text not null default '' check (length(notes) <= 1000),
  created_by uuid references auth.users(id) on delete set null,
  created_by_name text not null default '',
  created_at timestamptz not null default now(),
  updated_by_name text not null default '',
  updated_at timestamptz
);
create index customers_phone_idx on public.customers (phone) where phone <> '';
create index customers_name_idx on public.customers (lower(name));
create index customers_created_by_idx on public.customers (created_by);

create function public.stamp_customer() returns trigger
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
create trigger customers_stamp before insert or update on public.customers for each row execute function public.stamp_customer();
revoke execute on function public.stamp_customer() from anon, authenticated, public;

alter table public.customers enable row level security;
create policy "crm sees customers" on public.customers for select to authenticated using ((select public.can_use('crm')));
create policy "crm adds customers" on public.customers for insert to authenticated with check ((select public.can_use('crm')));
create policy "crm edits customers" on public.customers for update to authenticated
  using ((select public.can_use('crm'))) with check ((select public.can_use('crm')));
create policy "owner removes customers" on public.customers for delete to authenticated using ((select public.is_owner()));
revoke all on public.customers from anon;

create table public.customer_activity (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  kind text not null check (kind in ('note', 'followup')),
  body text not null check (length(btrim(body)) between 1 and 500),
  due date,
  status text not null default 'open' check (status in ('open', 'done')),
  outcome text not null default '' check (length(outcome) <= 300),
  assigned_to uuid references public.profiles(user_id) on delete set null,
  assigned_name text not null default '',
  done_at timestamptz,
  done_by_name text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_by_name text not null default '',
  created_at timestamptz not null default now(),
  check (kind = 'note' or due is not null)
);
create index customer_activity_customer_idx on public.customer_activity (customer_id, created_at);
create index customer_activity_due_idx on public.customer_activity (kind, status, due);
create index customer_activity_assigned_idx on public.customer_activity (assigned_to);
create index customer_activity_created_by_idx on public.customer_activity (created_by);

create function public.stamp_customer_activity() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_me text := coalesce((select name from public.profiles where user_id = (select auth.uid())), '');
begin
  if tg_op = 'INSERT' then
    new.created_by := (select auth.uid()); new.created_by_name := v_me; new.created_at := now();
  else
    new.created_by := old.created_by; new.created_by_name := old.created_by_name; new.created_at := old.created_at;
    new.customer_id := old.customer_id; new.kind := old.kind;
  end if;
  new.assigned_name := coalesce((select name from public.profiles where user_id = new.assigned_to), '');
  if new.kind = 'note' then
    new.status := 'done'; new.due := null;
  elsif new.status = 'done' and (tg_op = 'INSERT' or old.status <> 'done') then
    new.done_at := now(); new.done_by_name := v_me;
  elsif new.status = 'open' then
    new.done_at := null; new.done_by_name := ''; new.outcome := '';
  end if;
  return new;
end $$;
create trigger customer_activity_stamp before insert or update on public.customer_activity for each row execute function public.stamp_customer_activity();
revoke execute on function public.stamp_customer_activity() from anon, authenticated, public;

alter table public.customer_activity enable row level security;
create policy "crm sees activity" on public.customer_activity for select to authenticated using ((select public.can_use('crm')));
create policy "crm adds activity" on public.customer_activity for insert to authenticated with check ((select public.can_use('crm')));
create policy "crm updates activity" on public.customer_activity for update to authenticated
  using ((select public.can_use('crm'))) with check ((select public.can_use('crm')));
create policy "owner or writer removes activity" on public.customer_activity for delete to authenticated
  using ((select public.is_owner()) or ((select public.can_use('crm')) and created_by = (select auth.uid())));
revoke all on public.customer_activity from anon;

-- People a follow-up can be given to: the owners and everyone with the 'crm' app.
create function public.crm_people() returns table (user_id uuid, name text)
language sql stable security definer set search_path = '' as $$
  select p.user_id, p.name from public.profiles p
  where public.can_use('crm') and (p.is_owner or 'crm' = any(p.apps)) order by p.name;
$$;
revoke execute on function public.crm_people() from anon, public;
grant execute on function public.crm_people() to authenticated;
