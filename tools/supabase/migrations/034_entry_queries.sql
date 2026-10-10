-- Queries on entries: the owner asks about an entry (an expense, a bank entry, a silver sale or purchase,
-- a chit payment); the staff member who made it is told and writes an explanation; the two can go back
-- and forth; when the owner is satisfied they close it. The conversation is kept with the query.
-- Everything is done through the functions below; people read only their own queries (the owner reads all).
create table public.entry_queries (
  id uuid primary key default gen_random_uuid(),
  app text not null check (app in ('expenses', 'banking', 'silver', 'chits')),
  target_id uuid not null,
  summary text not null default '' check (length(summary) <= 300),
  asked_of uuid references auth.users(id) on delete set null,
  asked_of_name text not null default '',
  status text not null default 'open' check (status in ('open', 'answered', 'closed')),  -- open: waiting for the staff member; answered: waiting for the owner
  messages jsonb not null default '[]',             -- [{by, by_name, owner, body, at}]
  created_by uuid references auth.users(id) on delete set null,
  created_by_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  closed_by_name text not null default ''
);
create index entry_queries_target_idx on public.entry_queries (app, target_id);
create index entry_queries_asked_idx on public.entry_queries (asked_of, status);
create unique index entry_queries_one_live on public.entry_queries (app, target_id) where status <> 'closed';

alter table public.entry_queries enable row level security;
create policy "owner or the person asked sees queries" on public.entry_queries for select to authenticated
  using ((select public.is_owner()) or asked_of = (select auth.uid()));
create policy "approved device only" on public.entry_queries as restrictive for all to authenticated
  using ((select public.device_ok())) with check ((select public.device_ok()));
revoke all on public.entry_queries from anon;
revoke all on public.entry_queries from authenticated;
grant select on public.entry_queries to authenticated;

create function public.query_link(p_app text, p_id uuid) returns text
language sql immutable set search_path = '' as $$
  select (case p_app when 'banking' then 'banking/' when 'silver' then 'silver/' when 'chits' then 'chits/' else 'expenses/' end) || '#q=' || p_id;
$$;

