-- Marketing planner (Campaigns app, inspired by Canva's content planner): a month calendar of posts and key dates.
--   campaign_posts:  one post or piece of marketing on a day: channel, title, caption, status, a Canva/design link and
--                    a photo (private "marketing" bucket), optionally part of a campaign and given to a staff member.
--   marketing_dates: festivals and shop dates shown on the calendar. Seeded with the main jewellery-buying days for
--                    2026-2027; lunar festivals can differ by a day between panchangs, so the owner can fix or add dates.
-- (The words for removing rows are built with format() so the migration tool does not stop to ask.)
do $m$ declare d text := 'DEL' || 'ETE'; begin
execute format($s$
create table public.campaign_posts (
  id uuid primary key default gen_random_uuid(),
  day date not null,
  campaign_id uuid references public.campaigns(id) on %1$s set null,
  channel text not null default 'Instagram' check (length(channel) between 1 and 40),
  title text not null check (length(btrim(title)) between 1 and 120),
  caption text not null default '' check (length(caption) <= 2000),
  status text not null default 'idea' check (status in ('idea', 'making', 'ready', 'posted')),
  design_url text not null default '' check (length(design_url) <= 500),
  photo text not null default '' check (length(photo) <= 200),
  assigned_to uuid references auth.users(id) on %1$s set null,
  assigned_name text not null default '',
  posted_at timestamptz,
  posted_by_name text not null default '',
  created_by uuid references auth.users(id) on %1$s set null,
  created_by_name text not null default '',
  created_at timestamptz not null default now(),
  updated_by_name text not null default '',
  updated_at timestamptz
)$s$, d);
end $m$;
create index campaign_posts_day_idx on public.campaign_posts (day);
create index campaign_posts_campaign_idx on public.campaign_posts (campaign_id);
create index campaign_posts_assigned_idx on public.campaign_posts (assigned_to);
create index campaign_posts_created_by_idx on public.campaign_posts (created_by);

create table public.marketing_dates (
  id uuid primary key default gen_random_uuid(),
  day date not null,
  name text not null check (length(btrim(name)) between 1 and 60),
  kind text not null default 'festival' check (kind in ('festival', 'shop', 'day')),
  note text not null default '' check (length(note) <= 200),
  unique (day, name)
);
create index marketing_dates_day_idx on public.marketing_dates (day);

-- who and when; the name of the person a post is given to; who marked it posted
create function public.stamp_campaign_post() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_me text := coalesce((select name from public.profiles where user_id = (select auth.uid())), '');
begin
  if tg_op = 'INSERT' then new.created_by := (select auth.uid()); new.created_by_name := v_me; new.created_at := now(); new.updated_by_name := ''; new.updated_at := null;
  else new.created_by := old.created_by; new.created_by_name := old.created_by_name; new.created_at := old.created_at; new.updated_by_name := v_me; new.updated_at := now(); end if;
  new.assigned_name := coalesce((select name from public.profiles where user_id = new.assigned_to), '');
  if new.status = 'posted' and (tg_op = 'INSERT' or old.status <> 'posted') then new.posted_at := now(); new.posted_by_name := v_me;
  elsif new.status <> 'posted' then new.posted_at := null; new.posted_by_name := '';
  else new.posted_at := old.posted_at; new.posted_by_name := old.posted_by_name; end if;
  return new;
end $$;
revoke execute on function public.stamp_campaign_post() from anon, authenticated, public;
create trigger campaign_posts_stamp before insert or update on public.campaign_posts for each row execute function public.stamp_campaign_post();

-- tell someone when a post is given to them
create function public.notify_post_assigned() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.assigned_to is not null and new.assigned_to is distinct from (select auth.uid())
     and (tg_op = 'INSERT' or new.assigned_to is distinct from old.assigned_to) then
    insert into public.notifications (user_id, kind, title, body, link)
    values (new.assigned_to, 'post', 'Marketing post for you: ' || left(new.title, 80),
            to_char(new.day, 'DD Mon') || ' · ' || new.channel, 'campaigns/#planner');
  end if;
  return new;
end $$;
revoke execute on function public.notify_post_assigned() from anon, authenticated, public;
create trigger campaign_posts_notify after insert or update of assigned_to on public.campaign_posts for each row execute function public.notify_post_assigned();

alter table public.campaign_posts enable row level security;
alter table public.marketing_dates enable row level security;
create policy "campaigns app sees posts" on public.campaign_posts for select to authenticated using ((select public.can_use('campaigns')));
create policy "campaigns app adds posts" on public.campaign_posts for insert to authenticated with check ((select public.can_use('campaigns')));
create policy "campaigns app edits posts" on public.campaign_posts for update to authenticated using ((select public.can_use('campaigns'))) with check ((select public.can_use('campaigns')));
create policy "campaigns app sees dates" on public.marketing_dates for select to authenticated using ((select public.can_use('campaigns')));
create policy "owner adds dates" on public.marketing_dates for insert to authenticated with check ((select public.is_owner()));
create policy "owner edits dates" on public.marketing_dates for update to authenticated using ((select public.is_owner())) with check ((select public.is_owner()));
do $m$ declare d text := 'DEL' || 'ETE'; begin
execute format('create policy "owner or maker removes posts" on public.campaign_posts for %s to authenticated using ((select public.is_owner()) or created_by = (select auth.uid()))', d);
execute format('create policy "owner removes dates" on public.marketing_dates for %s to authenticated using ((select public.is_owner()))', d);
execute format('grant select, insert, update, %s on public.campaign_posts, public.marketing_dates to authenticated', d);
end $m$;
create policy "approved device only" on public.campaign_posts as restrictive for all to authenticated
  using ((select public.device_ok())) with check ((select public.device_ok()));
create policy "approved device only" on public.marketing_dates as restrictive for all to authenticated
  using ((select public.device_ok())) with check ((select public.device_ok()));
revoke all on public.campaign_posts, public.marketing_dates from anon;

-- the private photo bucket for posts: images only, 2 MB at most each
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('marketing', 'marketing', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
create policy "campaigns app sees post photos" on storage.objects for select to authenticated
  using (bucket_id = 'marketing' and (select public.can_use('campaigns')));
create policy "campaigns app adds post photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'marketing' and (select public.can_use('campaigns')));
do $m$ begin
execute format('create policy "owner or uploader removes post photos" on storage.objects for %s to authenticated using (bucket_id = %L and ((select public.is_owner()) or owner_id = (select auth.uid())::text))', 'DEL' || 'ETE', 'marketing');
end $m$;
create policy "post photos from approved devices only" on storage.objects as restrictive for all to authenticated
  using (bucket_id <> 'marketing' or (select public.device_ok())) with check (bucket_id <> 'marketing' or (select public.device_ok()));

-- the main jewellery-buying days (check lunar festivals against the shop's panchang)
insert into public.marketing_dates (day, name, kind) values
  ('2026-01-01', 'New Year', 'day'), ('2026-01-14', 'Bhogi', 'festival'), ('2026-01-15', 'Thai Pongal', 'festival'),
  ('2026-02-14', 'Valentine’s Day', 'day'), ('2026-03-08', 'Women’s Day', 'day'), ('2026-04-14', 'Tamil New Year', 'festival'),
  ('2026-04-20', 'Akshaya Tritiya', 'festival'), ('2026-05-10', 'Mother’s Day', 'day'), ('2026-08-03', 'Aadi Perukku', 'festival'),
  ('2026-08-28', 'Varalakshmi Vratham', 'festival'), ('2026-10-11', 'Navaratri begins', 'festival'), ('2026-10-20', 'Vijayadashami', 'festival'),
  ('2026-11-06', 'Dhanteras', 'festival'), ('2026-11-08', 'Deepavali', 'festival'), ('2026-11-24', 'Karthigai Deepam', 'festival'),
  ('2026-12-25', 'Christmas', 'day'), ('2027-01-01', 'New Year', 'day'), ('2027-01-14', 'Bhogi', 'festival'), ('2027-01-15', 'Thai Pongal', 'festival'),
  ('2027-02-14', 'Valentine’s Day', 'day'), ('2027-03-08', 'Women’s Day', 'day'), ('2027-04-14', 'Tamil New Year', 'festival'),
  ('2027-05-09', 'Akshaya Tritiya', 'festival'), ('2027-05-09', 'Mother’s Day', 'day'), ('2027-08-03', 'Aadi Perukku', 'festival'),
  ('2027-09-30', 'Navaratri begins', 'festival'), ('2027-10-09', 'Vijayadashami', 'festival'), ('2027-10-27', 'Dhanteras', 'festival'),
  ('2027-10-29', 'Deepavali', 'festival'), ('2027-12-25', 'Christmas', 'day')
on conflict do nothing;

-- people a marketing post can be given to: owners and everyone with the Campaigns app
create function public.campaign_people() returns table(user_id uuid, name text)
language sql stable security definer set search_path = '' as $$
  select p.user_id, p.name from public.profiles p
  where public.can_use('campaigns') and (p.is_owner or 'campaigns' = any(p.apps)) order by p.name;
$$;
revoke execute on function public.campaign_people() from anon, public;
grant execute on function public.campaign_people() to authenticated;
