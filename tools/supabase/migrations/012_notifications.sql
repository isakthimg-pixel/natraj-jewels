-- Notifications shown in the bell and the bar at the top of every page.
-- Rows are written only by database triggers; each person sees, marks read and clears their own.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null default '',
  link text not null default '',          -- page to open, relative to the home page (e.g. 'todo/#all')
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;
create policy "see own" on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy "mark own read" on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "clear own" on public.notifications for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.notifications from anon;
revoke insert on public.notifications from authenticated;
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

-- When a task is ticked done:
--  * managers (everyone with the 'todo' app who is not an owner) and the person who gave the task
--    hear about it, except whoever ticked it;
--  * when that was the person's last open task, the owners hear that they finished everything.
create function public.notify_task_done() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_by uuid := (select auth.uid());
  v_who text := coalesce(nullif(new.done_by_name, ''), 'Someone');
  v_name text := coalesce(nullif(new.assigned_name, ''), v_who);
  v_today int;
begin
  if new.status <> 'done' or old.status = 'done' then return null; end if;

  insert into public.notifications (user_id, kind, title, body, link)
  select distinct p.user_id, 'task_done', v_who || ' completed a task', new.title, 'todo/#all'
  from public.profiles p
  where p.user_id is distinct from v_by
    and not p.is_owner
    and ('todo' = any(p.apps) or p.user_id = new.created_by);

  if new.assigned_to is not null and not exists (
       select 1 from public.tasks t where t.assigned_to = new.assigned_to and t.status = 'open') then
    select count(*) into v_today from public.tasks t
     where t.assigned_to = new.assigned_to and t.status = 'done'
       and (t.done_at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date;
    insert into public.notifications (user_id, kind, title, body, link)
    select p.user_id, 'tasks_all_done', v_name || ' finished all their tasks',
           v_today || ' done today. Last one: ' || new.title, 'todo/#all'
    from public.profiles p
    where p.is_owner and p.user_id is distinct from v_by and p.user_id is distinct from new.assigned_to;
  end if;
  return null;
end $$;
create trigger tasks_notify after update of status on public.tasks
  for each row execute function public.notify_task_done();
revoke execute on function public.notify_task_done() from anon, authenticated, public;
