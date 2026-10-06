-- To-do list: tasks given to people who sign in.
-- People with the 'todo' app (and owners) create and assign tasks and see them all;
-- everyone sees the tasks given to them and can mark them done.
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 1 and 120),
  details text not null default '' check (length(details) <= 1000),
  assigned_to uuid references public.profiles(user_id) on delete set null,
  assigned_name text not null default '',
  due date,
  high boolean not null default false,
  status text not null default 'open' check (status in ('open', 'done')),
  done_note text not null default '' check (length(done_note) <= 300),
  done_at timestamptz,
  done_by_name text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_by_name text not null default '',
  created_at timestamptz not null default now()
);
create index tasks_assigned_idx on public.tasks (assigned_to, status);
create index tasks_status_due_idx on public.tasks (status, due);
create index tasks_created_by_idx on public.tasks (created_by);

-- Fill in names and times; people who only do the task may change just its status and note.
create function public.stamp_task() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_me text := coalesce((select name from public.profiles where user_id = (select auth.uid())), '');
begin
  if tg_op = 'INSERT' then
    new.created_by := (select auth.uid());
    new.created_by_name := v_me;
    new.created_at := now();
  else
    new.created_by := old.created_by; new.created_by_name := old.created_by_name; new.created_at := old.created_at;
    if not public.can_use('todo') and (
         new.title is distinct from old.title or new.details is distinct from old.details or
         new.assigned_to is distinct from old.assigned_to or new.due is distinct from old.due or new.high is distinct from old.high) then
      raise exception 'Only the person who assigns tasks can change this.' using errcode = '42501';
    end if;
  end if;
  new.assigned_name := coalesce((select name from public.profiles where user_id = new.assigned_to), '');
  if new.status = 'done' and (tg_op = 'INSERT' or old.status <> 'done') then
    new.done_at := now(); new.done_by_name := v_me;
  elsif new.status = 'open' then
    new.done_at := null; new.done_by_name := '';
  end if;
  return new;
end $$;
create trigger tasks_stamp before insert or update on public.tasks for each row execute function public.stamp_task();
revoke execute on function public.stamp_task() from anon, authenticated, public;

alter table public.tasks enable row level security;
create policy "see own or all if assigner" on public.tasks for select to authenticated
  using ((select public.can_use('todo')) or assigned_to = (select auth.uid()) or created_by = (select auth.uid()));
create policy "assigners add tasks" on public.tasks for insert to authenticated
  with check ((select public.can_use('todo')));
create policy "assigners and assignees update" on public.tasks for update to authenticated
  using ((select public.can_use('todo')) or assigned_to = (select auth.uid()))
  with check ((select public.can_use('todo')) or assigned_to = (select auth.uid()));
create policy "owner or creator removes" on public.tasks for delete to authenticated
  using ((select public.is_owner()) or ((select public.can_use('todo')) and created_by = (select auth.uid())));
revoke all on public.tasks from anon;

-- People a task can be given to (only for those who assign tasks).
create function public.assignable_people() returns table (user_id uuid, name text)
language sql stable security definer set search_path = '' as $$
  select p.user_id, p.name from public.profiles p where public.can_use('todo') order by p.name;
$$;
revoke execute on function public.assignable_people() from anon, public;
grant execute on function public.assignable_people() to authenticated;
