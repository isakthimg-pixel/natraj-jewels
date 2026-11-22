-- The thank-you picture sent with the WhatsApp thank-you (Customers › Say thank you). The app has a default picture
-- (img/thank-you.jpg); the owner can put the shop's own picture in its place. It is kept in the private "marketing"
-- bucket under thanks/, and everyone who uses Customers may read that folder (only the owner and Campaigns users can
-- add to the bucket, as before).
alter table public.settings add column thanks_picture text not null default '' check (length(thanks_picture) <= 200);

create policy "customers app sees the thank-you picture" on storage.objects for select to authenticated
  using (bucket_id = 'marketing' and name like 'thanks/%' and (select public.can_use('crm')));
