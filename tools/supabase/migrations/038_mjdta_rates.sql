-- Rates from MJDTA (The Jewellers and Diamond Traders' Association, Madras: thejewellersassociation.org).
-- The database reads their home page (with the "http" extension, 037) and picks out the 22K, 18K and 14K
-- gold rates, the silver rate per gram and their update time. The Rates page's "Fill from MJDTA" button
-- puts these in the boxes; the person entering the rate checks them and saves as usual.
-- The latest reading is kept for 3 minutes so pressing the button again does not ask MJDTA again.
create table public.rate_feed (
  id int primary key default 1 check (id = 1),
  source text not null default 'MJDTA',
  fetched_at timestamptz,
  update_text text not null default '',
  gold_22k numeric(12,2), gold_18k numeric(12,2), gold_14k numeric(12,2), silver numeric(12,2),
  ok boolean not null default false,
  error text not null default ''
);
alter table public.rate_feed enable row level security;
create policy "members read the rate feed" on public.rate_feed for select to authenticated using ((select public.is_member()));
revoke all on public.rate_feed from anon;
revoke insert, update on public.rate_feed from authenticated;

create function public.fetch_mjdta() returns void
language plpgsql security definer set search_path = '' as $$
declare v_body text; v_status int; g22 numeric; g18 numeric; g14 numeric; sil numeric; upd text; v_err text := '';
begin
  begin
    perform extensions.http_set_curlopt('CURLOPT_TIMEOUT', '12');
    select status, content into v_status, v_body from extensions.http((
      'GET', 'https://thejewellersassociation.org/',
      array[extensions.http_header('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36')],
      null, null)::extensions.http_request);
  exception when others then v_status := 0; v_err := 'Could not reach the MJDTA website.';
  end;
  if v_err = '' and v_status <> 200 then v_err := 'The MJDTA website answered with an error (' || v_status || ').'; end if;
  if v_err = '' then
    g22 := nullif((regexp_match(v_body, '#goldrate_22ct''\)\.html\("([0-9.]+)"\)'))[1], '')::numeric;
    g18 := nullif((regexp_match(v_body, '#goldrate_18ct''\)\.html\("([0-9.]+)"\)'))[1], '')::numeric;
    g14 := nullif((regexp_match(v_body, '#goldrate_14ct''\)\.html\("([0-9.]+)"\)'))[1], '')::numeric;
    -- silver: the first silver_rate shortly after the "1 Gm Silver" cell
    if strpos(v_body, '1 Gm Silver</td>') > 0 then
      sil := nullif((regexp_match(substr(v_body, strpos(v_body, '1 Gm Silver</td>'), 800), 'class="silver_rate">\s*([0-9.]+)\s*<'))[1], '')::numeric;
    end if;
    upd := coalesce((regexp_match(v_body, '#updatetime''\)\.html\("([^"]{1,60})"\)'))[1], '');
    -- the numbers must look like real rates, or the page has changed
    if g22 is null or g22 < 1000 or g22 > 100000 then v_err := 'The MJDTA page has changed; the 22K rate could not be read.'; end if;
    if v_err = '' and (sil is null or sil < 20 or sil > 5000) then sil := null; end if;
    if g18 is not null and (g18 < 500 or g18 > g22) then g18 := null; end if;
    if g14 is not null and (g14 < 300 or g14 > g22) then g14 := null; end if;
  end if;
  insert into public.rate_feed as f (id, fetched_at, update_text, gold_22k, gold_18k, gold_14k, silver, ok, error)
  values (1, now(), coalesce(upd, ''), case when v_err = '' then g22 end, case when v_err = '' then g18 end, case when v_err = '' then g14 end, case when v_err = '' then sil end, v_err = '', v_err)
  on conflict (id) do update set fetched_at = excluded.fetched_at, update_text = excluded.update_text, gold_22k = excluded.gold_22k,
    gold_18k = excluded.gold_18k, gold_14k = excluded.gold_14k, silver = excluded.silver, ok = excluded.ok, error = excluded.error;
end $$;
revoke execute on function public.fetch_mjdta() from anon, authenticated, public;

-- the latest MJDTA reading, read again when older than 3 minutes; for those who enter the rate
create function public.mjdta_rate() returns json
language plpgsql security definer set search_path = '' as $$
declare f public.rate_feed;
begin
  if not (public.can_use('rates') or public.is_rate_assignee()) then raise exception 'Only the people who enter the rate can do this.' using errcode = '42501'; end if;
  select * into f from public.rate_feed where id = 1;
  if f.id is null or f.fetched_at < now() - interval '3 minutes' then
    perform public.fetch_mjdta();
    select * into f from public.rate_feed where id = 1;
  end if;
  return row_to_json(f);
end $$;
revoke execute on function public.mjdta_rate() from anon, public;
grant execute on function public.mjdta_rate() to authenticated;
