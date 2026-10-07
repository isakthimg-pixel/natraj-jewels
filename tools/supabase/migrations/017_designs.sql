-- Design library: gold, silver and diamond designs with photos.
-- Photos live in the private storage bucket "designs" (shrunk on the phone to about 200 KB each);
-- the app shows them through short-lived signed links. Everyone with the 'designs' app sees,
-- adds and edits designs; only the owner deletes one.
create table public.designs (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (length(btrim(code)) between 1 and 30),
  metal text not null default 'Gold' check (metal in ('Gold', 'Silver', 'Diamond')),
  category text not null default '' check (length(category) <= 40),
  purity text not null default '' check (length(purity) <= 20),
  weight_g numeric(9,3) check (weight_g is null or (weight_g > 0 and weight_g < 100000)),
  va_percent numeric(5,2) check (va_percent is null or (va_percent >= 0 and va_percent < 100)),
  supplier text not null default '' check (length(supplier) <= 80),
  tags text[] not null default '{}',
  status text not null default 'in_shop' check (status in ('in_shop', 'sold', 'order')),
  notes text not null default '' check (length(notes) <= 500),
  photos text[] not null default '{}',          -- storage paths in the "designs" bucket, cover first
  created_by uuid references auth.users(id) on delete set null,
  created_by_name text not null default '',
  created_at timestamptz not null default now(),
  updated_by_name text not null default '',
  updated_at timestamptz
);
create index designs_created_idx on public.designs (created_at desc);
create index designs_metal_cat_idx on public.designs (metal, category);
create index designs_created_by_idx on public.designs (created_by);

create function public.stamp_design() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_me text := coalesce((select name from public.profiles where user_id = (select auth.uid())), '');
begin
  if tg_op = 'INSERT' then
    new.created_by := (select auth.uid()); new.created_by_name := v_me; new.created_at := now();
    new.updated_by_name := ''; new.updated_at := null;
  else
    new.created_by := old.created_by; new.created_by_name := old.created_by_name; new.created_at := old.created_at;
    new.updated_by_name := v_me; new.updated_at := now();
  end if;
  new.code := upper(btrim(new.code));
  return new;
end $$;
create trigger designs_stamp before insert or update on public.designs for each row execute function public.stamp_design();
revoke execute on function public.stamp_design() from anon, authenticated, public;

alter table public.designs enable row level security;
create policy "designs app sees" on public.designs for select to authenticated using ((select public.can_use('designs')));
create policy "designs app adds" on public.designs for insert to authenticated with check ((select public.can_use('designs')));
create policy "designs app edits" on public.designs for update to authenticated
  using ((select public.can_use('designs'))) with check ((select public.can_use('designs')));
create policy "owner removes designs" on public.designs for delete to authenticated using ((select public.is_owner()));
revoke all on public.designs from anon;

-- the private photo bucket: images only, 2 MB at most each
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('designs', 'designs', false, 2097152, array['image/jpeg', 'image/webp', 'image/png'])
on conflict (id) do nothing;

create policy "designs app sees photos" on storage.objects for select to authenticated
  using (bucket_id = 'designs' and (select public.can_use('designs')));
create policy "designs app adds photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'designs' and (select public.can_use('designs')));
create policy "owner or uploader removes photos" on storage.objects for delete to authenticated
  using (bucket_id = 'designs' and ((select public.is_owner()) or owner_id = (select auth.uid())::text));
