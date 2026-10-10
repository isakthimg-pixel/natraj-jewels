-- Silver sales are entered with the final amount the customer paid (no touch or making charges on the
-- form). For a sale with an amount, the amount is kept as typed and the rate per gram is worked out from
-- it (before GST). Purchases are unchanged (weight, touch, rate per fine gram). The item list is shared
-- and anyone with the Silver app can add a new item to it.
alter table public.settings add column silver_items text[] not null default array[
  'Anklet', 'Toe ring', 'Chain', 'Bangle', 'Bracelet', 'Ring', 'Kumkum bowl', 'Plate', 'Glass',
  'Lamp (vilakku)', 'Pooja set', 'Idol', 'Kids items', 'Coin', 'Bar', 'Old silver'];

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
  if new.kind = 'sale' and coalesce(new.amount, 0) > 0 then
    -- the final amount typed at the counter: keep it, and work out the rate per gram before GST
    new.amount := round(new.amount, 2);
    new.rate := greatest(round((new.amount / (1 + new.gst_percent / 100) - new.making) / new.weight_g, 2), 0.01);
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

-- anyone with the Silver app can add an item to the shared list (the owner can tidy it later)
create function public.add_silver_item(p_name text) returns text[]
language plpgsql security definer set search_path = '' as $$
declare v text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')); v_list text[];
begin
  if not public.can_use('silver') then raise exception 'Ask the owner for access to Silver.' using errcode = '42501'; end if;
  if length(v) < 1 or length(v) > 60 then raise exception 'An item name is 1 to 60 letters.' using errcode = '22023'; end if;
  select silver_items into v_list from public.settings where id = 1;
  if not exists (select 1 from unnest(v_list) c where lower(c) = lower(v)) then
    update public.settings set silver_items = array_append(silver_items, v) where id = 1 returning silver_items into v_list;
  end if;
  return v_list;
end $$;
revoke execute on function public.add_silver_item(text) from anon, public;
grant execute on function public.add_silver_item(text) to authenticated;

-- requests to change older silver entries may now carry the amount too
create or replace function public.change_target(p_app text, out tbl text, out datecol text, out cols text[])
language sql immutable set search_path = '' as $$
  select v.t, v.d, v.c from (values
    ('expenses', 'expenses', 'day', array['day','amount','category','mode','account_id','paid_to','note','period_from','period_to','gst_claimable','gst_rate','gstin','bill_no']),
    ('banking', 'bank_entries', 'day', array['account_id','day','direction','amount','method','party','reference','note','for_chit']),
    ('silver', 'silver_entries', 'day', array['kind','day','item','party','phone','customer_id','from_supplier','pieces','weight_g','touch','rate','making','gst_percent','amount','mode','account_id','bill_no','note']),
    ('chits', 'chit_payments', 'paid_on', array['member_id','paid_on','amount','mode','gold_rate','note'])
  ) v(app, t, d, c) where v.app = p_app;
$$;
