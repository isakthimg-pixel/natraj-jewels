-- When the owner switches it on (settings.signin_limit, in People & settings), staff sign in only during shop hours, and only when marked present today (Present, Shop work, Thottam,
-- Home or Half day). Staff with the Attendance app may sign in during hours before they are marked, so
-- they can mark everyone. Someone who was let in today may finish their work after closing (the day is
-- noted on their profile, profiles.signin_day); the next day the rule applies again. The owner is never limited.
-- work_ok() is part of device_ok(), the check behind every table's rule, so the limit holds everywhere.
-- login_check() tells the page why someone cannot sign in; the "who is online" check-in notes the day.
alter table public.profiles add column signin_day date;
alter table public.settings add column signin_limit boolean not null default false;

create function public.work_ok() returns boolean
language sql stable security definer set search_path = '' as $$
  with p as (select * from public.profiles where user_id = (select auth.uid())),
       s as (select coalesce(shop_opens, '10:00') o, coalesce(shop_closes, '20:30') c, signin_limit l from public.settings where id = 1),
       n as (select (now() at time zone 'Asia/Kolkata')::date d, (now() at time zone 'Asia/Kolkata')::time t)
  select coalesce((select p.is_owner or not s.l or p.signin_day = n.d
      or (n.t >= s.o and n.t < s.c and ('attendance' = any(p.apps)
          or exists (select 1 from public.attendance a where a.staff_id = p.staff_id and a.day = n.d and a.status in ('P', 'SW', 'T', 'HM', 'H'))))
    from p, s, n), false);
$$;
revoke execute on function public.work_ok() from anon, public;
grant execute on function public.work_ok() to authenticated;

create function public.login_check() returns json
language plpgsql security definer set search_path = '' as $$
declare p public.profiles; s public.settings; v_today date := (now() at time zone 'Asia/Kolkata')::date; v_st text; v_markers text;
begin
  select * into p from public.profiles where user_id = (select auth.uid());
  if p.user_id is null then return json_build_object('ok', false, 'reason', 'This sign-in is not set up. Ask the owner.'); end if;
  if public.work_ok() then
    if not p.is_owner and p.signin_day is distinct from v_today then update public.profiles set signin_day = v_today where user_id = p.user_id; end if;
    return json_build_object('ok', true);
  end if;
  select * into s from public.settings where id = 1;
  select status into v_st from public.attendance where staff_id = p.staff_id and day = v_today;
  select string_agg(name, ', ' order by name) into v_markers from public.profiles where not is_owner and 'attendance' = any(apps);
  return json_build_object('ok', false, 'reason',
    case when (now() at time zone 'Asia/Kolkata')::time < s.shop_opens or (now() at time zone 'Asia/Kolkata')::time >= s.shop_closes
           then 'The shop is closed now. Staff can sign in from ' || to_char(s.shop_opens, 'FMHH12:MI') || ' am to ' || to_char(s.shop_closes, 'FMHH12:MI') || ' pm.'
         when v_st in ('A', 'LA', 'WO') then 'You are marked ' || case v_st when 'A' then 'absent' when 'LA' then 'on leave' else 'on week off' end || ' today, so you cannot sign in.'
         else 'Your attendance is not marked yet today. Ask ' || coalesce(v_markers || ' or the owner', 'the owner') || ' to mark you present, then sign in again.' end);
end $$;
revoke execute on function public.login_check() from anon, public;
grant execute on function public.login_check() to authenticated;

create or replace function public.device_ok() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.two_step_ok() and public.work_ok() and (
         not coalesce((select device_lock from public.settings where id = 1), false)
      or coalesce((select is_owner from public.profiles where user_id = (select auth.uid())), false)
      or exists (select 1 from public.approved_devices where key_hash = public.device_key_hash()));
$$;

-- the "who is online" check-in (every few minutes from any open page) also notes the day for someone let in
create or replace function public.heartbeat(p_page text, p_device text)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_me uuid := (select auth.uid()); v_ok boolean := public.device_ok();
  v_dev uuid := (select id from public.approved_devices where key_hash = public.device_key_hash());
begin
  if v_me is null or not exists (select 1 from public.profiles where user_id = v_me) then return; end if;
  if v_ok then update public.profiles set signin_day = (now() at time zone 'Asia/Kolkata')::date
    where user_id = v_me and not is_owner and signin_day is distinct from (now() at time zone 'Asia/Kolkata')::date; end if;
  update public.approved_devices set last_seen_at = now() where id = v_dev;
  insert into public.presence as p (user_id, page, device, device_id, signed_in_at, last_seen, signed_out_at)
  values (v_me, left(case when v_ok then coalesce(p_page, '') when not public.work_ok() then 'Not allowed now' else 'Not approved device' end, 40), left(coalesce(p_device, ''), 20), v_dev, now(), now(), null)
  on conflict (user_id) do update set
    page = excluded.page, device = excluded.device, device_id = excluded.device_id, last_seen = now(), signed_out_at = null,
    signed_in_at = case when p.signed_out_at is not null or p.last_seen < now() - interval '10 minutes' then now() else p.signed_in_at end;
end $$;
