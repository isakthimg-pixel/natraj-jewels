-- Mark bank money-in entries that are chit scheme payments (UPI, card, bank transfer or cheque from
-- members), so the owner can check them against the chit payments taken in the shop. Cash chit
-- payments are not expected in the bank, so they are left out of that check.
alter table public.bank_entries add column for_chit boolean not null default false;
alter table public.bank_entries add constraint bank_entries_chit_is_money_in check (not for_chit or direction = 'in');
create index bank_entries_chit_day_idx on public.bank_entries (day) where for_chit;
