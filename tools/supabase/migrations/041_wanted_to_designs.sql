-- Customers ↔ Design library. On a customer form, "Anything they wanted that we didn't have?" also goes to
-- the Design library as a customer request (kind 'enquiry', status 'open'), linked to the customer, so it
-- can be ordered; whoever entered the form is told when it arrives (notify_design_arrived, 018).
-- A function, so staff who enter forms can add it even without the Design library app.
create function public.add_wanted_design(p_customer uuid, p_want text, p_metal text, p_category text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare c public.customers; v_id uuid;
begin
  if not public.can_use('crm') then raise exception 'Ask the owner for access to Customers.' using errcode = '42501'; end if;
  if length(btrim(coalesce(p_want, ''))) = 0 then raise exception 'Write what the customer wanted.' using errcode = '22023'; end if;
  select * into c from public.customers where id = p_customer;
  if c.id is null then raise exception 'That customer no longer exists.' using errcode = 'P0002'; end if;
  insert into public.designs (kind, metal, category, customer_id, customer_name, customer_phone, notes)
  values ('enquiry', case when p_metal in ('Gold', 'Silver', 'Diamond') then p_metal else 'Gold' end, left(coalesce(p_category, ''), 40),
          c.id, left(c.name, 80), left(regexp_replace(coalesce(c.phone, ''), '[^0-9+ ]', '', 'g'), 20),
          left('Wanted (customer form): ' || btrim(p_want), 500))
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.add_wanted_design(uuid, text, text, text) from anon, public;
grant execute on function public.add_wanted_design(uuid, text, text, text) to authenticated;
