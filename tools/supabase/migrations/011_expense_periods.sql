-- Expenses that cover a period (an electricity bill for 2 months, a year's insurance):
-- period_from..period_to are the days the expense pays for. A one-day expense covers its own day.
-- The daily running cost spreads each expense evenly over the days it covers.
alter table public.expenses add column period_from date, add column period_to date;
update public.expenses set period_from = day, period_to = day where period_from is null;

create or replace function public.stamp_expense() returns trigger
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
  -- no period given: the expense covers just its own day
  if new.period_from is null or new.period_to is null then
    new.period_from := new.day; new.period_to := new.day;
  end if;
  return new;
end $$;

alter table public.expenses
  alter column period_from set not null,
  alter column period_to set not null,
  add constraint expenses_period_check check (period_to >= period_from and period_to - period_from <= 1100);
create index expenses_period_idx on public.expenses (period_to, period_from);

-- Anyone who enters expenses can add a category to the shared list (the owner can tidy it later).
create function public.add_expense_category(p_name text) returns text[]
language plpgsql security definer set search_path = '' as $$
declare v text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
declare v_list text[];
begin
  if not public.can_use('expenses') then
    raise exception 'Ask the owner for access to Expenses.' using errcode = '42501';
  end if;
  if length(v) < 1 or length(v) > 40 then
    raise exception 'A category name is 1 to 40 letters.' using errcode = '22023';
  end if;
  select expense_categories into v_list from public.settings where id = 1;
  if not exists (select 1 from unnest(v_list) c where lower(c) = lower(v)) then
    update public.settings set expense_categories = array_append(expense_categories, v) where id = 1
      returning expense_categories into v_list;
  end if;
  return v_list;
end $$;
revoke execute on function public.add_expense_category(text) from anon, public;
grant execute on function public.add_expense_category(text) to authenticated;
