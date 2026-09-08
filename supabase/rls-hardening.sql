-- Run once after the original database setup.
-- Prevent normal users from changing protected profile fields such as role/is_active.

revoke update on table public.profiles from authenticated;

grant update (
  username,
  display_name,
  bio,
  avatar_url,
  cover_url,
  updated_at
)
on public.profiles
to authenticated;
