-- Shared foundation for all Natraj Jewels tools: staff, people who can sign in, shop settings.

create table public.staff (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 60),
  designation text not null default '' check (length(designation) <= 40),
  phone text not null default '' check (length(phone) <= 20),
  joined date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- One row per person who can sign in. Accounts are created only by the "people" edge function.
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 60),
  username text not null unique,
  is_owner boolean not null default false,
  apps text[] not null default '{}',
  staff_id uuid references public.staff(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.settings (
  id int primary key default 1 check (id = 1),
  weekly_off int not null default 0 check (weekly_off between -1 and 6)
);
insert into public.settings default values;

-- Server-only values. Not reachable through the API.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table private.secrets (key text primary key, value text not null);

-- Who is asking? Used by every table's access rules.
create function public.is_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where user_id = (select auth.uid()));
$$;

create function public.is_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select is_owner from public.profiles where user_id = (select auth.uid())), false);
$$;

create function public.can_use(app text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select is_owner or app = any(apps) from public.profiles where user_id = (select auth.uid())), false);
$$;

alter table public.staff enable row level security;
alter table public.profiles enable row level security;
alter table public.settings enable row level security;

create policy "members read staff" on public.staff for select to authenticated using ((select public.is_member()));
create policy "owner adds staff" on public.staff for insert to authenticated with check ((select public.is_owner()));
create policy "owner edits staff" on public.staff for update to authenticated using ((select public.is_owner())) with check ((select public.is_owner()));
create policy "owner deletes staff" on public.staff for delete to authenticated using ((select public.is_owner()));

create policy "read own profile, owner reads all" on public.profiles for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_owner()));

create policy "members read settings" on public.settings for select to authenticated using ((select public.is_member()));
create policy "owner edits settings" on public.settings for update to authenticated using ((select public.is_owner())) with check ((select public.is_owner()));

-- Nobody signed out can touch the tables directly.
revoke all on public.staff, public.profiles, public.settings from anon;

-- Public helpers for the sign-in screen.
create function public.login_names() returns table (name text, username text)
language sql stable security definer set search_path = '' as $$
  select name, username from public.profiles order by name;
$$;

create function public.setup_needed() returns boolean
language sql stable security definer set search_path = '' as $$
  select not exists (select 1 from public.profiles where is_owner);
$$;

revoke execute on function public.is_member(), public.is_owner(), public.can_use(text) from anon, public;
grant execute on function public.is_member(), public.is_owner(), public.can_use(text) to authenticated;
grant execute on function public.login_names(), public.setup_needed() to anon, authenticated;

-- (Four placeholder staff rows were inserted here at first; they were sample names
-- and are removed by the owner. Real staff are added in People & settings.)
