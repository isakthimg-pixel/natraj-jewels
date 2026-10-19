-- More than one sales staff member can be named on a customer form: the Customers page saves everyone
-- who helped with the sale as one comma-separated list in customer_activity.served_by ("Anu, Ravi").
alter table public.customer_activity drop constraint if exists customer_activity_served_by_check;
alter table public.customer_activity add constraint customer_activity_served_by_check check (length(served_by) <= 300);
