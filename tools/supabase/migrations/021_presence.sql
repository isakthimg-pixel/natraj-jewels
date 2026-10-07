-- Who is online: every open page checks in about once a minute through heartbeat(), saying which
-- app it shows and on what kind of device; signing out calls presence_out(). Rows are written only
-- by these two functions (so nobody can fake another person's time). The owner sees everyone;
-- each person sees only their own row.
create table public.presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  page text not null default '' check (length(page) <= 40),
  device text not null default '' check (length(device) <= 20),
  signed_in_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  signed_out_at timestamptz
);
alter table public.presence enable row level security;
create policy "owner sees everyone, people see themselves" on public.presence for select to authenticated
  using ((select public.is_owner()) or user_id = (select auth.uid()));
revoke all on public.presence from anon, authenticated;
grant select on public.presence to authenticated;

-- a new visit (after signing out, or after 10 minutes away) starts a new "signed in since" time
create function public.heartbeat(p_page text, p_device text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_me uuid := (select auth.uid());
begin
  if v_me is null or not exists (select 1 from public.profiles where user_id = v_me) then return; end if;
  insert into public.presence as p (user_id, page, device, signed_in_at, last_seen, signed_out_at)
  values (v_me, left(coalesce(p_page, ''), 40), left(coalesce(p_device, ''), 20), now(), now(), null)
  on conflict (user_id) do update set
    page = excluded.page, device = excluded.device, last_seen = now(), signed_out_at = null,
    signed_in_at = case when p.signed_out_at is not null or p.last_seen < now() - interval '10 minutes' then now() else p.signed_in_at end;
end $$;

create function public.presence_out() returns void
language sql security definer set search_path = '' as $$
  update public.presence set signed_out_at = now() where user_id = (select auth.uid());
$$;

revoke execute on function public.heartbeat(text, text), public.presence_out() from anon, public;
grant execute on function public.heartbeat(text, text), public.presence_out() to authenticated;
