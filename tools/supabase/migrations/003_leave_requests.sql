-- Leave form (no sign-in needed): list of active staff, and sending a request.
create function public.leave_staff() returns table (id uuid, name text)
language sql stable security definer set search_path = '' as $$
  select id, name from public.staff where active order by name;
$$;

create function public.request_leave(p_staff uuid, p_from date, p_to date, p_half boolean, p_reason text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_to date := case when p_half then p_from else coalesce(p_to, p_from) end;
  v_id uuid;
begin
  if not exists (select 1 from public.staff where id = p_staff and active) then
    raise exception 'Choose your name.' using errcode = '22023';
  end if;
  if p_from is null or v_to < p_from then raise exception 'The last day is before the first day.' using errcode = '22023'; end if;
  if v_to - p_from > 60 then raise exception 'A request can be up to 60 days.' using errcode = '22023'; end if;
  if p_from < current_date - 60 or p_from > current_date + 366 then raise exception 'Choose dates within the next year.' using errcode = '22023'; end if;
  if (select count(*) from public.leave_requests where staff_id = p_staff and status = 'pending') >= 10 then
    raise exception 'There are already 10 requests waiting for this person.' using errcode = '22023';
  end if;
  insert into public.leave_requests (staff_id, from_day, to_day, half, reason)
    values (p_staff, p_from, v_to, coalesce(p_half, false), left(btrim(coalesce(p_reason, '')), 200))
    returning id into v_id;
  return v_id;
end $$;

grant execute on function public.leave_staff(), public.request_leave(uuid, date, date, boolean, text) to anon, authenticated;
