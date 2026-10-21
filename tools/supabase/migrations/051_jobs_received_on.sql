-- The day the customer gave the piece (or placed the order). Usually today, but a slip can be entered a day or two
-- later. Existing jobs take the day they were entered.
alter table public.jobs add column received_on date;
update public.jobs set received_on = (created_at at time zone 'Asia/Kolkata')::date where received_on is null;
alter table public.jobs alter column received_on set default ((now() at time zone 'Asia/Kolkata')::date),
  alter column received_on set not null;
