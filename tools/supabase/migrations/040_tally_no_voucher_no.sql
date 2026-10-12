-- Tally upload without voucher numbers: the reference is now just "Tally Payment" / "Tally Contra", so two
-- equal payments on the same day (same ledger, same amount) look alike. A row of the file is skipped only
-- when the account already has MORE such entries than the rows before it in the same file, so equal
-- payments are all added the first time and none are added again on a second upload.
create or replace function public.apply_change(p_app text, p_action text, p_target uuid, p_data jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare m record; v_cols text[]; v_list text; v_id uuid; v_row jsonb; v_i bigint; v_first uuid; v_new uuid[] := '{}';
begin
  select * into m from public.change_target(p_app);
  if m.tbl is null then raise exception 'Unknown app.' using errcode = '22023'; end if;
  if p_action = 'import' then
    if p_app <> 'banking' then raise exception 'Unknown change.' using errcode = '22023'; end if;
    for v_row, v_i in select e, i from jsonb_array_elements(coalesce(p_data -> 'rows', '[]')) with ordinality as x(e, i) loop
      continue when coalesce(v_row ->> 'reference', '') <> '' and
        (select count(*) from public.bank_entries e where e.account_id = (v_row ->> 'account_id')::uuid and e.day = (v_row ->> 'day')::date
           and e.direction = v_row ->> 'direction' and e.amount = (v_row ->> 'amount')::numeric and e.reference = v_row ->> 'reference'
           and e.party = coalesce(v_row ->> 'party', '') and e.id <> all(v_new))
        > (select count(*) from jsonb_array_elements(p_data -> 'rows') with ordinality as y(o, j) where j < v_i
           and o ->> 'account_id' = v_row ->> 'account_id' and o ->> 'day' = v_row ->> 'day' and o ->> 'direction' = v_row ->> 'direction'
           and (o ->> 'amount')::numeric = (v_row ->> 'amount')::numeric and o ->> 'reference' = v_row ->> 'reference' and coalesce(o ->> 'party', '') = coalesce(v_row ->> 'party', ''));
      v_id := public.apply_change(p_app, 'add', null, v_row);
      v_new := v_new || v_id;
      v_first := coalesce(v_first, v_id);
    end loop;
    return v_first;
  end if;
  select array_agg(k) into v_cols from jsonb_object_keys(coalesce(p_data, '{}')) k where k = any(m.cols);
  if p_action = 'add' then
    if v_cols is null then raise exception 'Nothing to add.' using errcode = '22023'; end if;
    v_list := (select string_agg(quote_ident(c), ', ') from unnest(v_cols) c);
    execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I, $1) returning id', m.tbl, v_list, v_list, m.tbl)
      into v_id using p_data;
  elsif p_action = 'edit' then
    if v_cols is null then raise exception 'Nothing to change.' using errcode = '22023'; end if;
    execute format('update public.%I t set %s from jsonb_populate_record(null::public.%I, $1) r where t.id = $2 returning t.id', m.tbl,
      (select string_agg(format('%I = r.%I', c, c), ', ') from unnest(v_cols) c), m.tbl) into v_id using p_data, p_target;
  elsif p_action = 'delete' then
    execute format('%s from public.%I where id = $1 returning id', upper(p_action), m.tbl) into v_id using p_target;   -- DELETE
  else
    raise exception 'Unknown change.' using errcode = '22023';
  end if;
  if v_id is null then raise exception 'That entry no longer exists.' using errcode = 'P0002'; end if;
  return v_id;
end $$;
revoke execute on function public.apply_change(text, text, uuid, jsonb) from anon, authenticated, public;
