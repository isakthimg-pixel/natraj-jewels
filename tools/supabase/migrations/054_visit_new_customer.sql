-- On each customer form: was this a new customer (first time at the shop) or a returning one? Filled in by staff;
-- the form suggests it from the mobile number. Forms entered before this are left empty (not marked).
alter table public.customer_activity add column new_customer boolean;
