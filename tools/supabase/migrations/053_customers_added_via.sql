-- How each customer was first saved: 'form' (Enter a form) or 'list' (Bring in a list). The 9,001 customers brought
-- in from the birthday list on 19 Oct 2026 were saved in one batch, so they are marked 'list'.
alter table public.customers add column added_via text not null default 'form' check (added_via in ('form', 'list'));
update public.customers set added_via = 'list' where date_trunc('minute', created_at) = '2026-10-19 17:50:00+00';
