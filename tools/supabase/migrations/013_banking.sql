-- Banking entry log: deposits, withdrawals and transfers per bank account.
-- The owner keeps the list of accounts. People with the 'banking' app add entries and see the
-- ones they entered (fixing them on the same day); the owner sees everything and the balances.
-- An opening balance is an ordinary entry (method 'Opening balance') entered by the owner.
create table public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 60),
  bank text not null default '' check (length(bank) <= 60),
  last4 text not null default '' check (last4 ~ '^[0-9]{0,4}$'),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.bank_accounts enable row level security;
create policy "people with the app see accounts" on public.bank_accounts for select to authenticated
  using ((select public.can_use('banking')));
create policy "owner adds accounts" on public.bank_accounts for insert to authenticated with check ((select public.is_owner()));
create policy "owner edits accounts" on public.bank_accounts for update to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));
create policy "owner removes accounts" on public.bank_accounts for delete to authenticated using ((select public.is_owner()));
revoke all on public.bank_accounts from anon;

create table public.bank_entries (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.bank_accounts(id) on delete cascade,
  day date not null default current_date,
  direction text not null check (direction in ('in', 'out')),
  amount numeric(14,2) not null check (amount > 0 and amount < 10000000000),
  method text not null default '' check (length(method) <= 30),
  party text not null default '' check (length(party) <= 80),
  reference text not null default '' check (length(reference) <= 40),
  note text not null default '' check (length(note) <= 300),
  transfer_id uuid,                        -- both halves of a transfer between two accounts share this
  created_by uuid references auth.users(id) on delete set null,
  created_by_name text not null default '',
  created_at timestamptz not null default now(),
  updated_by_name text not null default '',
  updated_at timestamptz
);
create index bank_entries_account_day_idx on public.bank_entries (account_id, day);
create index bank_entries_created_by_idx on public.bank_entries (created_by);
create index bank_entries_transfer_idx on public.bank_entries (transfer_id) where transfer_id is not null;

create function public.stamp_bank_entry() returns trigger
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
create trigger bank_entries_stamp before insert or update on public.bank_entries for each row execute function public.stamp_bank_entry();
revoke execute on function public.stamp_bank_entry() from anon, authenticated, public;

alter table public.bank_entries enable row level security;
create policy "owner sees all, others their own" on public.bank_entries for select to authenticated
  using ((select public.is_owner()) or ((select public.can_use('banking')) and created_by = (select auth.uid())));
create policy "people with the app add" on public.bank_entries for insert to authenticated
  with check ((select public.can_use('banking')));
create policy "owner, or own entry the same day, changes" on public.bank_entries for update to authenticated
  using ((select public.is_owner()) or ((select public.can_use('banking')) and public.own_today(created_by, created_at)))
  with check ((select public.is_owner()) or (select public.can_use('banking')));
create policy "owner, or own entry the same day, removes" on public.bank_entries for delete to authenticated
  using ((select public.is_owner()) or ((select public.can_use('banking')) and public.own_today(created_by, created_at)));
revoke all on public.bank_entries from anon;

-- Balance of each account at the end of a day (only what the caller may see, so: the owner).
create function public.bank_balances(p_until date) returns table (account_id uuid, balance numeric)
language sql stable set search_path = '' as $$
  select e.account_id, sum(case when e.direction = 'in' then e.amount else -e.amount end)
  from public.bank_entries e where e.day <= p_until group by e.account_id;
$$;
revoke execute on function public.bank_balances(date) from anon, public;
grant execute on function public.bank_balances(date) to authenticated;
