-- Approve, decline or cancel a leave request.
-- Returns how many days were already marked as worked and were kept.
create or replace function public.decide_leave(p_id uuid, p_decision text) returns int
language plpgsql security definer set search_path = '' as $$
declare
  l public.leave_requests;
  d date;
  cur public.attendance;
  v_skipped int := 0;
  v_off int;
  v_who text;
begin
  if not public.can_use('attendance') then raise exception 'Sign in to decide leave.' using errcode = '42501'; end if;
  select * into l from public.leave_requests where id = p_id for update;
  if not found then raise exception 'That request no longer exists.' using errcode = '22023'; end if;
  select name into v_who from public.profiles where user_id = (select auth.uid());
  select weekly_off into v_off from public.settings where id = 1;

  if p_decision = 'approved' then
    if l.status <> 'pending' then raise exception 'This request was already decided.' using errcode = '22023'; end if;
    for d in select g::date from generate_series(l.from_day, l.to_day, interval '1 day') g loop
      continue when not l.half and extract(dow from d)::int = v_off;
      select * into cur from public.attendance where staff_id = l.staff_id and day = d;
      if found and cur.status is not null and cur.status not in ('A','LA','WO') and cur.leave_id is null then
        v_skipped := v_skipped + 1;
        continue;
      end if;
      insert into public.attendance (staff_id, day, status, note, leave_id)
        values (l.staff_id, d, case when l.half then 'H' else 'LA' end,
                left(case when l.reason <> '' then 'Leave: ' || l.reason else 'Leave approved' end, 200), l.id)
        on conflict (staff_id, day) do update set status = excluded.status, note = excluded.note, leave_id = excluded.leave_id;
    end loop;
  elsif p_decision = 'rejected' then
    if l.status <> 'pending' then raise exception 'This request was already decided.' using errcode = '22023'; end if;
  elsif p_decision = 'cancelled' then
    if l.status <> 'approved' then raise exception 'Only approved leave can be cancelled.' using errcode = '22023'; end if;
    delete from public.attendance where leave_id = l.id;
  else
    raise exception 'Unknown decision.' using errcode = '22023';
  end if;

  update public.leave_requests set status = p_decision, decided_by_name = coalesce(v_who, ''), decided_at = now() where id = l.id;
  return v_skipped;
end $$;

revoke execute on function public.decide_leave(uuid, text) from anon, public;
grant execute on function public.decide_leave(uuid, text) to authenticated;
