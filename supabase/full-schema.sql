-- Full reference schema for a fresh Supabase project.
-- Your current project already has these objects, so DO NOT rerun this on the existing project.

create type public.user_role as enum ('SUPER_ADMIN','CREATOR','VISITOR');
create type public.media_type as enum ('PHOTO','VIDEO');
create type public.media_visibility as enum ('PUBLIC','LOCKED');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'VISITOR',
  username text unique not null,
  display_name text not null,
  bio text,
  avatar_url text,
  cover_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.media (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  type public.media_type not null,
  visibility public.media_visibility not null default 'PUBLIC',
  title text,
  description text,
  media_url text not null,
  thumbnail_url text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  reviewer_name text not null,
  rating integer not null check (rating >= 1 and rating <= 5),
  review_text text not null,
  reviewer_avatar_url text,
  is_featured boolean not null default false,
  is_published boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.profile_unlocks (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid not null references public.profiles(id) on delete cascade,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  unique(visitor_id, creator_id)
);

create table public.activity_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  visitor_id uuid references public.profiles(id) on delete set null,
  media_id uuid references public.media(id) on delete set null,
  event_type text not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index media_creator_idx on public.media(creator_id);
create index reviews_creator_idx on public.reviews(creator_id);
create index unlock_creator_idx on public.profile_unlocks(creator_id);
create index unlock_visitor_idx on public.profile_unlocks(visitor_id);
create index activity_profile_idx on public.activity_events(profile_id);
create index activity_created_idx on public.activity_events(created_at);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,role,username,display_name)
  values(new.id,'VISITOR','user_' || left(new.id::text,8),coalesce(new.raw_user_meta_data->>'display_name',split_part(new.email,'@',1),'User'));
  return new;
end; $$;

create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles where id=auth.uid() and role='SUPER_ADMIN');
$$;

alter table public.profiles enable row level security;
alter table public.media enable row level security;
alter table public.reviews enable row level security;
alter table public.profile_unlocks enable row level security;
alter table public.activity_events enable row level security;

create policy "Public can view creators" on public.profiles for select using(role='CREATOR' and is_active=true);
create policy "Users can view own profile" on public.profiles for select to authenticated using(id=auth.uid());
create policy "Admin can view all profiles" on public.profiles for select to authenticated using(public.is_admin());
create policy "Users can update own profile" on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());

create policy "Everyone can view public media" on public.media for select using(visibility='PUBLIC');
create policy "Creator can view own media" on public.media for select to authenticated using(creator_id=auth.uid());
create policy "Unlocked users can view locked media" on public.media for select to authenticated using(visibility='LOCKED' and exists(select 1 from public.profile_unlocks where visitor_id=auth.uid() and creator_id=media.creator_id));
create policy "Creator can add own media" on public.media for insert to authenticated with check(creator_id=auth.uid());
create policy "Creator can update own media" on public.media for update to authenticated using(creator_id=auth.uid());
create policy "Creator can delete own media" on public.media for delete to authenticated using(creator_id=auth.uid());

create policy "Public can view reviews" on public.reviews for select using(is_published=true);
create policy "Admin can create reviews" on public.reviews for insert to authenticated with check(public.is_admin());
create policy "Admin can update reviews" on public.reviews for update to authenticated using(public.is_admin());
create policy "Admin can delete reviews" on public.reviews for delete to authenticated using(public.is_admin());

create policy "Visitor can view own unlocks" on public.profile_unlocks for select to authenticated using(visitor_id=auth.uid());
create policy "Creator can view profile unlocks" on public.profile_unlocks for select to authenticated using(creator_id=auth.uid());
create policy "Visitor can unlock creator" on public.profile_unlocks for insert to authenticated with check(visitor_id=auth.uid());

create policy "Activity events can be created" on public.activity_events for insert with check(true);
create policy "Creator can view own analytics" on public.activity_events for select to authenticated using(profile_id=auth.uid());
create policy "Admin can view all analytics" on public.activity_events for select to authenticated using(public.is_admin());

-- Hardening: users may edit profile presentation fields but not role/is_active.
revoke update on table public.profiles from authenticated;
grant update(username,display_name,bio,avatar_url,cover_url,updated_at) on public.profiles to authenticated;
