-- Chit scheme: the owner sets up plans (a fixed or flexible monthly amount, saved as money or as
-- grams of 22K gold at the day's rate, for a number of months, with a bonus at the end);
-- customers join a plan as members, and staff record each payment with a receipt number.
-- Staff with the 'chits' app see everything, add members and take payments; they can fix or
-- remove their own payment on the same day. The owner manages plans and can change anything.

create table public.chit_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(btrim(name)) between 1 and 60),
  saves text not null default 'money' check (saves in ('money', 'gold')),   -- gold: each payment buys 22K grams at that day's rate
  months int not null check (months between 1 and 60),
  instalment numeric(12,2) check (instalment is null or instalment > 0),     -- null: the customer pays any amount each month
  bonus_kind text not null default 'none' check (bonus_kind in ('none', 'instalment', 'percent')),
  bonus_value numeric(6,2) not null default 0 check (bonus_value >= 0 and bonus_value <= 100),
  benefit text not null default '' check (length(benefit) <= 200),           -- e.g. "No wastage up to 8%"
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create sequence public.chit_card_seq start 1001;

create table public.chit_members (
  id uuid primary key default gen_random_uuid(),
  card_no text not null unique check (length(btrim(card_no)) between 1 and 20),
  plan_id uuid not null references public.chit_plans(id),
  customer_id uuid references public.customers(id) on delete set null,
  name text not null check (length(btrim(name)) between 1 and 80),
  phone text not null default '' check (phone ~ '^[0-9+ ]{0,20}$'),
  start_month date not null check (extract(day from start_month) = 1),
  status text not null default 'active' check (status in ('active', 'closed', 'cancelled')),
  closed_at timestamptz,
  close_note text not null default '' check (length(close_note) <= 200),
  notes text not null default '' check (length(notes) <= 300),
  created_by uuid references auth.users(id) on delete set null,
  created_by_name text not null default '',
  created_at timestamptz not null default now(),
  updated_by_name text not null default '',
  updated_at timestamptz
);
create index chit_members_plan_idx on public.chit_members (plan_id);
create index chit_members_customer_idx on public.chit_members (customer_id);
create index chit_members_created_by_idx on public.chit_members (created_by);

create table public.chit_payments (
  id uuid primary key default gen_random_uuid(),
  receipt_no bigint generated always as identity (start with 1),
  member_id uuid not null references public.chit_members(id) on delete cascade,
  paid_on date not null default ((now() at time zone 'Asia/Kolkata')::date),
  amount numeric(12,2) not null check (amount > 0 and amount < 10000000),
  mode text not null default 'Cash' check (mode in ('Cash', 'UPI', 'Card', 'Bank transfer', 'Cheque')),
  gold_rate numeric(10,2) check (gold_rate is null or gold_rate > 0),          -- 22K rupees per gram, for gold plans
  grams numeric(10,3) check (grams is null or grams > 0),
  note text not null default '' check (length(note) <= 200),
  created_by uuid references auth.users(id) on delete set null,
  created_by_name text not null default '',
  created_at timestamptz not null default now(),
  updated_by_name text not null default '',
  updated_at timestamptz
);
create index chit_payments_member_idx on public.chit_payments (member_id, paid_on);
create index chit_payments_paid_on_idx on public.chit_payments (paid_on);
create index chit_payments_created_by_idx on public.chit_payments (created_by);

-- who and when; a new member gets the next card number unless one was typed
create function public.stamp_chit_member() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_me text := coalesce((select name from public.profiles where user_id = (select auth.uid())), '');
begin
  if tg_op = 'INSERT' then
    new.created_by := (select auth.uid()); new.created_by_name := v_me; new.created_at := now();
    new.updated_by_name := ''; new.updated_at := null;
    if coalesce(btrim(new.card_no), '') = '' then new.card_no := nextval('public.chit_card_seq')::text; end if;
  else
    new.created_by := old.created_by; new.created_by_name := old.created_by_name; new.created_at := old.created_at;
    new.updated_by_name := v_me; new.updated_at := now();
  end if;
  new.card_no := upper(btrim(new.card_no));
  if new.status = 'active' then new.closed_at := null; else new.closed_at := coalesce(new.closed_at, now()); end if;
  return new;
end $$;
create trigger chit_members_stamp before insert or update on public.chit_members for each row execute function public.stamp_chit_member();
revoke execute on function public.stamp_chit_member() from anon, authenticated, public;

-- who and when; for gold plans the grams always follow amount ÷ rate
create function public.stamp_chit_payment() returns trigger
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
  new.grams := case when new.gold_rate is null then null else round(new.amount / new.gold_rate, 3) end;
  return new;
end $$;
create trigger chit_payments_stamp before insert or update on public.chit_payments for each row execute function public.stamp_chit_payment();
revoke execute on function public.stamp_chit_payment() from anon, authenticated, public;

alter table public.chit_plans enable row level security;
create policy "chits app sees plans" on public.chit_plans for select to authenticated using ((select public.can_use('chits')));
create policy "owner adds plans" on public.chit_plans for insert to authenticated with check ((select public.is_owner()));
create policy "owner changes plans" on public.chit_plans for update to authenticated using ((select public.is_owner())) with check ((select public.is_owner()));
create policy "owner removes plans" on public.chit_plans for delete to authenticated using ((select public.is_owner()));

alter table public.chit_members enable row level security;
create policy "chits app sees members" on public.chit_members for select to authenticated using ((select public.can_use('chits')));
create policy "chits app adds members" on public.chit_members for insert to authenticated with check ((select public.can_use('chits')));
create policy "chits app edits members" on public.chit_members for update to authenticated
  using ((select public.can_use('chits'))) with check ((select public.can_use('chits')));
create policy "owner removes members" on public.chit_members for delete to authenticated using ((select public.is_owner()));

alter table public.chit_payments enable row level security;
create policy "chits app sees payments" on public.chit_payments for select to authenticated using ((select public.can_use('chits')));
create policy "chits app takes payments" on public.chit_payments for insert to authenticated with check ((select public.can_use('chits')));
create policy "owner or same day fixes payments" on public.chit_payments for update to authenticated
  using ((select public.is_owner()) or ((select public.can_use('chits')) and public.own_today(created_by, created_at)))
  with check ((select public.is_owner()) or ((select public.can_use('chits')) and public.own_today(created_by, created_at)));
create policy "owner or same day removes payments" on public.chit_payments for delete to authenticated
  using ((select public.is_owner()) or ((select public.can_use('chits')) and public.own_today(created_by, created_at)));

revoke all on public.chit_plans, public.chit_members, public.chit_payments from anon;
revoke all on sequence public.chit_card_seq from anon, authenticated;