-- the owner asks the person who made the entry
create function public.ask_query(p_app text, p_target uuid, p_question text, p_summary text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare m record; v_me uuid := (select auth.uid()); v_name text; v_row jsonb; v_who uuid; v_id uuid; v_q text := btrim(coalesce(p_question, ''));
begin
  if not public.device_ok() then raise exception 'This device is not approved.' using errcode = '42501'; end if;
  if not public.is_owner() then raise exception 'Only the owner can raise a query.' using errcode = '42501'; end if;
  select * into m from public.change_target(p_app);
  if m.tbl is null then raise exception 'Unknown app.' using errcode = '22023'; end if;
  if length(v_q) < 1 or length(v_q) > 500 then raise exception 'Write your question (up to 500 letters).' using errcode = '22023'; end if;
  execute format('select to_jsonb(t) from public.%I t where id = $1', m.tbl) into v_row using p_target;
  if v_row is null then raise exception 'That entry no longer exists.' using errcode = 'P0002'; end if;
  v_who := (v_row ->> 'created_by')::uuid;
  if v_who is null or not exists (select 1 from public.profiles where user_id = v_who) then raise exception 'The person who made this entry no longer has an account.' using errcode = '22023'; end if;
  if v_who = v_me then raise exception 'You made this entry yourself.' using errcode = '22023'; end if;
  if exists (select 1 from public.entry_queries where app = p_app and target_id = p_target and status <> 'closed') then
    raise exception 'There is already an open query on this entry.' using errcode = '23505';
  end if;
  v_name := coalesce((select name from public.profiles where user_id = v_me), '');
  insert into public.entry_queries (app, target_id, summary, asked_of, asked_of_name, messages, created_by, created_by_name)
  values (p_app, p_target, left(coalesce(p_summary, ''), 300), v_who, coalesce((select name from public.profiles where user_id = v_who), ''),
    jsonb_build_array(jsonb_build_object('by', v_me, 'by_name', v_name, 'owner', true, 'body', v_q, 'at', now())), v_me, v_name)
  returning id into v_id;
  insert into public.notifications (user_id, kind, title, body, link)
  values (v_who, 'query', v_name || ' has a question about your entry', left(coalesce(p_summary, '') || ': ' || v_q, 300), public.query_link(p_app, v_id));
  return v_id;
end $$;

-- the person asked explains; the owner can reply (which reopens a closed query)
create function public.reply_query(p_id uuid, p_body text) returns void
language plpgsql security definer set search_path = '' as $$
declare q public.entry_queries; v_me uuid := (select auth.uid()); v_name text; v_owner boolean := public.is_owner(); v_b text := btrim(coalesce(p_body, ''));
begin
  if not public.device_ok() then raise exception 'This device is not approved.' using errcode = '42501'; end if;
  select * into q from public.entry_queries where id = p_id for update;
  if q.id is null then raise exception 'That query no longer exists.' using errcode = 'P0002'; end if;
  if length(v_b) < 1 or length(v_b) > 500 then raise exception 'Write a message (up to 500 letters).' using errcode = '22023'; end if;
  if jsonb_array_length(q.messages) >= 40 then raise exception 'This conversation is too long. Close it and raise a new query.' using errcode = '22023'; end if;
  v_name := coalesce((select name from public.profiles where user_id = v_me), '');
  if v_owner then
    update public.entry_queries set messages = messages || jsonb_build_array(jsonb_build_object('by', v_me, 'by_name', v_name, 'owner', true, 'body', v_b, 'at', now())),
      status = 'open', updated_at = now(), closed_at = null, closed_by_name = '' where id = p_id;
    if q.asked_of is not null then
      insert into public.notifications (user_id, kind, title, body, link)
      values (q.asked_of, 'query', v_name || ' replied to the query', left(q.summary || ': ' || v_b, 300), public.query_link(q.app, q.id));
    end if;
  elsif q.asked_of = v_me then
    if q.status = 'closed' then raise exception 'The owner has closed this query.' using errcode = '22023'; end if;
    update public.entry_queries set messages = messages || jsonb_build_array(jsonb_build_object('by', v_me, 'by_name', v_name, 'owner', false, 'body', v_b, 'at', now())),
      status = 'answered', updated_at = now() where id = p_id;
    insert into public.notifications (user_id, kind, title, body, link)
    select p.user_id, 'query', v_name || ' answered your query', left(q.summary || ': ' || v_b, 300), public.query_link(q.app, q.id)
    from public.profiles p where p.is_owner;
  else
    raise exception 'This query is not for you.' using errcode = '42501';
  end if;
end $$;

-- the owner is satisfied
create function public.close_query(p_id uuid, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare q public.entry_queries; v_me uuid := (select auth.uid()); v_name text; v_n text := btrim(coalesce(p_note, ''));
begin
  if not public.device_ok() then raise exception 'This device is not approved.' using errcode = '42501'; end if;
  if not public.is_owner() then raise exception 'Only the owner can close a query.' using errcode = '42501'; end if;
  select * into q from public.entry_queries where id = p_id for update;
  if q.id is null then raise exception 'That query no longer exists.' using errcode = 'P0002'; end if;
  if q.status = 'closed' then return; end if;
  v_name := coalesce((select name from public.profiles where user_id = v_me), '');
  update public.entry_queries set status = 'closed', closed_at = now(), closed_by_name = v_name, updated_at = now(),
    messages = case when v_n = '' then messages else messages || jsonb_build_array(jsonb_build_object('by', v_me, 'by_name', v_name, 'owner', true, 'body', left(v_n, 500), 'at', now())) end
  where id = p_id;
  if q.asked_of is not null then
    insert into public.notifications (user_id, kind, title, body, link)
    values (q.asked_of, 'query', 'Query closed: ' || v_name || ' is okay with it', left(q.summary || case when v_n = '' then '' else ': ' || v_n end, 300), public.query_link(q.app, q.id));
  end if;
end $$;

revoke execute on function public.ask_query(text, uuid, text, text), public.reply_query(uuid, text), public.close_query(uuid, text) from anon, public;
grant execute on function public.ask_query(text, uuid, text, text), public.reply_query(uuid, text), public.close_query(uuid, text) to authenticated;
revoke execute on function public.query_link(text, uuid) from anon, public;
