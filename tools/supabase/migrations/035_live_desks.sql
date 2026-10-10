-- Live shop desks: the owner assigns each of the three store computers in the Live shop (0 the front
-- computer by the gate, 1 the middle computer on the right, 2 the back computer in the corner) to a
-- real approved device. "Who is online" now also records which approved device a person is using, so
-- the Live shop seats them at that computer's desk.
alter table public.approved_devices
  add column live_desk smallint check (live_desk between 0 and 2);
create unique index approved_devices_live_desk on public.approved_devices (live_desk) where live_desk is not null;

alter table public.presence
  add column device_id uuid references public.approved_devices(id) on delete set null;
create index presence_device_idx on public.presence (device_id);

-- the check-in also notes the approved device it came from
create or replace function public.heartbeat(p_page text, p_device text)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_me uuid := (select auth.uid()); v_ok boolean := public.device_ok();
  v_dev uuid := (select id from public.approved_devices where key_hash = public.device_key_hash());
begin
  if v_me is null or not exists (select 1 from public.profiles where user_id = v_me) then return; end if;
  update public.approved_devices set last_seen_at = now() where id = v_dev;
  insert into public.presence as p (user_id, page, device, device_id, signed_in_at, last_seen, signed_out_at)
  values (v_me, left(case when v_ok then coalesce(p_page, '') else 'Not approved device' end, 40), left(coalesce(p_device, ''), 20), v_dev, now(), now(), null)
  on conflict (user_id) do update set
    page = excluded.page, device = excluded.device, device_id = excluded.device_id, last_seen = now(), signed_out_at = null,
    signed_in_at = case when p.signed_out_at is not null or p.last_seen < now() - interval '10 minutes' then now() else p.signed_in_at end;
end $$;

-- the owner gives a desk to a device (null takes it away); a desk belongs to one device at a time
create function public.set_live_desk(p_device uuid, p_desk int) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_owner() then raise exception 'Only the owner can do this.' using errcode = '42501'; end if;
  if p_desk is not null and (p_desk < 0 or p_desk > 2) then raise exception 'Choose one of the three store computers.' using errcode = '22023'; end if;
  if not exists (select 1 from public.approved_devices where id = p_device) then raise exception 'That device is no longer approved.' using errcode = 'P0002'; end if;
  if p_desk is not null then update public.approved_devices set live_desk = null where live_desk = p_desk and id <> p_device; end if;
  update public.approved_devices set live_desk = p_desk where id = p_device;
end $$;
revoke execute on function public.set_live_desk(uuid, int) from anon, public;
grant execute on function public.set_live_desk(uuid, int) to authenticated;
