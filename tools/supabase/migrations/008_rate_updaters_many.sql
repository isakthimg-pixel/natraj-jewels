-- The daily rate can be updated by any number of people: everyone with the 'rates' app.
-- Move the single assigned person (if any) onto that list, then stop using the single slot.
update public.profiles
   set apps = array_append(apps, 'rates')
 where user_id = (select rate_assignee from public.settings where id = 1)
   and not ('rates' = any(apps));
update public.settings set rate_assignee = null, rate_assignee_name = '' where id = 1;

-- Names of the people who update the rate (owners can too, but are not listed).
create function public.rate_updaters() returns table (name text)
language sql stable security definer set search_path = '' as $$
  select name from public.profiles where not is_owner and 'rates' = any(apps) order by name;
$$;
revoke execute on function public.rate_updaters() from anon, public;
grant execute on function public.rate_updaters() to authenticated;
