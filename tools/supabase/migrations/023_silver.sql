-- Silver sales and purchases. A sale: weight × rate per gram + making charges, plus GST. A purchase
-- (old silver from a customer, or stock from a supplier): fine weight (weight × touch %) × rate per
-- fine gram. The fine weight and the amount are always worked out here, so they cannot be typed wrong.
-- Everyone with the 'silver' app sees the day book and adds entries, and fixes their own on the same
-- day; the owner can change anything. Non-cash payments record the bank account, like expenses.
create table public.silver_entries (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('sale', 'purchase')),
  day date not null default ((now() at time zone 'Asia/Kolkata')::date),
  item text not null default '' check (length(item) <= 60),
  party text not null default '' check (length(party) <= 80),              -- customer or supplier
  phone text not null default '' check (phone ~ '^[0-9+ ]{0,20}$'),
  customer_id uuid references public.customers(id) on delete set null,
  from_supplier boolean not null default false,                             -- purchase: stock from a supplier, not old silver
  pieces int not null default 1 check (pieces between 1 and 9999),
  weight_g numeric(10,3) not null check (weight_g > 0 and weight_g < 1000000),
  touch numeric(5,2) not null default 92.5 check (touch > 0 and touch <= 100),
  fine_g numeric(10,3) not null default 0,
  rate numeric(10,2) not null check (rate > 0 and rate < 100000),           -- ₹ per gram (sale) or per fine gram (purchase)
  making numeric(12,2) not null default 0 check (making >= 0),
  gst_percent numeric(4,2) not null default 0 check (gst_percent in (0, 3)),
  amount numeric(14,2) not null default 0,
  mode text not null default 'Cash' check (mode in ('Cash', 'UPI', 'Card', 'Bank transfer', 'Cheque')),
  account_id uuid references public.bank_accounts(id) on delete set null,
  account_name text not null default '' check (length(account_name) <= 80),
  bill_no text not null default '' check (length(bill_no) <= 30),
  note text not null default '' check (length(note) <= 300),
  created_by uuid references auth.users(id) on delete set null,
  created_by_name text not null default '',
  created_at timestamptz not null default now(),
  updated_by_name text not null default '',
  updated_at timestamptz
);
create index silver_entries_day_idx on public.silver_entries (day);
create index silver_entries_created_by_idx on public.silver_entries (created_by);
create index silver_entries_customer_idx on public.silver_entries (customer_id);
create index silver_entries_account_idx on public.silver_entries (account_id);

create function public.stamp_silver() returns trigger
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
  if new.kind = 'sale' then new.from_supplier := false; else new.making := 0; new.gst_percent := 0; end if;
  new.fine_g := round(new.weight_g * new.touch / 100, 3);
  new.amount := case when new.kind = 'sale'
    then round((new.weight_g * new.rate + new.making) * (1 + new.gst_percent / 100), 2)
    else round(new.fine_g * new.rate, 2) end;
  -- the bank account, by name, for anything not paid in cash
  if new.mode = 'Cash' then new.account_id := null; end if;
  if new.account_id is null then
    if tg_op = 'INSERT' or old.account_id is not null or new.mode = 'Cash' then new.account_name := ''; end if;
  elsif tg_op = 'INSERT' or new.account_id is distinct from old.account_id then
    new.account_name := coalesce((select a.name || case when a.last4 <> '' then ' ··' || a.last4 else '' end
                                    from public.bank_accounts a where a.id = new.account_id), '');
  end if;
  return new;
end $$;
create trigger silver_entries_stamp before insert or update on public.silver_entries for each row execute function public.stamp_silver();
revoke execute on function public.stamp_silver() from anon, authenticated, public;

alter table public.silver_entries enable row level security;
create policy "silver app sees the day book" on public.silver_entries for select to authenticated using ((select public.can_use('silver')));
create policy "silver app adds" on public.silver_entries for insert to authenticated with check ((select public.can_use('silver')));
create policy "owner or same day fixes" on public.silver_entries for update to authenticated
  using ((select public.is_owner()) or ((select public.can_use('silver')) and public.own_today(created_by, created_at)))
  with check ((select public.is_owner()) or ((select public.can_use('silver')) and public.own_today(created_by, created_at)));
create policy "owner or same day removes" on public.silver_entries for delete to authenticated
  using ((select public.is_owner()) or ((select public.can_use('silver')) and public.own_today(created_by, created_at)));
revoke all on public.silver_entries from anon;

-- people who record silver also choose a bank account for non-cash payments
create or replace function public.bank_account_choices() returns table (id uuid, name text, last4 text)
language sql stable security definer set search_path = '' as $$
  select a.id, a.name, a.last4 from public.bank_accounts a
  where a.active and ((select public.can_use('expenses')) or (select public.can_use('banking')) or (select public.can_use('silver')))
  order by a.name;
$$;
