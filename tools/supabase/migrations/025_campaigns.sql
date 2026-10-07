-- Marketing campaigns: a campaign (occasion, dates, channels, offer, WhatsApp message, budget), its
-- contact list (customers chosen from Customers, with name and phone copied so people without the
-- Customers app can still send and record results), what each one did (sent, came, bought), and the
-- money spent. Everyone with the 'campaigns' app works on campaigns; only the owner deletes a
-- campaign; costs are fixed on the same day by whoever entered them, or by the owner.
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 80),
  occasion text not null default '' check (length(occasion) <= 60),
  starts date not null,
  ends date not null,
  channels text[] not null default '{}',
  offer text not null default '' check (length(offer) <= 300),
  message text not null default '' check (length(message) <= 1000),
  budget numeric(12,2) check (budget is null or budget >= 0),
  notes text not null default '' check (length(notes) <= 500),
  created_by uuid references auth.users(id) on delete set null,
  created_by_name text not null default '',
  created_at timestamptz not null default now(),
  updated_by_name text not null default '',
  updated_at timestamptz,
  check (ends >= starts)
);
create index campaigns_starts_idx on public.campaigns (starts desc);
create index campaigns_created_by_idx on public.campaigns (created_by);

create table public.campaign_contacts (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  name text not null check (length(btrim(name)) between 1 and 80),
  phone text not null default '' check (phone ~ '^[0-9+ ]{0,20}$'),
  walk_in boolean not null default false,                 -- came in because of the campaign, not on the list
  sent_at timestamptz,
  sent_by_name text not null default '',
  came boolean not null default false,
  came_on date,
  bought numeric(12,2) check (bought is null or bought >= 0),
  note text not null default '' check (length(note) <= 200),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_by_name text not null default '',
  updated_at timestamptz
);
create unique index campaign_contacts_one_each on public.campaign_contacts (campaign_id, customer_id) where customer_id is not null;
create index campaign_contacts_campaign_idx on public.campaign_contacts (campaign_id);
create index campaign_contacts_customer_idx on public.campaign_contacts (customer_id);
create index campaign_contacts_created_by_idx on public.campaign_contacts (created_by);

create table public.campaign_costs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  day date not null default ((now() at time zone 'Asia/Kolkata')::date),
  channel text not null default '' check (length(channel) <= 40),
  what text not null default '' check (length(what) <= 120),
  amount numeric(12,2) not null check (amount > 0 and amount < 100000000),
  created_by uuid references auth.users(id) on delete set null,
  created_by_name text not null default '',
  created_at timestamptz not null default now()
);
create index campaign_costs_campaign_idx on public.campaign_costs (campaign_id);
create index campaign_costs_created_by_idx on public.campaign_costs (created_by);

-- who and when, filled in here
create function public.stamp_campaign_row() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_me text := coalesce((select name from public.profiles where user_id = (select auth.uid())), '');
begin
  if tg_table_name = 'campaigns' then
    if tg_op = 'INSERT' then new.created_by := (select auth.uid()); new.created_by_name := v_me; new.created_at := now(); new.updated_by_name := ''; new.updated_at := null;
    else new.created_by := old.created_by; new.created_by_name := old.created_by_name; new.created_at := old.created_at; new.updated_by_name := v_me; new.updated_at := now(); end if;
  elsif tg_table_name = 'campaign_contacts' then
    if tg_op = 'INSERT' then new.created_by := (select auth.uid()); new.created_at := now(); new.updated_by_name := ''; new.updated_at := null;
      if new.sent_at is not null then new.sent_at := now(); new.sent_by_name := v_me; end if;
    else new.created_by := old.created_by; new.created_at := old.created_at; new.updated_by_name := v_me; new.updated_at := now();
      if new.sent_at is not null and old.sent_at is null then new.sent_at := now(); new.sent_by_name := v_me;
      elsif new.sent_at is null then new.sent_by_name := ''; else new.sent_at := old.sent_at; new.sent_by_name := old.sent_by_name; end if;
    end if;
    if not new.came then new.came_on := null; end if;
  else
    if tg_op = 'INSERT' then new.created_by := (select auth.uid()); new.created_by_name := v_me; new.created_at := now();
    else new.created_by := old.created_by; new.created_by_name := old.created_by_name; new.created_at := old.created_at; end if;
  end if;
  return new;
end $$;
create trigger campaigns_stamp before insert or update on public.campaigns for each row execute function public.stamp_campaign_row();
create trigger campaign_contacts_stamp before insert or update on public.campaign_contacts for each row execute function public.stamp_campaign_row();
create trigger campaign_costs_stamp before insert or update on public.campaign_costs for each row execute function public.stamp_campaign_row();
revoke execute on function public.stamp_campaign_row() from anon, authenticated, public;

alter table public.campaigns enable row level security;
create policy "campaigns app sees" on public.campaigns for select to authenticated using ((select public.can_use('campaigns')));
create policy "campaigns app adds" on public.campaigns for insert to authenticated with check ((select public.can_use('campaigns')));
create policy "campaigns app edits" on public.campaigns for update to authenticated using ((select public.can_use('campaigns'))) with check ((select public.can_use('campaigns')));
create policy "owner removes campaigns" on public.campaigns for delete to authenticated using ((select public.is_owner()));

alter table public.campaign_contacts enable row level security;
create policy "campaigns app sees contacts" on public.campaign_contacts for select to authenticated using ((select public.can_use('campaigns')));
create policy "campaigns app adds contacts" on public.campaign_contacts for insert to authenticated with check ((select public.can_use('campaigns')));
create policy "campaigns app edits contacts" on public.campaign_contacts for update to authenticated using ((select public.can_use('campaigns'))) with check ((select public.can_use('campaigns')));
create policy "campaigns app removes contacts" on public.campaign_contacts for delete to authenticated using ((select public.can_use('campaigns')));

alter table public.campaign_costs enable row level security;
create policy "campaigns app sees costs" on public.campaign_costs for select to authenticated using ((select public.can_use('campaigns')));
create policy "campaigns app adds costs" on public.campaign_costs for insert to authenticated with check ((select public.can_use('campaigns')));
create policy "owner or same day fixes costs" on public.campaign_costs for update to authenticated
  using ((select public.is_owner()) or ((select public.can_use('campaigns')) and public.own_today(created_by, created_at)))
  with check ((select public.is_owner()) or ((select public.can_use('campaigns')) and public.own_today(created_by, created_at)));
create policy "owner or same day removes costs" on public.campaign_costs for delete to authenticated
  using ((select public.is_owner()) or ((select public.can_use('campaigns')) and public.own_today(created_by, created_at)));

revoke all on public.campaigns, public.campaign_contacts, public.campaign_costs from anon;
