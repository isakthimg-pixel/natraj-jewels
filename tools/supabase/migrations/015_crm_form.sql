-- Customers app, matching the customer information form:
--  * on the customer: pincode, WhatsApp on the mobile number, permission to send offers and wishes,
--    and an upcoming family function (month and what it is);
--  * each filled form is a 'visit' in the customer's history: what they came for, whether they bought,
--    what they were looking for, the service rating, what we didn't have, and who served them.
-- Birthdays and anniversaries whose year is not known are stored in the year 1904 (a leap year, so
-- 29 February works); the app shows them without a year.
alter table public.customers
  add column pincode text not null default '' check (pincode ~ '^[0-9]{0,6}$'),
  add column whatsapp_on_phone boolean not null default true,
  add column whatsapp_ok boolean not null default false,
  add column function_month text not null default '' check (function_month ~ '^([0-9]{4}-(0[1-9]|1[0-2]))?$'),
  add column function_note text not null default '' check (length(function_note) <= 80);

alter table public.customer_activity drop constraint customer_activity_kind_check;
alter table public.customer_activity add constraint customer_activity_kind_check check (kind in ('note', 'followup', 'visit'));
alter table public.customer_activity drop constraint customer_activity_check;
alter table public.customer_activity add constraint customer_activity_check check (kind <> 'followup' or due is not null);
alter table public.customer_activity
  add column came_for text[] not null default '{}',
  add column bought boolean,
  add column looking_for text not null default '' check (length(looking_for) <= 200),
  add column rating smallint check (rating between 1 and 5),
  add column missing text not null default '' check (length(missing) <= 200),
  add column served_by text not null default '' check (length(served_by) <= 60),
  add column visit_day date;

-- a visit is history, like a note: never "open"
create or replace function public.stamp_customer_activity() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_me text := coalesce((select name from public.profiles where user_id = (select auth.uid())), '');
begin
  if tg_op = 'INSERT' then
    new.created_by := (select auth.uid()); new.created_by_name := v_me; new.created_at := now();
  else
    new.created_by := old.created_by; new.created_by_name := old.created_by_name; new.created_at := old.created_at;
    new.customer_id := old.customer_id; new.kind := old.kind;
  end if;
  new.assigned_name := coalesce((select name from public.profiles where user_id = new.assigned_to), '');
  if new.kind in ('note', 'visit') then
    new.status := 'done'; new.due := null;
    if new.kind = 'visit' and new.visit_day is null then new.visit_day := (now() at time zone 'Asia/Kolkata')::date; end if;
  elsif new.status = 'done' and (tg_op = 'INSERT' or old.status <> 'done') then
    new.done_at := now(); new.done_by_name := v_me;
  elsif new.status = 'open' then
    new.done_at := null; new.done_by_name := ''; new.outcome := '';
  end if;
  return new;
end $$;
create index customer_activity_visit_idx on public.customer_activity (visit_day) where kind = 'visit';
