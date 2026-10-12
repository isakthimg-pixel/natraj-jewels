-- Bank entries from a Tally bank book (Excel). The Banking page reads the file in the browser and shows
-- every row before saving. The owner's rows are saved straight away. Staff rows dated today or yesterday
-- are saved straight away too; when any row is older, the whole file goes to the owner as ONE change
-- request (action 'import', data {"rows": [...]}) instead of one request per row.
-- A row already in the account (same day, money in/out, amount and Tally reference) is skipped, so the
-- same file can be uploaded twice without doubling anything.
alter table public.change_requests drop constraint change_requests_action_check;
alter table public.change_requests add constraint change_requests_action_check check (action in ('add', 'edit', 'delete', 'import'));

create or replace function public.apply_change(p_app text, p_action text, p_target uuid, p_data jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare m record; v_cols text[]; v_list text; v_id uuid; v_row jsonb; v_first uuid;
begin
  select * into m from public.change_target(p_app);
  if m.tbl is null then raise exception 'Unknown app.' using errcode = '22023'; end if;
  if p_action = 'import' then
    if p_app <> 'banking' then raise exception 'Unknown change.' using errcode = '22023'; end if;
    for v_row in select * from jsonb_array_elements(coalesce(p_data -> 'rows', '[]')) loop
      continue when exists (select 1 from public.bank_entries e where e.account_id = (v_row ->> 'account_id')::uuid and e.day = (v_row ->> 'day')::date
        and e.direction = v_row ->> 'direction' and e.amount = (v_row ->> 'amount')::numeric and e.reference = coalesce(v_row ->> 'reference', '') and coalesce(v_row ->> 'reference', '') <> '');
      v_id := public.apply_change(p_app, 'add', null, v_row);
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

create or replace function public.request_change(p_app text, p_action text, p_target uuid, p_data jsonb, p_reason text, p_summary text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare m record; v_me uuid := (select auth.uid()); v_name text; v_data jsonb; v_before jsonb; v_id uuid; v_n int;
begin
  select * into m from public.change_target(p_app);
  if m.tbl is null or p_action not in ('add', 'edit', 'delete', 'import') or (p_action = 'import' and p_app <> 'banking') then raise exception 'Unknown change.' using errcode = '22023'; end if;
  if not public.can_use(p_app) then raise exception 'Ask the owner for access to this app.' using errcode = '42501'; end if;
  if length(btrim(coalesce(p_reason, ''))) = 0 then raise exception 'Write a short reason for the owner.' using errcode = '22023'; end if;
  if (select count(*) from public.change_requests where requested_by = v_me and status = 'pending') >= 30 then
    raise exception 'You already have 30 changes waiting for the owner. Ask the owner to look at them first.' using errcode = '22023';
  end if;
  v_name := coalesce((select name from public.profiles where user_id = v_me), '');
  if p_action = 'import' then
    -- each row keeps only the columns a bank entry may set
    select coalesce(jsonb_agg((select coalesce(jsonb_object_agg(k, r -> k), '{}') from jsonb_object_keys(r) k where k = any(m.cols))), '[]'), count(*)
      into v_data, v_n from jsonb_array_elements(case when jsonb_typeof(p_data -> 'rows') = 'array' then p_data -> 'rows' else '[]' end) r;
    if v_n = 0 then raise exception 'Nothing to add.' using errcode = '22023'; end if;
    if v_n > 1000 then raise exception 'Upload at most 1000 rows at a time.' using errcode = '22023'; end if;
    v_data := jsonb_build_object('rows', v_data);
  else
    select coalesce(jsonb_object_agg(k, p_data -> k), '{}') into v_data from jsonb_object_keys(coalesce(p_data, '{}')) k where k = any(m.cols);
  end if;
  if p_action in ('edit', 'delete') then
    execute format('select to_jsonb(t) from public.%I t where id = $1', m.tbl) into v_before using p_target;
    if v_before is null then raise exception 'That entry no longer exists.' using errcode = 'P0002'; end if;
    if p_app in ('expenses', 'banking') and not public.is_owner() and (v_before ->> 'created_by')::uuid is distinct from v_me then
      raise exception 'You can ask to change only entries you made.' using errcode = '42501';
    end if;
    if p_app = 'banking' and v_before ->> 'transfer_id' is not null then
      raise exception 'Transfers between accounts on older days are changed by the owner. Please ask the owner.' using errcode = '22023';
    end if;
  end if;
  -- try it now and undo it, so a mistake shows while the staff member is here (not for a new chit
  -- payment, which would use up a receipt number)
  if not (p_app = 'chits' and p_action = 'add') then
    begin
      perform public.apply_change(p_app, p_action, p_target, v_data);
      raise exception using errcode = 'NJ001';
    exception when sqlstate 'NJ001' then null;
    end;
  end if;
  insert into public.change_requests (app, action, target_id, data, before, summary, reason, requested_by, requested_by_name)
  values (p_app, p_action, case when p_action in ('add', 'import') then null else p_target end, v_data, v_before,
          left(coalesce(p_summary, ''), 300), left(btrim(p_reason), 300), v_me, v_name)
  returning id into v_id;
  insert into public.notifications (user_id, kind, title, body, link)
  select p.user_id, 'change_request',
         v_name || case p_action when 'import' then ' asks to add ' || v_n || ' bank entries from Tally'
           else ' asks to ' || case p_action when 'add' then 'add' when 'edit' then 'change' else 'remove' end || ' an older entry' end,
         left(coalesce(p_summary, '') || ' · ' || btrim(p_reason), 300), p_app || '/'
  from public.profiles p where p.is_owner;
  return v_id;
end $$;
revoke execute on function public.request_change(text, text, uuid, jsonb, text, text) from anon, public;
grant execute on function public.request_change(text, text, uuid, jsonb, text, text) to authenticated;
