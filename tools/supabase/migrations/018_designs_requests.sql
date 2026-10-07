-- The design library is a list of jewels to buy: what customers asked for (enquiries) and what the
-- shop needs to restock. Each one moves Needed -> Ordered -> Arrived -> Done (or Dropped).
-- Replaces the catalogue table from 017, which held no rows: it is renamed out of the way (and
-- closed to everyone) rather than dropped, so this file has no destructive statements. The
-- "designs" photo bucket and its policies from 017 stay as they are.
alter table public.designs rename to designs_catalogue_unused;
alter table public.designs_catalogue_unused rename constraint designs_pkey to designs_catalogue_unused_pkey;
alter table public.designs_catalogue_unused rename constraint designs_code_key to designs_catalogue_unused_code_key;
alter index public.designs_created_idx rename to designs_cat_created_idx;
alter index public.designs_metal_cat_idx rename to designs_cat_metal_idx;
alter index public.designs_created_by_idx rename to designs_cat_created_by_idx;
revoke all on public.designs_catalogue_unused from anon, authenticated;

create table public.designs (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'enquiry' check (kind in ('enquiry', 'restock')),
  metal text not null default 'Gold' check (metal in ('Gold', 'Silver', 'Diamond')),
  category text not null default '' check (length(category) <= 40),
  purity text not null default '' check (length(purity) <= 20),
  weight_g numeric(9,3) check (weight_g is null or (weight_g > 0 and weight_g < 100000)),   -- about this weight
  size text not null default '' check (length(size) <= 40),                                 -- size or length
  qty int not null default 1 check (qty between 1 and 999),
  budget numeric(12,2) check (budget is null or budget > 0),
  customer_id uuid references public.customers(id) on delete set null,
  customer_name text not null default '' check (length(customer_name) <= 80),
  customer_phone text not null default '' check (customer_phone ~ '^[0-9+ ]{0,20}$'),
  needed_by date,
  supplier text not null default '' check (length(supplier) <= 80),
  notes text not null default '' check (length(notes) <= 500),
  photos text[] not null default '{}',          -- storage paths in the "designs" bucket, first is the cover
  status text not null default 'open' check (status in ('open', 'ordered', 'received', 'done', 'dropped')),
  expected date,                                 -- when the supplier said it will come
  ordered_at timestamptz, received_at timestamptz, closed_at timestamptz,
  close_note text not null default '' check (length(close_note) <= 200),
  created_by uuid references auth.users(id) on delete set null,
  created_by_name text not null default '',
  created_at timestamptz not null default now(),
  updated_by_name text not null default '',
  updated_at timestamptz,
  check (kind = 'restock' or length(btrim(customer_name)) > 0)
);
create index designs_status_idx on public.designs (status, needed_by);
create index designs_created_idx on public.designs (created_at desc);
create index designs_created_by_idx on public.designs (created_by);
create index designs_customer_idx on public.designs (customer_id);

-- who and when are always filled in here, and each step stamps its own time
create function public.stamp_design_request() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_me text := coalesce((select name from public.profiles where user_id = (select auth.uid())), '');
begin
  if tg_op = 'INSERT' then
    new.created_by := (select auth.uid()); new.created_by_name := v_me; new.created_at := now();
    new.updated_by_name := ''; new.updated_at := null;
    new.ordered_at := null; new.received_at := null; new.closed_at := null;
  else
    new.created_by := old.created_by; new.created_by_name := old.created_by_name; new.created_at := old.created_at;
    new.updated_by_name := v_me; new.updated_at := now();
  end if;
  if new.status in ('ordered', 'received', 'done') and new.ordered_at is null then new.ordered_at := now(); end if;
  if new.status in ('received', 'done') and new.received_at is null then new.received_at := now(); end if;
  if new.status in ('done', 'dropped') then new.closed_at := coalesce(new.closed_at, now()); else new.closed_at := null; end if;
  if new.status = 'open' then new.ordered_at := null; new.received_at := null; end if;
  if new.status = 'ordered' then new.received_at := null; end if;
  return new;
end $$;
create trigger designs_stamp before insert or update on public.designs for each row execute function public.stamp_design_request();
revoke execute on function public.stamp_design_request() from anon, authenticated, public;

-- when a customer's piece arrives, whoever took the enquiry hears about it (unless they marked it)
create function public.notify_design_arrived() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status <> 'received' or old.status = 'received' or new.kind <> 'enquiry' then return null; end if;
  insert into public.notifications (user_id, kind, title, body, link)
  select new.created_by, 'design_arrived', 'Arrived for ' || new.customer_name,
         btrim(concat_ws(' ', nullif(new.purity, ''), lower(new.metal), lower(nullif(new.category, '')))) || '. Tell the customer.',
         'designs/#d=' || new.id
  where new.created_by is not null and new.created_by is distinct from (select auth.uid());
  return null;
end $$;
create trigger designs_notify after update of status on public.designs
  for each row execute function public.notify_design_arrived();
revoke execute on function public.notify_design_arrived() from anon, authenticated, public;

alter table public.designs enable row level security;
create policy "designs app sees" on public.designs for select to authenticated using ((select public.can_use('designs')));
create policy "designs app adds" on public.designs for insert to authenticated with check ((select public.can_use('designs')));
create policy "designs app edits" on public.designs for update to authenticated
  using ((select public.can_use('designs'))) with check ((select public.can_use('designs')));
create policy "owner removes designs" on public.designs for delete to authenticated using ((select public.is_owner()));
revoke all on public.designs from anon;
