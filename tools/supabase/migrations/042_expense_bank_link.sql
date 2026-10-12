-- Expenses ↔ Banking.
-- 1. An expense paid from a bank account (UPI, card, bank transfer, cheque) also makes its "money out"
--    entry in Banking, linked by bank_entries.expense_id. Changing the expense changes that entry;
--    making it cash (or removing the account) or deleting the expense removes it. Earlier expenses are
--    left as they were (their bank entries were typed in by hand).
-- 2. The owner can turn a bank payment that has no expense (e.g. a row from Tally) into an expense
--    (expense_from_bank); the new expense is linked to that entry instead of making a second one.
alter table public.bank_entries add column expense_id uuid references public.expenses(id) on delete cascade;
create unique index bank_entries_expense_idx on public.bank_entries (expense_id) where expense_id is not null;

create function public.sync_expense_bank() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_link uuid := nullif(current_setting('nj.link_bank', true), '')::uuid; v_bank uuid;
  v_method text := case new.mode when 'UPI' then 'UPI' when 'Cheque' then 'Cheque' when 'Bank transfer' then 'NEFT / RTGS / IMPS' else 'Card payment' end;
  v_note text := left('Expense: ' || new.category || case when new.note <> '' then ' · ' || new.note else '' end, 300);
begin
  if tg_op = 'INSERT' and v_link is not null then
    update public.bank_entries set expense_id = new.id where id = v_link and expense_id is null;
    return null;
  end if;
  select id into v_bank from public.bank_entries where expense_id = new.id;
  if new.mode = 'Cash' or new.account_id is null then
    if v_bank is not null then execute format('%s%s from public.bank_entries where id = $1', 'DEL', 'ETE') using v_bank; end if;
  elsif v_bank is not null then
    update public.bank_entries set account_id = new.account_id, day = new.day, amount = new.amount, method = v_method, party = left(new.paid_to, 80), note = v_note
    where id = v_bank;
  elsif tg_op = 'INSERT' or old.mode = 'Cash' or old.account_id is null then   -- new, or just switched from cash; older bank-paid expenses keep their hand-typed bank entries
    insert into public.bank_entries (account_id, day, direction, amount, method, party, note, expense_id)
    values (new.account_id, new.day, 'out', new.amount, v_method, left(new.paid_to, 80), v_note, new.id);
  end if;
  return null;
end $$;
create trigger expenses_bank_sync after insert or update on public.expenses for each row execute function public.sync_expense_bank();
revoke execute on function public.sync_expense_bank() from anon, authenticated, public;

-- owner: a bank payment with no expense becomes an expense, linked to it
create function public.expense_from_bank(p_bank uuid, p_category text, p_paid_to text, p_note text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare b public.bank_entries; v_id uuid;
begin
  if not public.is_owner() then raise exception 'Only the owner can do this.' using errcode = '42501'; end if;
  select * into b from public.bank_entries where id = p_bank;
  if b.id is null then raise exception 'That bank entry no longer exists.' using errcode = 'P0002'; end if;
  if b.direction <> 'out' or b.method in ('Transfer', 'Opening balance') then raise exception 'Only money paid out can become an expense.' using errcode = '22023'; end if;
  if b.expense_id is not null then raise exception 'This bank payment already has its expense.' using errcode = '22023'; end if;
  perform set_config('nj.link_bank', b.id::text, true);
  insert into public.expenses (day, amount, category, mode, account_id, paid_to, note)
  values (b.day, b.amount, btrim(p_category),
          case b.method when 'UPI' then 'UPI' when 'Cheque' then 'Cheque' when 'Card payment' then 'Card' else 'Bank transfer' end,
          b.account_id, left(coalesce(nullif(btrim(p_paid_to), ''), b.party), 80), left(coalesce(p_note, ''), 300))
  returning id into v_id;
  perform set_config('nj.link_bank', '', true);
  return v_id;
end $$;
revoke execute on function public.expense_from_bank(uuid, text, text, text) from anon, public;
grant execute on function public.expense_from_bank(uuid, text, text, text) to authenticated;
