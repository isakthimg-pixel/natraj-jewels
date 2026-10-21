-- More for running a campaign (Campaigns app):
--   campaigns.plan          the budget split by channel before spending, {"Radio": 20000, "Pamphlet": 5000, ...}
--   campaigns.competitors   what other jewellers in town were offering at the time, to compare year to year
--   campaign_contacts.thanked_at / followup_at   after the campaign: buyers thanked (with the Google review link),
--                           and a follow-up call added in Customers for those who came but did not buy
--   campaign_posts.kind     'post', or 'shoot' for a photo shoot on the planner, with the pieces to shoot and what is
--                           needed (model, props, place)
--   settings.review_link    the shop's Google review link, sent with the thank-you message
alter table public.campaigns
  add column plan jsonb not null default '{}' check (jsonb_typeof(plan) = 'object'),
  add column competitors text not null default '' check (length(competitors) <= 1000);
alter table public.campaign_contacts
  add column thanked_at timestamptz,
  add column followup_at timestamptz;
alter table public.campaign_posts
  add column kind text not null default 'post' check (kind in ('post', 'shoot')),
  add column shoot_pieces text not null default '' check (length(shoot_pieces) <= 500),
  add column shoot_needs text not null default '' check (length(shoot_needs) <= 500);
alter table public.settings
  add column review_link text not null default '' check (length(review_link) <= 300);
