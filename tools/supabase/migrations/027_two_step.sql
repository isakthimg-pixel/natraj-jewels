-- Two-step sign-in. A person who has set up an authenticator app (Google Authenticator, Microsoft
-- Authenticator, ...) must also type its 6-digit code after the PIN. Until they do, their session is
-- only "first step" (aal1) and the database gives it nothing, exactly like an unapproved device. So a
-- guessed PIN alone is useless. Set up from People & settings; meant for owners.

-- true when this person has no authenticator set up, or has typed its code in this session
create function public.two_step_ok() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2'
      or not exists (select 1 from auth.mfa_factors where user_id = (select auth.uid()) and status = 'verified');
$$;
revoke execute on function public.two_step_ok() from anon, public;
grant execute on function public.two_step_ok() to authenticated;

-- device_ok() is the check behind every table's "approved device only" rule and the access helpers;
-- it now also needs the second step
create or replace function public.device_ok() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.two_step_ok() and (
         not coalesce((select device_lock from public.settings where id = 1), false)
      or coalesce((select is_owner from public.profiles where user_id = (select auth.uid())), false)
      or exists (select 1 from public.approved_devices where key_hash = public.device_key_hash()));
$$;

-- owner-only rules and functions also need it
create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select is_owner from public.profiles where user_id = (select auth.uid())), false) and public.two_step_ok();
$$;

create or replace function public.approve_this_device(p_name text) returns json
language plpgsql security definer set search_path = '' as $$
declare v_hash text := public.device_key_hash(); v_name text := btrim(coalesce(p_name, ''));
begin
  if not public.is_owner() then
    raise exception 'Only the owner can approve a device.' using errcode = '42501';
  end if;
  if v_hash is null then raise exception 'This browser did not send its device key. Reload the page and try again.' using errcode = '22023'; end if;
  if v_name = '' or length(v_name) > 60 then raise exception 'Give the device a name, e.g. Counter computer.' using errcode = '22023'; end if;
  insert into public.approved_devices (name, key_hash, approved_by_name)
  values (v_name, v_hash, coalesce((select name from public.profiles where user_id = (select auth.uid())), ''))
  on conflict (key_hash) do update set name = excluded.name;
  return public.device_status();
end $$;

-- which people have two-step sign-in on (shown to the owner in People & settings)
create function public.two_step_people() returns table (user_id uuid, since timestamptz)
language sql stable security definer set search_path = '' as $$
  select f.user_id, min(f.created_at) from auth.mfa_factors f
  where f.status = 'verified' and public.is_owner() group by f.user_id;
$$;
revoke execute on function public.two_step_people() from anon, public;
grant execute on function public.two_step_people() to authenticated;
