-- The MJDTA rate updates itself: every 30 minutes in shop hours (05:30 to 22:00 in Tiruppur) the database reads
-- the MJDTA website (fetch_mjdta, 038). When MJDTA has published a new rate, it is saved as today's rate, signed
-- "MJDTA (automatic)". A rate typed in by staff stays until MJDTA publishes a new one. A change of more than 10%
-- from the current rate is not saved automatically (a misread page must not reach customers): the rate page says so.
-- The owner can switch this off on the rate page (settings.mjdta_auto).
create extension if not exists pg_cron;

alter table public.settings add column mjdta_auto boolean not null default true;

-- what the automatic update last did, for the rate page
alter table public.rate_feed
  add column auto_at timestamptz,
  add column auto_result text not null default '',
  add column applied_key text not null default '';   -- the MJDTA reading last saved (or found already saved)

-- a rate saved by the database itself (no one signed in) keeps the name it was given
create or replace function public.stamp_rate() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.set_by := (select auth.uid());
  new.set_by_name := case when (select auth.uid()) is null then coalesce(nullif(new.set_by_name, ''), 'Automatic')
    else coalesce((select name from public.profiles where user_id = (select auth.uid())), '') end;
  new.set_at := now();
  return new;
end $$;

create function public.auto_mjdta_rate() returns void
language plpgsql security definer set search_path = '' as $$
declare f public.rate_feed; cur public.rates; k text; n18 numeric; nsil numeric; v_res text;
begin
  if not coalesce((select mjdta_auto from public.settings where id = 1), true) then return; end if;
  perform public.fetch_mjdta();
  select * into f from public.rate_feed where id = 1;
  if not f.ok then
    update public.rate_feed set auto_at = now(), auto_result = 'Could not read MJDTA: ' || f.error where id = 1;
    return;
  end if;
  k := concat_ws('|', f.update_text, f.gold_22k, f.gold_18k, f.silver);
  if k = f.applied_key then
    update public.rate_feed set auto_at = now(), auto_result = 'No change at MJDTA.' where id = 1;
    return;
  end if;
  select * into cur from public.rates order by set_at desc limit 1;
  n18 := coalesce(f.gold_18k, cur.gold_18k);
  nsil := coalesce(f.silver, cur.silver);
  if nsil is null then
    v_res := 'MJDTA has a new rate but silver could not be read, so it was not saved. Enter it on this page.';
  elsif cur.id is not null and cur.gold_22k = f.gold_22k and cur.gold_18k is not distinct from n18 and cur.silver = nsil then
    v_res := 'Today''s rate already matches MJDTA.';
  elsif cur.id is not null and (abs(f.gold_22k - cur.gold_22k) > cur.gold_22k * 0.1 or abs(nsil - cur.silver) > cur.silver * 0.1) then
    v_res := 'MJDTA shows 22K ₹' || f.gold_22k || ' and silver ₹' || nsil || ', more than 10% from today''s rate, so it was not saved automatically. Check it and save it on this page.';
    update public.rate_feed set auto_at = now(), auto_result = v_res where id = 1;
    return;     -- not marked applied: checked again next time
  else
    insert into public.rates (gold_22k, gold_24k, gold_18k, silver, note, set_by_name)
    values (f.gold_22k, null, n18, nsil, left('MJDTA rate' || case when f.update_text <> '' then ' · ' || f.update_text else '' end || ' (automatic)', 200), 'MJDTA (automatic)');
    v_res := 'Saved the new MJDTA rate' || case when f.update_text <> '' then ' (' || f.update_text || ')' else '' end || '.';
  end if;
  update public.rate_feed set auto_at = now(), auto_result = v_res, applied_key = k where id = 1;
end $$;
revoke execute on function public.auto_mjdta_rate() from anon, authenticated, public;

-- every 30 minutes from 00:00 to 16:30 UTC, which is 05:30 to 22:00 in India
select cron.schedule('mjdta-auto-rate', '*/30 0-16 * * *', 'select public.auto_mjdta_rate()');
