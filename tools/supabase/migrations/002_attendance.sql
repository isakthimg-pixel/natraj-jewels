-- Attendance app: one row per staff member per day, and leave requests.

create table public.attendance (
  staff_id uuid not null references public.staff(id) on delete cascade,
  day date not null,
  status text check (status in ('P','HM','T','H','A','LA','WO')),
  note text not null default '' check (length(note) <= 200),
  leave_id uuid,
  marked_by uuid references auth.users(id) on delete set null,
  marked_by_name text not null default '',
  marked_at timestamptz not null default now(),
  primary key (staff_id, day)
);
create index attendance_day_idx on public.attendance (day);
create index attendance_leave_idx on public.attendance (leave_id) where leave_id is not null;

create table public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete cascade,
  from_day date not null,
  to_day date not null,
  half boolean not null default false,
  reason text not null default '' check (length(reason) <= 200),
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  created_at timestamptz not null default now(),
  decided_by_name text not null default '',
  decided_at timestamptz,
  check (to_day >= from_day),
  check (to_day - from_day <= 60),
  check (not half or from_day = to_day)
);
create index leave_requests_staff_idx on public.leave_requests (staff_id);
create index leave_requests_status_idx on public.leave_requests (status, from_day);

-- Record who made each change. A status changed by hand is no longer tied to a leave request.
create function public.stamp_attendance() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.marked_by := (select auth.uid());
  new.marked_by_name := coalesce((select name from public.profiles where user_id = (select auth.uid())), '');
  new.marked_at := now();
  if tg_op = 'UPDATE' and new.status is distinct from old.status and new.leave_id is not distinct from old.leave_id then
    new.leave_id := null;
  end if;
  return new;
end $$;
create trigger attendance_stamp before insert or update on public.attendance
  for each row execute function public.stamp_attendance();
revoke execute on function public.stamp_attendance() from anon, authenticated, public;

alter table public.attendance enable row level security;
alter table public.leave_requests enable row level security;

create policy "attendance users read" on public.attendance for select to authenticated using ((select public.can_use('attendance')));
create policy "attendance users add" on public.attendance for insert to authenticated with check ((select public.can_use('attendance')));
create policy "attendance users edit" on public.attendance for update to authenticated using ((select public.can_use('attendance'))) with check ((select public.can_use('attendance')));
create policy "attendance users clear" on public.attendance for delete to authenticated using ((select public.can_use('attendance')));

create policy "attendance users read leave" on public.leave_requests for select to authenticated using ((select public.can_use('attendance')));
create policy "owner deletes leave" on public.leave_requests for delete to authenticated using ((select public.is_owner()));

revoke all on public.attendance, public.leave_requests from anon;
