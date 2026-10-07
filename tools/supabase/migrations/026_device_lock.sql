-- Staff only on approved devices. Each browser keeps a random device key and sends it with every
-- request (header x-natraj-device). The owner approves a device (the shop computer) from that device;
-- only a hash of its key is stored. When the owner switches the lock on, people who are not owners
-- can read or change nothing unless the request comes from an approved device. Owners are never
-- limited. The public "Apply for leave" page (no sign-in) is not affected.
alter table public.settings add column device_lock boolean not null default false;

create table public.approved_devices (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 60),
  key_hash text not null unique,
  approved_by_name text not null default '',
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);
alter table public.approved_devices enable row level security;
create policy "owner sees devices" on public.approved_devices for select to authenticated using ((select public.is_owner()));
create policy "owner removes devices" on public.approved_devices for delete to authenticated using ((select public.is_owner()));
create policy "owner renames devices" on public.approved_devices for update to authenticated using ((select public.is_owner())) with check ((select public.is_owner()));
revoke all on public.approved_devices from anon;
revoke insert on public.approved_devices from authenticated;   -- added only through approve_this_device()

-- the hash of the key this request's browser sent, or null
create function public.device_key_hash() returns text
language sql stable set search_path = '' as $$
  select case when length(k) between 32 and 128 then encode(sha256(convert_to(k, 'UTF8')), 'hex') end
  from (select coalesce(current_setting('request.headers', true), '{}')::json ->> 'x-natraj-device' as k) h;
$$;

-- true when the lock is off, for owners, and for requests from an approved device
create function public.device_ok() returns boolean
language sql stable security definer set search_path = '' as $$
  select not coalesce((select device_lock from public.settings where id = 1), false)
      or coalesce((select is_owner from public.profiles where user_id = (select auth.uid())), false)
      or exists (select 1 from public.approved_devices where key_hash = public.device_key_hash());
$$;
revoke execute on function public.device_key_hash(), public.device_ok() from anon, public;
grant execute on function public.device_key_hash(), public.device_ok() to authenticated;

-- the access checks used by the rules and server functions now also need an allowed device
create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where user_id = (select auth.uid())) and public.device_ok();
$$;
create or replace function public.can_use(app text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select is_owner or app = any(apps) from public.profiles where user_id = (select auth.uid())), false) and public.device_ok();
$$;
create or replace function public.is_rate_assignee() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select rate_assignee = (select auth.uid()) from public.settings where id = 1), false) and public.device_ok();
$$;

-- and every table refuses everything from a device that is not allowed (a person's own profile row
-- stays readable, so the page can say why)
do $$
declare t text;
begin
  foreach t in array array['attendance','bank_accounts','bank_entries','campaign_contacts','campaign_costs','campaigns','chit_members','chit_payments','chit_plans',
    'customer_activity','customers','designs','designs_catalogue_unused','expenses','leave_requests','notifications','presence','rates','report_cards','settings',
    'silver_entries','staff','tasks','user_prefs','approved_devices'] loop
    execute format('create policy "approved device only" on public.%I as restrictive for all to authenticated using ((select public.device_ok())) with check ((select public.device_ok()))', t);
  end loop;
end $$;
create policy "approved device only" on public.profiles as restrictive for all to authenticated
  using ((select public.device_ok()) or user_id = (select auth.uid())) with check ((select public.device_ok()));
create policy "designs photos from approved devices only" on storage.objects as restrictive for all to authenticated
  using (bucket_id <> 'designs' or (select public.device_ok())) with check (bucket_id <> 'designs' or (select public.device_ok()));

-- what the page needs to know: is the lock on, and is this device approved (and under what name)
create function public.device_status() returns json
language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'locked', coalesce((select device_lock from public.settings where id = 1), false),
    'approved', exists (select 1 from public.approved_devices where key_hash = public.device_key_hash()),
    'name', (select name from public.approved_devices where key_hash = public.device_key_hash()),
    'has_key', public.device_key_hash() is not null,
    'ok', public.device_ok());
$$;
revoke execute on function public.device_status() from anon, public;
grant execute on function public.device_status() to authenticated;

-- the owner approves the device they are using now
create function public.approve_this_device(p_name text) returns json
language plpgsql security definer set search_path = '' as $$
declare v_hash text := public.device_key_hash(); v_name text := btrim(coalesce(p_name, ''));
begin
  if not coalesce((select is_owner from public.profiles where user_id = (select auth.uid())), false) then
    raise exception 'Only the owner can approve a device.' using errcode = '42501';
  end if;
  if v_hash is null then raise exception 'This browser did not send its device key. Reload the page and try again.' using errcode = '22023'; end if;
  if v_name = '' or length(v_name) > 60 then raise exception 'Give the device a name, e.g. Counter computer.' using errcode = '22023'; end if;
  insert into public.approved_devices (name, key_hash, approved_by_name)
  values (v_name, v_hash, coalesce((select name from public.profiles where user_id = (select auth.uid())), ''))
  on conflict (key_hash) do update set name = excluded.name;
  return public.device_status();
end $$;
revoke execute on function public.approve_this_device(text) from anon, public;
grant execute on function public.approve_this_device(text) to authenticated;

-- the once-a-minute check-in also notes an approved device being used, and flags a blocked one
create or replace function public.heartbeat(p_page text, p_device text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_me uuid := (select auth.uid()); v_ok boolean := public.device_ok();
begin
  if v_me is null or not exists (select 1 from public.profiles where user_id = v_me) then return; end if;
  update public.approved_devices set last_seen_at = now() where key_hash = public.device_key_hash();
  insert into public.presence as p (user_id, page, device, signed_in_at, last_seen, signed_out_at)
  values (v_me, left(case when v_ok then coalesce(p_page, '') else 'Not approved device' end, 40), left(coalesce(p_device, ''), 20), now(), now(), null)
  on conflict (user_id) do update set
    page = excluded.page, device = excluded.device, last_seen = now(), signed_out_at = null,
    signed_in_at = case when p.signed_out_at is not null or p.last_seen < now() - interval '10 minutes' then now() else p.signed_in_at end;
end $$;
