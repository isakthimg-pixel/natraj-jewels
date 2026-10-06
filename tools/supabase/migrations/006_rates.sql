-- Gold & silver rate app: every rate change, newest first is "today's rate". Rupees per gram.
create table public.rates (
  id uuid primary key default gen_random_uuid(),
  set_at timestamptz not null default now(),
  gold_22k numeric(10,2) not null check (gold_22k > 0 and gold_22k < 1000000),
  gold_24k numeric(10,2) check (gold_24k > 0 and gold_24k < 1000000),
  gold_18k numeric(10,2) check (gold_18k > 0 and gold_18k < 1000000),
  silver numeric(10,2) not null check (silver > 0 and silver < 100000),
  note text not null default '' check (length(note) <= 200),
  set_by uuid references auth.users(id) on delete set null,
  set_by_name text not null default ''
);
create index rates_set_at_idx on public.rates (set_at desc);
create index rates_set_by_idx on public.rates (set_by);

create function public.stamp_rate() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.set_by := (select auth.uid());
  new.set_by_name := coalesce((select name from public.profiles where user_id = (select auth.uid())), '');
  new.set_at := now();
  return new;
end $$;
create trigger rates_stamp before insert on public.rates for each row execute function public.stamp_rate();
revoke execute on function public.stamp_rate() from anon, authenticated, public;

alter table public.rates enable row level security;
create policy "members read rates" on public.rates for select to authenticated using ((select public.is_member()));
create policy "rate setters add rates" on public.rates for insert to authenticated with check ((select public.can_use('rates')));
create policy "owner edits rates" on public.rates for update to authenticated using ((select public.is_owner())) with check ((select public.is_owner()));
create policy "owner removes rates" on public.rates for delete to authenticated using ((select public.is_owner()));
revoke all on public.rates from anon;
