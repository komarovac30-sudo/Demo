-- CreatorSpace Demo - Update V3
-- Run ONCE in Supabase SQL Editor before deploying the V3 code.
-- Adds real per-user photo/video likes. City/device data remains inside activity_events.metadata.

alter table public.media
add column if not exists likes_count integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'media_likes_count_nonnegative'
  ) then
    alter table public.media
      add constraint media_likes_count_nonnegative check (likes_count >= 0);
  end if;
end $$;

create table if not exists public.media_likes (
  id uuid primary key default gen_random_uuid(),
  media_id uuid not null references public.media(id) on delete cascade,
  visitor_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(media_id, visitor_id)
);

create index if not exists media_likes_media_idx on public.media_likes(media_id);
create index if not exists media_likes_visitor_idx on public.media_likes(visitor_id);
alter table public.media_likes enable row level security;

-- Likes are changed only through the server API/service role.
revoke all on table public.media_likes from anon, authenticated;
grant all on table public.media_likes to service_role;

create or replace function public.toggle_media_like(
  p_media_id uuid,
  p_visitor_id uuid
)
returns table(liked boolean, likes_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_creator_id uuid;
  v_visibility public.media_visibility;
  v_role public.user_role;
  v_exists boolean;
  v_count integer;
begin
  select role into v_role
  from public.profiles
  where id = p_visitor_id and is_active = true;

  if v_role is null then
    raise exception 'Visitor profile not found.';
  end if;

  select creator_id, visibility
  into v_creator_id, v_visibility
  from public.media
  where id = p_media_id
  for update;

  if not found then
    raise exception 'Media not found.';
  end if;

  if v_visibility = 'LOCKED'
     and p_visitor_id <> v_creator_id
     and v_role <> 'SUPER_ADMIN'
     and not exists (
       select 1 from public.profile_unlocks
       where visitor_id = p_visitor_id
         and creator_id = v_creator_id
     ) then
    raise exception 'Locked media is not unlocked.';
  end if;

  select exists (
    select 1 from public.media_likes
    where media_id = p_media_id
      and visitor_id = p_visitor_id
  ) into v_exists;

  if v_exists then
    delete from public.media_likes
    where media_id = p_media_id
      and visitor_id = p_visitor_id;

    update public.media
    set likes_count = greatest(public.media.likes_count - 1, 0)
    where id = p_media_id
    returning public.media.likes_count into v_count;

    return query select false, v_count;
  else
    insert into public.media_likes(media_id, visitor_id)
    values (p_media_id, p_visitor_id);

    update public.media
    set likes_count = public.media.likes_count + 1
    where id = p_media_id
    returning public.media.likes_count into v_count;

    return query select true, v_count;
  end if;
end;
$$;

revoke all on function public.toggle_media_like(uuid, uuid) from public, anon, authenticated;
grant execute on function public.toggle_media_like(uuid, uuid) to service_role;

-- Keep the existing demo totals if they have not already been seeded.
update public.media set likes_count = 86  where title = 'Golden hour in the city' and likes_count = 0;
update public.media set likes_count = 72  where title = 'Studio notes' and likes_count = 0;
update public.media set likes_count = 115 where title = 'A short demo reel' and likes_count = 0;
update public.media set likes_count = 34  where title = 'Private gallery • Set 01' and likes_count = 0;
update public.media set likes_count = 41  where title = 'Behind the scenes' and likes_count = 0;
update public.media set likes_count = 29  where title = 'Private gallery • Set 02' and likes_count = 0;
