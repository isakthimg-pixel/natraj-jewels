-- Expense tracker: money paid out of the shop.
-- People with the 'expenses' app add expenses and see the ones they entered;
-- they can fix or remove their own entries on the day they entered them.
-- The owner sees, edits and removes everything, and chooses the categories.
alter table public.settings add column expense_categories text[] not null default array[
  'Salary & wages', 'Rent', 'Electricity', 'Tea & snacks', 'Staff food', 'Transport & petrol',
  'Packing & boxes', 'Repairs & maintenance', 'Hallmarking', 'Stationery & printing',
  'Advertising', 'Pooja & festival', 'Bank charges', 'Other'];

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  day date not null default current_date,
  amount numeric(12,2) not null check (amount > 0 and amount < 10000000),
  category text not null check (length(btrim(category)) between 1 and 40),
  mode text not null default 'Cash' check (mode in ('Cash', 'UPI', 'Card', 'Bank transfer', 'Cheque')),
  paid_to text not null default '' check (length(paid_to) <= 80),
  note text not null default '' check (length(note) <= 300),
  created_by uuid references auth.users(id) on delete set null,
  created_by_name text not null default '',
  created_at timestamptz not null default now(),
  updated_by_name text not null default '',
  updated_at timestamptz
);
create index expenses_day_idx on public.expenses (day);
create index expenses_created_by_idx on public.expenses (created_by);

-- Fill in who entered or changed it, and when.
create function public.stamp_expense() returns trigger
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
create trigger expenses_stamp before insert or update on public.expenses for each row execute function public.stamp_expense();
revoke execute on function public.stamp_expense() from anon, authenticated, public;

-- True when the row was entered today (shop time) by the person signed in.
create function public.own_today(p_by uuid, p_at timestamptz) returns boolean
language sql stable set search_path = '' as $$
  select p_by = (select auth.uid())
     and (p_at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date;
$$;

alter table public.expenses enable row level security;
create policy "owner sees all, others their own" on public.expenses for select to authenticated
  using ((select public.is_owner()) or ((select public.can_use('expenses')) and created_by = (select auth.uid())));
create policy "people with the app add" on public.expenses for insert to authenticated
  with check ((select public.can_use('expenses')));
create policy "owner, or own entry the same day, changes" on public.expenses for update to authenticated
  using ((select public.is_owner()) or ((select public.can_use('expenses')) and public.own_today(created_by, created_at)))
  with check ((select public.is_owner()) or (select public.can_use('expenses')));
create policy "owner, or own entry the same day, removes" on public.expenses for delete to authenticated
  using ((select public.is_owner()) or ((select public.can_use('expenses')) and public.own_today(created_by, created_at)));
revoke all on public.expenses from anon;
