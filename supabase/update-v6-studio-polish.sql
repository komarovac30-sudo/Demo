-- Veloura Demo - V6 Studio Polish
-- Run ONCE after update-v5-full-rework.sql.
-- Adds an editable profile-level display-like count. Media likes_count already exists in V5.
-- The legacy location_label column is retained for compatibility, but V6 public UI no longer uses it:
-- public location is the current viewer's approximate city resolved from IP/network metadata.

alter table public.profiles
  add column if not exists profile_likes_count integer not null default 0;

-- V6 location is viewer-derived, so CREATOR accounts should no longer manually update location_label.
revoke update(location_label) on table public.profiles from authenticated;

do $$ begin
  if not exists (select 1 from pg_constraint where conname='profiles_profile_likes_count_check') then
    alter table public.profiles add constraint profiles_profile_likes_count_check
      check (profile_likes_count >= 0 and profile_likes_count <= 99999999);
  end if;
end $$;

-- Give the fictional demo profile a populated headline number.
update public.profiles
set profile_likes_count = case when profile_likes_count = 0 then 1284 else profile_likes_count end,
    location_label = null,
    updated_at = now()
where username='creator' and role='CREATOR';

-- Media like counts are editable only through the authenticated creator API in V6.
-- Actual visitor like records remain in media_likes; visitor toggles continue incrementing/decrementing media.likes_count.
