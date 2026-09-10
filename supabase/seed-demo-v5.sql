-- Veloura V5 fictional demo data.
-- Run after update-v5-full-rework.sql. No real individual identity/contact/review is copied.

do $$
declare
  creator_uuid uuid;
begin
  select id into creator_uuid from public.profiles where username='creator' and role='CREATOR' limit 1;
  if creator_uuid is null then raise exception 'Creator profile @creator not found.'; end if;

  update public.profiles set
    display_name='Sienna Vale',
    headline='Independent companion • Private photo journal',
    location_label='Miami, Florida',
    bio='Warm, polished and easygoing. I keep this page simple: a glimpse into my world, private photo and video sets, a few notes from verified visitors, and direct contact when you are ready to connect.',
    avatar_url='/demo/avatar-v5.svg',
    cover_url='/demo/cover-v5.svg',
    public_phone='+1 (305) 555-0148',
    public_email='hello@siennavale.demo',
    phone_visible=true,
    email_visible=true,
    is_verified=true,
    exclusive_price=24.99,
    exclusive_currency='USD'
  where id=creator_uuid;

  delete from public.media where creator_id=creator_uuid;
  delete from public.reviews where creator_id=creator_uuid;

  insert into public.media(creator_id,type,visibility,title,description,media_url,thumbnail_url,sort_order,likes_count) values
    (creator_uuid,'PHOTO','PUBLIC','Afterglow','A quiet golden-hour portrait from the demo journal.','/demo/media-01.svg',null,1,86),
    (creator_uuid,'PHOTO','PUBLIC','City lights','Late-night editorial mood and downtown color.','/demo/media-02.svg',null,2,63),
    (creator_uuid,'VIDEO','PUBLIC','Weekend reel','A short public preview from the demo collection.','/demo/demo-reel.mp4','/demo/media-03.svg',3,114),
    (creator_uuid,'PHOTO','PUBLIC','Sunday notes','Coffee, soft light and an unhurried morning.','/demo/media-04.svg',null,4,49),
    (creator_uuid,'PHOTO','LOCKED','Private gallery • Set 01','A premium photo set available after digital unlock.','/demo/locked-v5-01.svg',null,5,34),
    (creator_uuid,'VIDEO','LOCKED','Private reel • Vol. 01','A private video set available after digital unlock.','/demo/demo-reel.mp4','/demo/locked-v5-02.svg',6,41),
    (creator_uuid,'PHOTO','LOCKED','Private gallery • Set 02','A second premium gallery for the demo.','/demo/locked-v5-03.svg',null,7,29),
    (creator_uuid,'PHOTO','LOCKED','Behind the scenes','Unpublished moments and behind-the-scenes stills.','/demo/locked-v5-04.svg',null,8,27);

  insert into public.reviews(
    creator_id,reviewer_name,reviewer_first_name,reviewer_last_name,rating,review_text,reviewer_avatar_url,
    is_featured,is_published,status,source
  ) values
    (creator_uuid,'Daniel R.','Daniel','R.',5,'Easy communication, polished profile and a very professional experience from first contact through follow-up.','/demo/reviewers/reviewer-01.svg',true,true,'PUBLISHED','ADMIN'),
    (creator_uuid,'Marcus L.','Marcus','L.',5,'The profile matched the presentation well. Clear communication, punctual updates and a comfortable overall experience.','/demo/reviewers/reviewer-02.svg',false,true,'PUBLISHED','ADMIN'),
    (creator_uuid,'Ethan P.','Ethan','P.',5,'Private, respectful and straightforward. The media and profile information were current and easy to understand.',null,false,true,'PUBLISHED','ADMIN'),
    (creator_uuid,'Noah C.','Noah','C.',4,'Very polished page and quick communication. I especially liked how clear the verification and review information was.','/demo/reviewers/reviewer-03.svg',false,true,'PUBLISHED','ADMIN'),
    (creator_uuid,'James W.','James','W.',5,'A premium presentation with good attention to privacy and detail. I would be comfortable using the profile again.',null,false,true,'PUBLISHED','ADMIN');

  -- Demo visitor events use documentation-only TEST-NET IP ranges and fictional locations.
  delete from public.activity_events where profile_id=creator_uuid and coalesce(metadata->>'demo_seed','')='v5';
  insert into public.activity_events(profile_id,event_type,metadata,created_at) values
    (creator_uuid,'PROFILE_VIEW',jsonb_build_object('demo_seed','v5','ip_address','203.0.113.21','visitor_key','demo-miami-01','city','Miami','country','United States','region','Florida','device_type','Mobile','browser','Safari','os','iOS'),now()-interval '8 minutes'),
    (creator_uuid,'PHOTO_VIEW',jsonb_build_object('demo_seed','v5','ip_address','203.0.113.21','visitor_key','demo-miami-01','city','Miami','country','United States','region','Florida','device_type','Mobile','browser','Safari','os','iOS'),now()-interval '7 minutes'),
    (creator_uuid,'MEDIA_LIKE',jsonb_build_object('demo_seed','v5','ip_address','203.0.113.21','visitor_key','demo-miami-01','city','Miami','country','United States','region','Florida','device_type','Mobile','browser','Safari','os','iOS'),now()-interval '6 minutes'),
    (creator_uuid,'LOCKED_CONTENT_SEEN',jsonb_build_object('demo_seed','v5','ip_address','203.0.113.21','visitor_key','demo-miami-01','city','Miami','country','United States','region','Florida','device_type','Mobile','browser','Safari','os','iOS'),now()-interval '5 minutes'),
    (creator_uuid,'PROFILE_VIEW',jsonb_build_object('demo_seed','v5','ip_address','198.51.100.44','visitor_key','demo-austin-02','city','Austin','country','United States','region','Texas','device_type','Desktop','browser','Chrome','os','Windows'),now()-interval '3 hours'),
    (creator_uuid,'VIDEO_PLAY',jsonb_build_object('demo_seed','v5','ip_address','198.51.100.44','visitor_key','demo-austin-02','city','Austin','country','United States','region','Texas','device_type','Desktop','browser','Chrome','os','Windows'),now()-interval '2 hours 58 minutes'),
    (creator_uuid,'PROFILE_VIEW',jsonb_build_object('demo_seed','v5','ip_address','192.0.2.77','visitor_key','demo-nyc-03','city','New York','country','United States','region','New York','device_type','Mobile','browser','Chrome','os','Android'),now()-interval '1 day'),
    (creator_uuid,'PHOTO_VIEW',jsonb_build_object('demo_seed','v5','ip_address','192.0.2.77','visitor_key','demo-nyc-03','city','New York','country','United States','region','New York','device_type','Mobile','browser','Chrome','os','Android'),now()-interval '23 hours 55 minutes');
end $$;
