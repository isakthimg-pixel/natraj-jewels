-- Repairs & orders: jewellery a customer leaves for repair, and new pieces ordered to be made.
-- Each job gets a number (J-1001...) and moves Received -> With karigar -> Ready -> Delivered (or
-- Cancelled). It keeps what came in (item, metal, weight, photos), the work to do, the promised date,
-- the estimate, the advance, who made it (karigar), the weight and final amount when ready, and how the
-- balance was paid on delivery. Everyone with the 'jobs' app works on jobs; only the owner deletes.
-- Whoever took the job is told when it is ready. Photos live in the private storage bucket "jobs".
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  job_no bigint generated always as identity (start with 1001),
  kind text not null check (kind in ('repair', 'order')),
  status text not null default 'received' check (status in ('received', 'karigar', 'ready', 'delivered', 'cancelled')),
  customer_id uuid references public.customers(id) on delete set null,
  customer_name text not null check (length(btrim(customer_name)) between 1 and 80),
  customer_phone text not null default '' check (customer_phone ~ '^[0-9+ ]{0,20}$'),
  item text not null check (length(btrim(item)) between 1 and 80),
  metal text not null default 'Gold' check (metal in ('Gold', 'Silver', 'Other')),
  work text not null default '' check (length(work) <= 500),
  weight_in numeric(10,3) check (weight_in is null or (weight_in > 0 and weight_in < 100000)),
  photos text[] not null default '{}',
  due date,
  estimate numeric(12,2) check (estimate is null or (estimate >= 0 and estimate < 100000000)),
  advance numeric(12,2) not null default 0 check (advance >= 0 and advance < 100000000),
  advance_mode text not null default 'Cash' check (advance_mode in ('Cash', 'UPI', 'Card', 'Bank transfer', 'Cheque')),
  karigar text not null default '' check (length(karigar) <= 80),
  sent_on date,
  weight_out numeric(10,3) check (weight_out is null or (weight_out > 0 and weight_out < 100000)),
  final_amount numeric(12,2) check (final_amount is null or (final_amount >= 0 and final_amount < 100000000)),
  paid_mode text not null default '' check (paid_mode in ('', 'Cash', 'UPI', 'Card', 'Bank transfer', 'Cheque')),
  note text not null default '' check (length(note) <= 500),
  close_note text not null default '' check (length(close_note) <= 200),
  created_by uuid references auth.users(id) on delete set null,
  created_by_name text not null default '',
  created_at timestamptz not null default now(),
  updated_by_name text not null default '',
  updated_at timestamptz,
  karigar_at timestamptz,
  ready_at timestamptz,
  ready_by_name text not null default '',
  delivered_at timestamptz,
  delivered_by_name text not null default '',
  cancelled_at timestamptz
);
create unique index jobs_job_no_idx on public.jobs (job_no);
create index jobs_status_idx on public.jobs (status, due);
create index jobs_customer_idx on public.jobs (customer_id);
create index jobs_created_by_idx on public.jobs (created_by);

-- who and when, and the date each stage was reached (going back clears the later ones)
create function public.stamp_job() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_me text := coalesce((select name from public.profiles where user_id = (select auth.uid())), '');
  v_old text := case when tg_op = 'INSERT' then '' else old.status end;
  v_rank int := array_position(array['received', 'karigar', 'ready', 'delivered'], new.status);
