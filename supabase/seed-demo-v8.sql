-- VELOURA V8 — polished fictional demo content
-- Run after V7. This file intentionally uses ORIGINAL fictional names, contact details and review copy.
-- It does not copy real providers or real user reviews from third-party sites.

do $$
declare
  creator_uuid uuid;
begin
  select id into creator_uuid from public.profiles where username='creator' and role='CREATOR' limit 1;
  if creator_uuid is null then raise exception 'Creator profile @creator not found.'; end if;

  update public.profiles set
    display_name='Sienna Vale',
    headline='Independent companion • Private gallery • Discreet connection',
    bio='Warm, confident and easygoing with a soft spot for beautiful spaces, long conversations and thoughtful details. My public gallery is a small glimpse into my world; the private collection is where I share a little more. I value discretion, clear communication and a relaxed experience from first hello onward.',
    avatar_url='/demo/avatar-v5.svg',
    cover_url='/demo/cover-v5.svg',
    public_phone='+1 (305) 555-0148',
    public_email='sienna@veloura.example',
    phone_visible=true,
    email_visible=true,
    is_verified=true,
    exclusive_price=24.99,
    exclusive_currency='USD',
    profile_likes_count=1847,
    updated_at=now()
  where id=creator_uuid;

  update public.media set title='Velvet Hour', description='Soft light, quiet confidence and a warm editorial mood.', likes_count=142 where creator_id=creator_uuid and sort_order=1;
  update public.media set title='City After Dark', description='A late-night look with downtown color and polished energy.', likes_count=117 where creator_id=creator_uuid and sort_order=2;
  update public.media set title='A Little Motion', description='A short public reel with a relaxed, cinematic feel.', likes_count=165 where creator_id=creator_uuid and sort_order=3;
  update public.media set title='Slow Sunday', description='Coffee, soft light and an unhurried morning.', likes_count=91 where creator_id=creator_uuid and sort_order=4;
  update public.media set title='Private Notes • Vol. 01', description='A more personal photo collection available through private access.', likes_count=78 where creator_id=creator_uuid and sort_order=5;
  update public.media set title='After Hours • Private Reel', description='A private video journal for unlocked visitors.', likes_count=84 where creator_id=creator_uuid and sort_order=6;
  update public.media set title='Private Notes • Vol. 02', description='A second curated set from the private collection.', likes_count=69 where creator_id=creator_uuid and sort_order=7;
  update public.media set title='Behind the Curtain', description='Unpublished stills, quiet moments and behind-the-scenes frames.', likes_count=61 where creator_id=creator_uuid and sort_order=8;

  delete from public.reviews where creator_id=creator_uuid;

  insert into public.reviews(
    creator_id,reviewer_name,reviewer_first_name,reviewer_last_name,rating,review_text,reviewer_avatar_url,
    is_featured,is_published,status,source,verified_at,created_at
  ) values
    (creator_uuid,'Daniel R.','Daniel','R.',5,'Communication was prompt, clear and easy from the beginning. The profile felt accurate, polished and thoughtfully put together.','/demo/reviewers/reviewer-01.svg',true,true,'PUBLISHED','CREATOR',now()-interval '2 days',now()-interval '3 days'),
    (creator_uuid,'Marcus L.','Marcus','L.',5,'Everything felt discreet and well organized. I appreciated the calm communication style and how closely the presentation matched the profile.','/demo/reviewers/reviewer-02.svg',true,true,'PUBLISHED','CREATOR',now()-interval '4 days',now()-interval '5 days'),
    (creator_uuid,'Ethan P.','Ethan','P.',5,'A very polished experience from first contact onward. The gallery was current, the information was clear and nothing felt rushed.',null,true,true,'PUBLISHED','CREATOR',now()-interval '6 days',now()-interval '7 days'),
    (creator_uuid,'Noah C.','Noah','C.',5,'Warm, easygoing and professional. The profile gives a good sense of personality and the direct communication was refreshingly straightforward.','/demo/reviewers/reviewer-03.svg',true,true,'PUBLISHED','CREATOR',now()-interval '8 days',now()-interval '9 days'),
    (creator_uuid,'James W.','James','W.',5,'I liked the attention to privacy and detail. The whole interaction felt comfortable, respectful and exactly as the profile suggested.',null,false,true,'PUBLISHED','CREATOR',now()-interval '10 days',now()-interval '11 days'),
    (creator_uuid,'Oliver M.','Oliver','M.',4,'Very good communication and a clean, accurate profile. A small scheduling change came up, but it was handled quickly and professionally.','/demo/reviewers/reviewer-01.svg',false,true,'PUBLISHED','CREATOR',now()-interval '12 days',now()-interval '13 days'),
    (creator_uuid,'Liam B.','Liam','B.',5,'The verified profile and recent gallery made it easy to feel confident before reaching out. Friendly, responsive and considerate throughout.','/demo/reviewers/reviewer-02.svg',false,true,'PUBLISHED','CREATOR',now()-interval '15 days',now()-interval '16 days'),
    (creator_uuid,'Henry T.','Henry','T.',5,'The communication was low-pressure and respectful. I especially appreciated the clear expectations and the discreet way everything was handled.',null,false,true,'PUBLISHED','CREATOR',now()-interval '18 days',now()-interval '19 days'),
    (creator_uuid,'Lucas A.','Lucas','A.',5,'Beautiful presentation, easy contact and a very natural personality. The public profile felt curated without feeling overly staged.','/demo/reviewers/reviewer-03.svg',false,true,'PUBLISHED','CREATOR',now()-interval '21 days',now()-interval '22 days'),
    (creator_uuid,'Benjamin K.','Benjamin','K.',4,'A strong overall experience. Messages were answered clearly, the profile was accurate and the private-gallery flow was simple to understand.',null,false,true,'PUBLISHED','CREATOR',now()-interval '24 days',now()-interval '25 days'),
    (creator_uuid,'Alexander J.','Alexander','J.',5,'Discreet, polished and very easy to communicate with. The attention to small details made the whole experience feel premium.','/demo/reviewers/reviewer-01.svg',false,true,'PUBLISHED','CREATOR',now()-interval '27 days',now()-interval '28 days'),
    (creator_uuid,'William S.','William','S.',5,'The photos and written profile felt consistent and current. I also liked that reviews were clearly verified instead of simply appearing without context.','/demo/reviewers/reviewer-02.svg',false,true,'PUBLISHED','CREATOR',now()-interval '31 days',now()-interval '32 days'),
    (creator_uuid,'Jack H.','Jack','H.',5,'Clear communication, warm personality and a very tasteful profile. The experience felt private and well managed from start to finish.',null,false,true,'PUBLISHED','CREATOR',now()-interval '35 days',now()-interval '36 days'),
    (creator_uuid,'Samuel D.','Samuel','D.',5,'I found the profile through a shared link and everything I needed was easy to find. Contact, reviews and gallery were all presented clearly.','/demo/reviewers/reviewer-03.svg',false,true,'PUBLISHED','CREATOR',now()-interval '39 days',now()-interval '40 days'),
    (creator_uuid,'Matthew G.','Matthew','G.',4,'Friendly and responsive with a polished online presence. I would only make the About section a little more detailed, but overall it was excellent.',null,false,true,'PUBLISHED','CREATOR',now()-interval '44 days',now()-interval '45 days'),
    (creator_uuid,'Theo N.','Theo','N.',5,'The page feels personal rather than generic, which I really liked. Communication was calm, respectful and consistent with the tone of the profile.','/demo/reviewers/reviewer-01.svg',false,true,'PUBLISHED','CREATOR',now()-interval '49 days',now()-interval '50 days'),
    (creator_uuid,'Caleb F.','Caleb','F.',5,'The verification badge, recent media and client reviews all helped build trust. The overall experience felt thoughtful and discreet.','/demo/reviewers/reviewer-02.svg',false,true,'PUBLISHED','CREATOR',now()-interval '55 days',now()-interval '56 days'),
    (creator_uuid,'Ryan V.','Ryan','V.',5,'Easy to reach, easy to talk to and very clear about privacy. The profile has a premium feel without making simple information hard to find.',null,false,true,'PUBLISHED','CREATOR',now()-interval '61 days',now()-interval '62 days'),
    (creator_uuid,'Adrian C.','Adrian','C.',4,'A very clean and reassuring presentation. Communication was good and the private collection opened smoothly after verification.', '/demo/reviewers/reviewer-03.svg',false,true,'PUBLISHED','CREATOR',now()-interval '68 days',now()-interval '69 days'),
    (creator_uuid,'Julian E.','Julian','E.',5,'Respectful, polished and memorable. I appreciated the balance between a personal profile, clear contact options and a strong sense of discretion.',null,false,true,'PUBLISHED','CREATOR',now()-interval '76 days',now()-interval '77 days');

  -- Rich fictional Visitor Intelligence demo data. All IPs use RFC 5737 documentation ranges.
  delete from public.activity_events where profile_id=creator_uuid and coalesce(metadata->>'demo_seed','') in ('v5','v8');

  insert into public.activity_events(profile_id,event_type,metadata,created_at) values
    (creator_uuid,'PROFILE_VIEW',jsonb_build_object('demo_seed','v8','ip_address','203.0.113.21','visitor_key','v8-miami-01','city','Miami','country','United States','region','Florida','device_type','Mobile','browser','Safari','os','iOS'),now()-interval '8 minutes'),
    (creator_uuid,'PHOTO_VIEW',jsonb_build_object('demo_seed','v8','ip_address','203.0.113.21','visitor_key','v8-miami-01','city','Miami','country','United States','region','Florida','device_type','Mobile','browser','Safari','os','iOS'),now()-interval '7 minutes'),
    (creator_uuid,'MEDIA_LIKE',jsonb_build_object('demo_seed','v8','ip_address','203.0.113.21','visitor_key','v8-miami-01','city','Miami','country','United States','region','Florida','device_type','Mobile','browser','Safari','os','iOS'),now()-interval '6 minutes'),
    (creator_uuid,'LOCKED_CONTENT_SEEN',jsonb_build_object('demo_seed','v8','ip_address','203.0.113.21','visitor_key','v8-miami-01','city','Miami','country','United States','region','Florida','device_type','Mobile','browser','Safari','os','iOS'),now()-interval '5 minutes'),

    (creator_uuid,'PROFILE_VIEW',jsonb_build_object('demo_seed','v8','ip_address','198.51.100.44','visitor_key','v8-austin-02','city','Austin','country','United States','region','Texas','device_type','Desktop','browser','Chrome','os','Windows'),now()-interval '3 hours'),
    (creator_uuid,'VIDEO_PLAY',jsonb_build_object('demo_seed','v8','ip_address','198.51.100.44','visitor_key','v8-austin-02','city','Austin','country','United States','region','Texas','device_type','Desktop','browser','Chrome','os','Windows'),now()-interval '2 hours 58 minutes'),
    (creator_uuid,'MEDIA_LIKE',jsonb_build_object('demo_seed','v8','ip_address','198.51.100.44','visitor_key','v8-austin-02','city','Austin','country','United States','region','Texas','device_type','Desktop','browser','Chrome','os','Windows'),now()-interval '2 hours 56 minutes'),

    (creator_uuid,'PROFILE_VIEW',jsonb_build_object('demo_seed','v8','ip_address','192.0.2.77','visitor_key','v8-nyc-03','city','New York','country','United States','region','New York','device_type','Mobile','browser','Chrome','os','Android'),now()-interval '1 day'),
    (creator_uuid,'PHOTO_VIEW',jsonb_build_object('demo_seed','v8','ip_address','192.0.2.77','visitor_key','v8-nyc-03','city','New York','country','United States','region','New York','device_type','Mobile','browser','Chrome','os','Android'),now()-interval '23 hours 55 minutes'),
    (creator_uuid,'UNLOCK_CLICK',jsonb_build_object('demo_seed','v8','ip_address','192.0.2.77','visitor_key','v8-nyc-03','city','New York','country','United States','region','New York','device_type','Mobile','browser','Chrome','os','Android'),now()-interval '23 hours 52 minutes'),

    (creator_uuid,'PROFILE_VIEW',jsonb_build_object('demo_seed','v8','ip_address','203.0.113.55','visitor_key','v8-la-04','city','Los Angeles','country','United States','region','California','device_type','Mobile','browser','Safari','os','iOS'),now()-interval '2 days'),
    (creator_uuid,'VIDEO_PLAY',jsonb_build_object('demo_seed','v8','ip_address','203.0.113.55','visitor_key','v8-la-04','city','Los Angeles','country','United States','region','California','device_type','Mobile','browser','Safari','os','iOS'),now()-interval '2 days'+interval '4 minutes'),
    (creator_uuid,'VIDEO_COMPLETE',jsonb_build_object('demo_seed','v8','ip_address','203.0.113.55','visitor_key','v8-la-04','city','Los Angeles','country','United States','region','California','device_type','Mobile','browser','Safari','os','iOS'),now()-interval '2 days'+interval '2 minutes'),

    (creator_uuid,'PROFILE_VIEW',jsonb_build_object('demo_seed','v8','ip_address','198.51.100.81','visitor_key','v8-chicago-05','city','Chicago','country','United States','region','Illinois','device_type','Desktop','browser','Edge','os','Windows'),now()-interval '3 days'),
    (creator_uuid,'PHOTO_VIEW',jsonb_build_object('demo_seed','v8','ip_address','198.51.100.81','visitor_key','v8-chicago-05','city','Chicago','country','United States','region','Illinois','device_type','Desktop','browser','Edge','os','Windows'),now()-interval '3 days'+interval '3 minutes'),

    (creator_uuid,'PROFILE_VIEW',jsonb_build_object('demo_seed','v8','ip_address','192.0.2.31','visitor_key','v8-boston-06','city','Boston','country','United States','region','Massachusetts','device_type','Desktop','browser','Safari','os','macOS'),now()-interval '4 days'),
    (creator_uuid,'MEDIA_LIKE',jsonb_build_object('demo_seed','v8','ip_address','192.0.2.31','visitor_key','v8-boston-06','city','Boston','country','United States','region','Massachusetts','device_type','Desktop','browser','Safari','os','macOS'),now()-interval '4 days'+interval '5 minutes'),

    (creator_uuid,'PROFILE_VIEW',jsonb_build_object('demo_seed','v8','ip_address','203.0.113.89','visitor_key','v8-seattle-07','city','Seattle','country','United States','region','Washington','device_type','Mobile','browser','Chrome','os','Android'),now()-interval '5 days'),
    (creator_uuid,'LOCKED_CONTENT_SEEN',jsonb_build_object('demo_seed','v8','ip_address','203.0.113.89','visitor_key','v8-seattle-07','city','Seattle','country','United States','region','Washington','device_type','Mobile','browser','Chrome','os','Android'),now()-interval '5 days'+interval '2 minutes'),

    (creator_uuid,'PROFILE_VIEW',jsonb_build_object('demo_seed','v8','ip_address','198.51.100.103','visitor_key','v8-denver-08','city','Denver','country','United States','region','Colorado','device_type','Desktop','browser','Firefox','os','Windows'),now()-interval '6 days'),
    (creator_uuid,'PHOTO_VIEW',jsonb_build_object('demo_seed','v8','ip_address','198.51.100.103','visitor_key','v8-denver-08','city','Denver','country','United States','region','Colorado','device_type','Desktop','browser','Firefox','os','Windows'),now()-interval '6 days'+interval '3 minutes'),

    (creator_uuid,'PROFILE_VIEW',jsonb_build_object('demo_seed','v8','ip_address','192.0.2.119','visitor_key','v8-atlanta-09','city','Atlanta','country','United States','region','Georgia','device_type','Mobile','browser','Safari','os','iOS'),now()-interval '7 days'),
    (creator_uuid,'MEDIA_LIKE',jsonb_build_object('demo_seed','v8','ip_address','192.0.2.119','visitor_key','v8-atlanta-09','city','Atlanta','country','United States','region','Georgia','device_type','Mobile','browser','Safari','os','iOS'),now()-interval '7 days'+interval '2 minutes'),

    (creator_uuid,'PROFILE_VIEW',jsonb_build_object('demo_seed','v8','ip_address','203.0.113.143','visitor_key','v8-vegas-10','city','Las Vegas','country','United States','region','Nevada','device_type','Desktop','browser','Chrome','os','macOS'),now()-interval '9 days'),
    (creator_uuid,'VIDEO_PLAY',jsonb_build_object('demo_seed','v8','ip_address','203.0.113.143','visitor_key','v8-vegas-10','city','Las Vegas','country','United States','region','Nevada','device_type','Desktop','browser','Chrome','os','macOS'),now()-interval '9 days'+interval '4 minutes'),

    (creator_uuid,'PROFILE_VIEW',jsonb_build_object('demo_seed','v8','ip_address','198.51.100.151','visitor_key','v8-sd-11','city','San Diego','country','United States','region','California','device_type','Mobile','browser','Chrome','os','Android'),now()-interval '11 days'),
    (creator_uuid,'PHOTO_VIEW',jsonb_build_object('demo_seed','v8','ip_address','198.51.100.151','visitor_key','v8-sd-11','city','San Diego','country','United States','region','California','device_type','Mobile','browser','Chrome','os','Android'),now()-interval '11 days'+interval '2 minutes'),

    (creator_uuid,'PROFILE_VIEW',jsonb_build_object('demo_seed','v8','ip_address','192.0.2.188','visitor_key','v8-dc-12','city','Washington','country','United States','region','District of Columbia','device_type','Desktop','browser','Edge','os','Windows'),now()-interval '14 days'),
    (creator_uuid,'LOCKED_CONTENT_SEEN',jsonb_build_object('demo_seed','v8','ip_address','192.0.2.188','visitor_key','v8-dc-12','city','Washington','country','United States','region','District of Columbia','device_type','Desktop','browser','Edge','os','Windows'),now()-interval '14 days'+interval '3 minutes');

end $$;
