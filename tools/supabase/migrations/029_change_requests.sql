-- Older days need the owner's approval. In Expenses, Banking, Silver and Chit payments, staff add,
-- change and remove entries dated today or yesterday only (and only their own, as before). For an older
-- day they send the change to the owner as a change request; the owner approves it (the change is then
-- made exactly as asked, in the staff member's name) or rejects it. Owners are not limited.

-- today or yesterday, shop time
create function public.recent_day(d date) returns boolean
language sql stable set search_path = '' as $$
  select d between (now() at time zone 'Asia/Kolkata')::date - 1 and (now() at time zone 'Asia/Kolkata')::date;
$$;

-- the rules: add only for today or yesterday; change or remove only your own entries of today or yesterday
do $$
declare r record;
begin
  for r in select * from (values
    ('expenses', 'expenses', 'day', 'people with the app add', 'owner, or own entry the same day, changes', 'owner, or own entry the same day, removes'),
    ('bank_entries', 'banking', 'day', 'people with the app add', 'owner, or own entry the same day, changes', 'owner, or own entry the same day, removes'),
    ('silver_entries', 'silver', 'day', 'silver app adds', 'owner or same day fixes', 'owner or same day removes'),
    ('chit_payments', 'chits', 'paid_on', 'chits app takes payments', 'owner or same day fixes payments', 'owner or same day removes payments')
  ) v(tbl, app, dcol, p_ins, p_upd, p_del) loop
    execute format('alter policy %I on public.%I with check ((select public.can_use(%L)) and ((select public.is_owner()) or public.recent_day(%I)))', r.p_ins, r.tbl, r.app, r.dcol);
    execute format('alter policy %I on public.%I using ((select public.is_owner()) or ((select public.can_use(%L)) and created_by = (select auth.uid()) and public.recent_day(%I)))'
      || ' with check ((select public.is_owner()) or ((select public.can_use(%L)) and created_by = (select auth.uid()) and public.recent_day(%I)))', r.p_upd, r.tbl, r.app, r.dcol, r.app, r.dcol);
    execute format('alter policy %I on public.%I using ((select public.is_owner()) or ((select public.can_use(%L)) and created_by = (select auth.uid()) and public.recent_day(%I)))', r.p_del, r.tbl, r.app, r.dcol);
    execute format('alter policy %I on public.%I rename to %I', r.p_ins, r.tbl, 'people with the app add, staff for today or yesterday');
    execute format('alter policy %I on public.%I rename to %I', r.p_upd, r.tbl, 'owner, or own entry of today or yesterday, changes');
    execute format('alter policy %I on public.%I rename to %I', r.p_del, r.tbl, 'owner, or own entry of today or yesterday, removes');
  end loop;
end $$;

-- which table each app's requests change, its date column, and the columns a request may set
create function public.change_target(p_app text, out tbl text, out datecol text, out cols text[])
language sql immutable set search_path = '' as $$
  select v.t, v.d, v.c from (values
    ('expenses', 'expenses', 'day', array['day','amount','category','mode','account_id','paid_to','note','period_from','period_to','gst_claimable','gst_rate','gstin','bill_no']),
    ('banking', 'bank_entries', 'day', array['account_id','day','direction','amount','method','party','reference','note','for_chit']),
    ('silver', 'silver_entries', 'day', array['kind','day','item','party','phone','customer_id','from_supplier','pieces','weight_g','touch','rate','making','gst_percent','mode','account_id','bill_no','note']),
    ('chits', 'chit_payments', 'paid_on', array['member_id','paid_on','amount','mode','gold_rate','note'])
  ) v(app, t, d, c) where v.app = p_app;
$$;

create table public.change_requests (
  id uuid primary key default gen_random_uuid(),
  app text not null check (app in ('expenses', 'banking', 'silver', 'chits')),
  action text not null check (action in ('add', 'edit', 'delete')),
  target_id uuid,                                   -- the entry to change or remove
  data jsonb not null default '{}',                 -- the new values (add, edit)
  before jsonb,                                     -- the entry as it was when asked (edit, delete)
  summary text not null default '' check (length(summary) <= 300),
  reason text not null check (length(btrim(reason)) between 1 and 300),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  requested_by uuid references auth.users(id) on delete set null,
  requested_by_name text not null default '',
  requested_at timestamptz not null default now(),
  decided_by_name text not null default '',
  decided_at timestamptz,
  decision_note text not null default '' check (length(decision_note) <= 300),
  result_id uuid
);
create index change_requests_pending_idx on public.change_requests (app, requested_at) where status = 'pending';
create index change_requests_by_idx on public.change_requests (requested_by, requested_at desc);
alter table public.change_requests enable row level security;
create policy "owner sees all, others their own" on public.change_requests for select to authenticated
  using ((select public.is_owner()) or (requested_by = (select auth.uid()) and (select public.is_member())));
create policy "approved device only" on public.change_requests as restrictive for all to authenticated
  using ((select public.device_ok())) with check ((select public.device_ok()));
revoke all on public.change_requests from anon;
revoke insert, update on public.change_requests from authenticated;   -- only through the functions below (and no rule lets anyone remove them)

-- make the change (used when asking, to check it, and when the owner approves)
create function public.apply_change(p_app text, p_action text, p_target uuid, p_data jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare m record; v_cols text[]; v_list text; v_id uuid;
begin
  select * into m from public.change_target(p_app);
  if m.tbl is null then raise exception 'Unknown app.' using errcode = '22023'; end if;
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

-- staff: ask the owner
create function public.request_change(p_app text, p_action text, p_target uuid, p_data jsonb, p_reason text, p_summary text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare m record; v_me uuid := (select auth.uid()); v_name text; v_data jsonb; v_before jsonb; v_id uuid;
begin
  select * into m from public.change_target(p_app);
  if m.tbl is null or p_action not in ('add', 'edit', 'delete') then raise exception 'Unknown change.' using errcode = '22023'; end if;
  if not public.can_use(p_app) then raise exception 'Ask the owner for access to this app.' using errcode = '42501'; end if;
  if length(btrim(coalesce(p_reason, ''))) = 0 then raise exception 'Write a short reason for the owner.' using errcode = '22023'; end if;
  if (select count(*) from public.change_requests where requested_by = v_me and status = 'pending') >= 30 then
    raise exception 'You already have 30 changes waiting for the owner. Ask the owner to look at them first.' using errcode = '22023';
  end if;
  v_name := coalesce((select name from public.profiles where user_id = v_me), '');
  select coalesce(jsonb_object_agg(k, p_data -> k), '{}') into v_data from jsonb_object_keys(coalesce(p_data, '{}')) k where k = any(m.cols);
  if p_action <> 'add' then
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
  values (p_app, p_action, case when p_action = 'add' then null else p_target end, v_data, v_before,
          left(coalesce(p_summary, ''), 300), left(btrim(p_reason), 300), v_me, v_name)
  returning id into v_id;
  insert into public.notifications (user_id, kind, title, body, link)
  select p.user_id, 'change_request',
         v_name || ' asks to ' || case p_action when 'add' then 'add' when 'edit' then 'change' else 'remove' end || ' an older entry',
         left(coalesce(p_summary, '') || ' · ' || btrim(p_reason), 300), p_app || '/'
  from public.profiles p where p.is_owner;
  return v_id;
end $$;
revoke execute on function public.request_change(text, text, uuid, jsonb, text, text) from anon, public;
grant execute on function public.request_change(text, text, uuid, jsonb, text, text) to authenticated;

-- staff: take back a request the owner has not looked at yet
create function public.cancel_change_request(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.change_requests set status = 'cancelled', decided_at = now()
  where id = p_id and requested_by = (select auth.uid()) and status = 'pending';
  if not found then raise exception 'That request is no longer waiting.' using errcode = '22023'; end if;
end $$;
revoke execute on function public.cancel_change_request(uuid) from anon, public;
grant execute on function public.cancel_change_request(uuid) to authenticated;

-- owner: approve (make the change, in the staff member's name) or reject
create function public.decide_change_request(p_id uuid, p_approve boolean, p_note text default '') returns json
language plpgsql security definer set search_path = '' as $$
declare r public.change_requests; v_owner text; v_res uuid;
  v_claims text := coalesce(current_setting('request.jwt.claims', true), '');
  v_sub text := coalesce(current_setting('request.jwt.claim.sub', true), '');
begin
  if not public.is_owner() then raise exception 'Only the owner approves changes.' using errcode = '42501'; end if;
  select * into r from public.change_requests where id = p_id for update;
  if r.id is null then raise exception 'That request no longer exists.' using errcode = 'P0002'; end if;
  if r.status <> 'pending' then raise exception 'This request was already %.', r.status using errcode = '22023'; end if;
  v_owner := coalesce((select name from public.profiles where user_id = (select auth.uid())), '');
  if p_approve then
    if r.requested_by is null or not exists (select 1 from public.profiles where user_id = r.requested_by) then
      raise exception 'The person who asked has been removed, so the change can''t be made in their name. Reject it and make the change yourself.' using errcode = '22023';
    end if;
    -- the entry is added or changed as the staff member, so "entered by" stays theirs
    perform set_config('request.jwt.claims', jsonb_set(coalesce(nullif(v_claims, '')::jsonb, '{}'), '{sub}', to_jsonb(r.requested_by::text))::text, true);
    perform set_config('request.jwt.claim.sub', r.requested_by::text, true);
    v_res := public.apply_change(r.app, r.action, r.target_id, r.data);
    perform set_config('request.jwt.claims', v_claims, true);
    perform set_config('request.jwt.claim.sub', v_sub, true);
  end if;
  update public.change_requests set status = case when p_approve then 'approved' else 'rejected' end,
    decided_by_name = v_owner, decided_at = now(), decision_note = left(btrim(coalesce(p_note, '')), 300), result_id = v_res
  where id = p_id;
  if r.requested_by is not null then
    insert into public.notifications (user_id, kind, title, body, link)
    values (r.requested_by, 'change_decided',
            case when p_approve then v_owner || ' approved your change' else v_owner || ' did not approve your change' end,
            left(r.summary || case when btrim(coalesce(p_note, '')) <> '' then ' · ' || btrim(p_note) else '' end, 300), r.app || '/');
  end if;
  return json_build_object('status', case when p_approve then 'approved' else 'rejected' end, 'result_id', v_res);
end $$;
revoke execute on function public.decide_change_request(uuid, boolean, text) from anon, public;
grant execute on function public.decide_change_request(uuid, boolean, text) to authenticated;
