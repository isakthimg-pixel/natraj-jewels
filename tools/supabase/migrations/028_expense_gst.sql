-- GST on expenses. An expense can be marked "GST claimable" with its GST rate. The amount stays the
-- bill total (GST included), so the GST in it is amount x rate / (100 + rate), worked out here.
-- "From whom" is the supplier in paid_to; their GSTIN and the bill number are kept for the claim.
-- Only the owner marks GST as claimed (when the return is filed); until then it shows on the
-- dashboard as GST to claim.
alter table public.expenses
  add column gst_claimable boolean not null default false,
  add column gst_rate numeric(5,2) check (gst_rate is null or (gst_rate > 0 and gst_rate <= 40)),
  add column gst_amount numeric(12,2) not null default 0,
  add column gstin text not null default '' check (gstin = '' or gstin ~ '^[0-9]{2}[A-Z0-9]{13}$'),
  add column bill_no text not null default '' check (length(bill_no) <= 40),
  add column gst_claimed_on date,
  add column gst_claimed_by_name text not null default '',
  add constraint expenses_gst_rate_needed check (not gst_claimable or gst_rate is not null);
create index expenses_gst_open_idx on public.expenses (day) where gst_claimable and gst_claimed_on is null;

create function public.expense_gst() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.gstin := upper(regexp_replace(coalesce(new.gstin, ''), '\s', '', 'g'));
  if new.gst_claimable then
    new.gst_amount := coalesce(round(new.amount * new.gst_rate / (100 + new.gst_rate), 2), 0);
  else
    new.gst_rate := null; new.gst_amount := 0; new.gst_claimed_on := null;
  end if;
  -- only the owner marks GST as claimed, and the name is filled in here
  if not public.is_owner() then
    if tg_op = 'INSERT' then new.gst_claimed_on := null; new.gst_claimed_by_name := '';
    else new.gst_claimed_on := case when new.gst_claimable then old.gst_claimed_on end; new.gst_claimed_by_name := old.gst_claimed_by_name; end if;
  elsif new.gst_claimed_on is null then
    new.gst_claimed_by_name := '';
  elsif tg_op = 'INSERT' or old.gst_claimed_on is distinct from new.gst_claimed_on then
    new.gst_claimed_by_name := coalesce((select name from public.profiles where user_id = (select auth.uid())), '');
  end if;
  return new;
end $$;
create trigger expenses_gst before insert or update on public.expenses for each row execute function public.expense_gst();
revoke execute on function public.expense_gst() from anon, authenticated, public;
