-- Design library: a third kind, "R&D suggestion" (rnd): the R&D team suggests a product the shop could
-- stock. Like restock it has no customer. The owner is told about each new suggestion.
alter table public.designs drop constraint designs_kind_check;
alter table public.designs add constraint designs_kind_check check (kind in ('enquiry', 'restock', 'rnd'));
alter table public.designs drop constraint designs_check;
alter table public.designs add constraint designs_check check (kind <> 'enquiry' or length(btrim(customer_name)) > 0);

create function public.notify_design_suggested() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (user_id, kind, title, body, link)
  select p.user_id, 'design_suggested', 'R&D suggestion from ' || coalesce(nullif(new.created_by_name, ''), 'the team'),
         left(btrim(concat_ws(' ', nullif(new.purity, ''), lower(new.metal), lower(coalesce(nullif(new.category, ''), 'jewel')))) || case when new.notes <> '' then ' · ' || new.notes else '' end, 300),
         'designs/#d=' || new.id
  from public.profiles p where p.is_owner and p.user_id is distinct from new.created_by;
  return null;
end $$;
create trigger designs_suggested after insert on public.designs for each row when (new.kind = 'rnd') execute function public.notify_design_suggested();
revoke execute on function public.notify_design_suggested() from anon, authenticated, public;
