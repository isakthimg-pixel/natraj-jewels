-- One named person updates the gold & silver rate every day, by a set time.
alter table public.settings
  add column rate_assignee uuid references public.profiles(user_id) on delete set null,
  add column rate_assignee_name text not null default '',
  add column rate_due time not null default '10:30';

create function public.is_rate_assignee() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select rate_assignee = (select auth.uid()) from public.settings where id = 1), false);
$$;
revoke execute on function public.is_rate_assignee() from anon, public;
grant execute on function public.is_rate_assignee() to authenticated;

create policy "assigned person adds rates" on public.rates for insert to authenticated
  with check ((select public.is_rate_assignee()));
