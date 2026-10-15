-- Customer form: when the customer was just looking, why they didn't buy (price, design, weight, coming back...).
alter table public.customer_activity add column why_not text not null default '' check (length(why_not) <= 200);
