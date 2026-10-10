-- Shop hours (10 am to 8:30 pm): the Live shop shows the shop open or closed, and after closing,
-- staff who are not signed in have gone home.
alter table public.settings
  add column shop_opens time not null default '10:00',
  add column shop_closes time not null default '20:30';
