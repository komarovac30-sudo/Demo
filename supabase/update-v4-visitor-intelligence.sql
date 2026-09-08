-- CreatorSpace Demo - Update V4 Visitor Intelligence
-- Safe optional optimization. The V4 app works with the existing activity_events.metadata JSONB structure.
-- Run this once in Supabase SQL Editor after V3 if you want faster visitor grouping/filtering as the event table grows.

create index if not exists activity_visitor_key_idx
on public.activity_events ((metadata->>'visitor_key'));

create index if not exists activity_ip_idx
on public.activity_events ((metadata->>'ip_address'));

create index if not exists activity_profile_visitor_key_idx
on public.activity_events (profile_id, (metadata->>'visitor_key'));

-- No destructive migration is required. New events store these metadata fields:
-- ip_address, visitor_key, city, country, region, device_type, browser, os, location_source.
