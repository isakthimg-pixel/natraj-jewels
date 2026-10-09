-- Which web address each device was approved at. A browser keeps its device key per address, so the same
-- computer opened at another address looks like a new device; the blocked screen can now say which
-- address to use. (approve_this_device gets a second parameter, the address; device_status lists them.)
alter table public.approved_devices add column site text not null default '' check (length(site) <= 120);

create function public.approve_this_device(p_name text, p_site text) returns json
language plpgsql security definer set search_path = '' as $$
declare v_hash text := public.device_key_hash(); v_name text := btrim(coalesce(p_name, '')); v_site text := left(btrim(coalesce(p_site, '')), 120);
begin
  if not public.is_owner() then
    raise exception 'Only the owner can approve a device.' using errcode = '42501';
  end if;
  if v_hash is null then raise exception 'This browser did not send its device key. Reload the page and try again.' using errcode = '22023'; end if;
  if v_name = '' or length(v_name) > 60 then raise exception 'Give the device a name, e.g. Counter computer.' using errcode = '22023'; end if;
  insert into public.approved_devices (name, key_hash, approved_by_name, site)
  values (v_name, v_hash, coalesce((select name from public.profiles where user_id = (select auth.uid())), ''), v_site)
  on conflict (key_hash) do update set name = excluded.name, site = case when excluded.site <> '' then excluded.site else public.approved_devices.site end;
  return public.device_status();
end $$;
revoke execute on function public.approve_this_device(text, text) from anon, public;
grant execute on function public.approve_this_device(text, text) to authenticated;

create or replace function public.device_status() returns json
language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'locked', coalesce((select device_lock from public.settings where id = 1), false),
    'approved', exists (select 1 from public.approved_devices where key_hash = public.device_key_hash()),
    'name', (select name from public.approved_devices where key_hash = public.device_key_hash()),
    'has_key', public.device_key_hash() is not null,
    'ok', public.device_ok(),
    'sites', coalesce((select json_agg(distinct site) from public.approved_devices where site <> ''), '[]'::json));
$$;
