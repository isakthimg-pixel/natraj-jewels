-- After a purchase on the customer form, staff send a thank-you on WhatsApp (with the Google review link) two days later.
-- thanked_at / thanked_by_name record that it was sent, so it shows once and nobody sends it twice.
-- The server stamps the time and the name; the app only says sent (any time) or not sent (null).
alter table public.customer_activity
  add column thanked_at timestamptz,
  add column thanked_by_name text not null default '' check (length(thanked_by_name) <= 60);

create function public.stamp_visit_thanks() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.thanked_at := null; new.thanked_by_name := '';
  elsif new.thanked_at is distinct from old.thanked_at then
    if new.thanked_at is null then new.thanked_by_name := '';
    else
      new.thanked_at := now();
      new.thanked_by_name := coalesce((select name from public.profiles where user_id = (select auth.uid())), '');
    end if;
  else
    new.thanked_by_name := old.thanked_by_name;
  end if;
  return new;
end $$;
create trigger customer_activity_thanks before insert or update on public.customer_activity for each row execute function public.stamp_visit_thanks();
revoke execute on function public.stamp_visit_thanks() from anon, authenticated, public;

create index customer_activity_bought_idx on public.customer_activity (visit_day) where kind = 'visit' and bought;
