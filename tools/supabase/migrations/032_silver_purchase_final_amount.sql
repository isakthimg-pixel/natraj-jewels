-- Silver purchases are entered with the final amount paid too. With an amount, it is kept as typed and
-- the rate is worked out from it: a sale per gram before GST, a purchase per fine gram (weight x touch).
-- (Replaces stamp_silver from migration 031; the rest of it is unchanged.)
create or replace function public.stamp_silver() returns trigger
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
  if coalesce(new.amount, 0) > 0 then
    -- the final amount typed at the counter: keep it, and work out the rate from it
    -- (a sale: per gram before GST; a purchase: per fine gram)
    new.amount := round(new.amount, 2);
    new.rate := greatest(case when new.kind = 'sale'
      then round((new.amount / (1 + new.gst_percent / 100) - new.making) / new.weight_g, 2)
      else round(new.amount / nullif(new.fine_g, 0), 2) end, 0.01);
  else
    new.amount := case when new.kind = 'sale'
      then round((new.weight_g * new.rate + new.making) * (1 + new.gst_percent / 100), 2)
      else round(new.fine_g * new.rate, 2) end;
  end if;
  if new.mode = 'Cash' then new.account_id := null; end if;
  if new.account_id is null then
    if tg_op = 'INSERT' or old.account_id is not null or new.mode = 'Cash' then new.account_name := ''; end if;
  elsif tg_op = 'INSERT' or new.account_id is distinct from old.account_id then
    new.account_name := coalesce((select a.name || case when a.last4 <> '' then ' ··' || a.last4 else '' end
                                    from public.bank_accounts a where a.id = new.account_id), '');
  end if;
  return new;
end $$;
