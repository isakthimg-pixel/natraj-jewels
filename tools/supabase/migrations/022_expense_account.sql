-- Which bank account an expense was paid from (for UPI, card, bank transfer and cheque; never cash).
-- The account's name is kept on the expense too, so people without the Banking app can see it and it
-- survives the account being removed. bank_account_choices() lists the accounts in use to anyone
-- who enters expenses, without opening the Banking app's balances or entries to them.
alter table public.expenses add column account_id uuid references public.bank_accounts(id) on delete set null;
alter table public.expenses add column account_name text not null default '' check (length(account_name) <= 80);
create index expenses_account_idx on public.expenses (account_id);

create function public.expense_account_name() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.mode = 'Cash' then new.account_id := null; end if;
  if new.account_id is null then
    if tg_op = 'INSERT' or old.account_id is not null or new.mode = 'Cash' then new.account_name := ''; end if;
  elsif tg_op = 'INSERT' or new.account_id is distinct from old.account_id then
    new.account_name := coalesce((select a.name || case when a.last4 <> '' then ' ··' || a.last4 else '' end
                                    from public.bank_accounts a where a.id = new.account_id), '');
  end if;
  return new;
end $$;
create trigger expenses_account_name before insert or update on public.expenses for each row execute function public.expense_account_name();
revoke execute on function public.expense_account_name() from anon, authenticated, public;

create function public.bank_account_choices() returns table (id uuid, name text, last4 text)
language sql stable security definer set search_path = '' as $$
  select a.id, a.name, a.last4 from public.bank_accounts a
  where a.active and ((select public.can_use('expenses')) or (select public.can_use('banking')))
  order by a.name;
$$;
revoke execute on function public.bank_account_choices() from anon, public;
grant execute on function public.bank_account_choices() to authenticated;
