-- Optional: run this once in Supabase SQL Editor after deploying the project.
-- It gives @creator a populated demo feed using static assets included in /public/demo.

do $$
declare
  creator_uuid uuid;
begin
  select id into creator_uuid from public.profiles where username = 'creator' and role = 'CREATOR' limit 1;
  if creator_uuid is null then
    raise exception 'Creator profile with username creator was not found.';
  end if;

  update public.profiles
  set display_name = 'Maya Hart',
      bio = 'Visual storyteller • city nights • travel journals • behind-the-scenes moments',
      avatar_url = '/demo/avatar.svg',
      cover_url = '/demo/cover.svg'
  where id = creator_uuid;

  delete from public.media where creator_id = creator_uuid;
  delete from public.reviews where creator_id = creator_uuid;

  insert into public.media (creator_id, type, visibility, title, media_url, sort_order) values
    (creator_uuid, 'PHOTO', 'PUBLIC', 'Golden hour in the city', '/demo/photo-1.svg', 1),
    (creator_uuid, 'PHOTO', 'PUBLIC', 'Studio notes', '/demo/photo-2.svg', 2),
    (creator_uuid, 'VIDEO', 'PUBLIC', 'A short demo reel', '/demo/demo-reel.mp4', 3),
    (creator_uuid, 'PHOTO', 'LOCKED', 'Private gallery • Set 01', '/demo/locked-1.svg', 4),
    (creator_uuid, 'VIDEO', 'LOCKED', 'Behind the scenes', '/demo/demo-reel.mp4', 5),
    (creator_uuid, 'PHOTO', 'LOCKED', 'Private gallery • Set 02', '/demo/locked-2.svg', 6);

  insert into public.reviews (creator_id, reviewer_name, rating, review_text, is_featured, is_published) values
    (creator_uuid, 'Alex M.', 5, 'The profile feels polished, personal and very easy to explore.', true, true),
    (creator_uuid, 'Jordan K.', 5, 'The locked-content flow is clear and the media presentation looks premium.', false, true),
    (creator_uuid, 'Sam R.', 4, 'Clean layout, fast navigation and a strong creator-first presentation.', false, true);
end $$;
