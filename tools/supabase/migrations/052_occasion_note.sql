-- What the customer said on the birthday / anniversary call, typed on Today's wishes. Saving a note also ticks the
-- wish as done, and the same words go into the customer's history as a note.
alter table public.occasion_done add column note text not null default '' check (length(note) <= 500);
create policy "crm notes wishes" on public.occasion_done for update to authenticated using ((select public.can_use('crm'))) with check ((select public.can_use('crm')));
grant update on public.occasion_done to authenticated;