begin
  if tg_op = 'INSERT' then
    new.created_by := (select auth.uid()); new.created_by_name := v_me; new.created_at := now();
    new.updated_by_name := ''; new.updated_at := null;
  else
    new.created_by := old.created_by; new.created_by_name := old.created_by_name; new.created_at := old.created_at;
    new.updated_by_name := v_me; new.updated_at := now();
  end if;
  new.repair_no := btrim(new.repair_no); new.service := btrim(new.service);
  -- free for the customer (bought from us within 15 days, or the owner's friend): nothing is collected
  if new.free_recent_buy or new.free_owner_friend then new.final_amount := 0; new.advance := 0; end if;
  if new.status <> v_old then
    if new.status = 'karigar' then new.karigar_at := now(); new.sent_on := coalesce(new.sent_on, (now() at time zone 'Asia/Kolkata')::date); end if;
    if new.status = 'ready' then new.ready_at := now(); new.ready_by_name := v_me; end if;
    if new.status = 'delivered' then new.delivered_at := now(); new.delivered_by_name := v_me; end if;
    if new.status = 'cancelled' then new.cancelled_at := now(); else new.cancelled_at := null; end if;
  end if;
  if new.status <> 'cancelled' then
    if v_rank < 2 then new.karigar_at := null; end if;
    if v_rank < 3 then new.ready_at := null; new.ready_by_name := ''; end if;
    if v_rank < 4 then new.delivered_at := null; new.delivered_by_name := ''; end if;
  end if;
  return new;
end $$;
create trigger jobs_stamp before insert or update on public.jobs for each row execute function public.stamp_job();
revoke execute on function public.stamp_job() from anon, authenticated, public;

-- whoever took the job hears when it is ready
create function public.notify_job_ready() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'ready' and old.status <> 'ready' and new.created_by is not null and new.created_by is distinct from (select auth.uid()) then
    insert into public.notifications (user_id, kind, title, body, link)
    values (new.created_by, 'job_ready', 'Job J-' || new.job_no || ' is ready', new.customer_name || ' · ' || new.item, 'jobs/#j=' || new.id);
  end if;
  return null;
end $$;
create trigger jobs_ready_notify after update on public.jobs for each row execute function public.notify_job_ready();
revoke execute on function public.notify_job_ready() from anon, authenticated, public;

alter table public.jobs enable row level security;
create policy "jobs app sees" on public.jobs for select to authenticated using ((select public.can_use('jobs')));
create policy "jobs app adds" on public.jobs for insert to authenticated with check ((select public.can_use('jobs')));
create policy "jobs app updates" on public.jobs for update to authenticated using ((select public.can_use('jobs'))) with check ((select public.can_use('jobs')));
create policy "owner removes jobs" on public.jobs for delete to authenticated using ((select public.is_owner()));
create policy "approved device only" on public.jobs as restrictive for all to authenticated
  using ((select public.device_ok())) with check ((select public.device_ok()));
revoke all on public.jobs from anon;

-- the private photo bucket: images only, 2 MB at most each
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('jobs', 'jobs', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
create policy "jobs app sees photos" on storage.objects for select to authenticated
  using (bucket_id = 'jobs' and (select public.can_use('jobs')));
create policy "jobs app adds photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'jobs' and (select public.can_use('jobs')));
create policy "owner or uploader removes job photos" on storage.objects for delete to authenticated
  using (bucket_id = 'jobs' and ((select public.is_owner()) or owner_id = (select auth.uid())::text));
create policy "job photos from approved devices only" on storage.objects as restrictive for all to authenticated
  using (bucket_id <> 'jobs' or (select public.device_ok())) with check (bucket_id <> 'jobs' or (select public.device_ok()));

-- (033a) the job number starts at 1001 for the first real job
alter table public.jobs alter column job_no restart with 1001;

-- (033b) the paper repair slip's number, the kind of service, what the karigar was paid, and free repairs:
-- bought from us within 15 days, or the owner's friend (then nothing is collected). final_amount is the
-- amount collected from the customer. A shared list of services anyone with the app can add to.
alter table public.jobs
  add column repair_no text not null default '' check (length(repair_no) <= 30),
  add column service text not null default '' check (length(service) <= 60),
  add column karigar_cost numeric(12,2) check (karigar_cost is null or (karigar_cost >= 0 and karigar_cost < 100000000)),
  add column free_recent_buy boolean not null default false,
  add column free_owner_friend boolean not null default false;
comment on column public.jobs.final_amount is 'amount collected from the customer (0 when free)';
alter table public.settings add column job_services text[] not null default array[
  'Polish', 'Soldering', 'Size change', 'Stone setting', 'Rhodium / plating', 'Hook / clasp', 'Cleaning', 'Chain repair', 'Screw / pin', 'Enamel'];
-- (stamp_job above already includes the free-repair rule; it was added with these columns)
create function public.add_job_service(p_name text) returns text[]
language plpgsql security definer set search_path = '' as $$
declare v text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')); v_list text[];
begin
  if not public.can_use('jobs') then raise exception 'Ask the owner for access to Repairs & orders.' using errcode = '42501'; end if;
  if length(v) < 1 or length(v) > 60 then raise exception 'A service name is 1 to 60 letters.' using errcode = '22023'; end if;
  select job_services into v_list from public.settings where id = 1;
  if not exists (select 1 from unnest(v_list) c where lower(c) = lower(v)) then
    update public.settings set job_services = array_append(job_services, v) where id = 1 returning job_services into v_list;
  end if;
  return v_list;
end $$;
revoke execute on function public.add_job_service(text) from anon, public;
grant execute on function public.add_job_service(text) to authenticated;

-- (033c) the ready message names the slip number the shop knows ("Repair 4508 is ready")
create or replace function public.notify_job_ready() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'ready' and old.status <> 'ready' and new.created_by is not null and new.created_by is distinct from (select auth.uid()) then
    insert into public.notifications (user_id, kind, title, body, link)
    values (new.created_by, 'job_ready',
      case when new.repair_no <> '' then (case when new.kind = 'order' then 'Order ' else 'Repair ' end) || new.repair_no else 'Job J-' || new.job_no end || ' is ready',
      new.customer_name || ' · ' || new.item, 'jobs/#j=' || new.id);
  end if;
  return null;
end $$;
revoke execute on function public.notify_job_ready() from anon, authenticated, public;
