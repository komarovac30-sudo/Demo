-- VELOURA Demo — Full V5 reference schema for a FRESH Supabase project.
-- Do NOT run this file on an existing project. Existing projects should run
-- supabase/update-v5-full-rework.sql after their prior V3/V4 updates.

create extension if not exists pgcrypto;

create type public.user_role as enum ('SUPER_ADMIN','CREATOR','VISITOR');
create type public.media_type as enum ('PHOTO','VIDEO');
create type public.media_visibility as enum ('PUBLIC','LOCKED');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'VISITOR',
  username text unique not null,
  display_name text not null,
  headline text,
  bio text,
  location_label text,
  avatar_url text,
  cover_url text,
  public_phone text,
  public_email text,
  phone_visible boolean not null default false,
  email_visible boolean not null default false,
  is_verified boolean not null default false,
  exclusive_price numeric(10,2) not null default 24.99 check (exclusive_price >= 0),
  exclusive_currency text not null default 'USD',
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
  likes_count integer not null default 0 check (likes_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  reviewer_name text not null,
  reviewer_first_name text,
  reviewer_last_name text,
  reviewer_avatar_url text,
  rating integer not null check (rating between 1 and 5),
  review_text text not null check (char_length(review_text) <= 1200),
  is_featured boolean not null default false,
  is_published boolean not null default false,
  status text not null default 'PENDING' check (status in ('PENDING','PUBLISHED','REJECTED')),
  source text not null default 'ADMIN' check (source in ('VISITOR','ADMIN')),
  visitor_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.profile_unlocks (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid not null references public.profiles(id) on delete cascade,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  payment_id uuid,
  access_scope text not null default 'CREATOR_LIBRARY',
  unlocked_at timestamptz not null default now(),
  unique(visitor_id, creator_id)
);

create table public.activity_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  visitor_id uuid references public.profiles(id) on delete set null,
  media_id uuid references public.media(id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.media_likes (
  id uuid primary key default gen_random_uuid(),
  media_id uuid not null references public.media(id) on delete cascade,
  visitor_id uuid references public.profiles(id) on delete cascade,
  visitor_key text,
  created_at timestamptz not null default now(),
  check (visitor_id is not null or visitor_key is not null)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid not null references public.profiles(id) on delete cascade,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  media_id uuid references public.media(id) on delete set null,
  amount numeric(10,2) not null check (amount >= 0),
  currency text not null default 'USD',
  provider text not null,
  provider_reference text not null unique,
  status text not null check (status in ('PENDING','CONFIRMED','FAILED','CANCELLED','REFUNDED')),
  access_scope text not null default 'CREATOR_LIBRARY',
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

alter table public.profile_unlocks
  add constraint profile_unlocks_payment_fkey foreign key (payment_id) references public.payments(id) on delete set null;

create index media_creator_idx on public.media(creator_id);
create index reviews_creator_idx on public.reviews(creator_id);
create index reviews_status_idx on public.reviews(status, created_at desc);
create unique index reviews_one_active_visitor_per_creator_idx
  on public.reviews(creator_id, visitor_id)
  where visitor_id is not null and status <> 'REJECTED';
create index unlock_creator_idx on public.profile_unlocks(creator_id);
create index unlock_visitor_idx on public.profile_unlocks(visitor_id);
create index activity_profile_idx on public.activity_events(profile_id);
create index activity_created_idx on public.activity_events(created_at desc);
create index activity_visitor_key_idx on public.activity_events ((metadata->>'visitor_key'));
create index activity_ip_idx on public.activity_events ((metadata->>'ip_address'));
create unique index media_likes_user_unique_idx on public.media_likes(media_id, visitor_id) where visitor_id is not null;
create unique index media_likes_key_unique_idx on public.media_likes(media_id, visitor_key) where visitor_id is null and visitor_key is not null;
create index payments_creator_idx on public.payments(creator_id, created_at desc);
create index payments_visitor_idx on public.payments(visitor_id, created_at desc);
create index payments_status_idx on public.payments(status, created_at desc);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,role,username,display_name)
  values(
    new.id,
    'VISITOR',
    'user_' || left(new.id::text,8),
    coalesce(nullif(new.raw_user_meta_data->>'display_name',''), split_part(new.email,'@',1), 'Visitor')
  );
  return new;
end; $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles where id=auth.uid() and role='SUPER_ADMIN');
$$;

alter table public.profiles enable row level security;
alter table public.media enable row level security;
alter table public.reviews enable row level security;
alter table public.profile_unlocks enable row level security;
alter table public.activity_events enable row level security;
alter table public.media_likes enable row level security;
alter table public.payments enable row level security;

create policy "Public can view active ES profiles" on public.profiles
for select using(role='CREATOR' and is_active=true);
create policy "Users can view own profile" on public.profiles
for select to authenticated using(id=auth.uid());
create policy "Admin can view all profiles" on public.profiles
for select to authenticated using(public.is_admin());
create policy "Users can update own profile" on public.profiles
for update to authenticated using(id=auth.uid()) with check(id=auth.uid());

create policy "Everyone can view public media" on public.media
for select using(visibility='PUBLIC');
create policy "Creator can view own media" on public.media
for select to authenticated using(creator_id=auth.uid());
create policy "Unlocked visitor can view locked media" on public.media
for select to authenticated using(
  visibility='LOCKED' and exists(
    select 1 from public.profile_unlocks u
    where u.visitor_id=auth.uid() and u.creator_id=media.creator_id
  )
);
create policy "Creator can add own media" on public.media
for insert to authenticated with check(creator_id=auth.uid());
create policy "Creator can update own media" on public.media
for update to authenticated using(creator_id=auth.uid());
create policy "Creator can delete own media" on public.media
for delete to authenticated using(creator_id=auth.uid());

create policy "Public can view published reviews" on public.reviews
for select using(is_published=true and status='PUBLISHED');
create policy "Admin can manage reviews" on public.reviews
for all to authenticated using(public.is_admin()) with check(public.is_admin());

create policy "Visitor can view own unlocks" on public.profile_unlocks
for select to authenticated using(visitor_id=auth.uid());
create policy "Creator can view own unlocks" on public.profile_unlocks
for select to authenticated using(creator_id=auth.uid());
create policy "Admin can view all unlocks" on public.profile_unlocks
for select to authenticated using(public.is_admin());

create policy "Activity events can be created" on public.activity_events
for insert with check(true);
create policy "Creator can view own analytics" on public.activity_events
for select to authenticated using(profile_id=auth.uid());
create policy "Admin can view all analytics" on public.activity_events
for select to authenticated using(public.is_admin());

create policy "Public can read like rows" on public.media_likes
for select using(true);
create policy "Signed-in visitor can view own payments" on public.payments
for select to authenticated using(visitor_id=auth.uid());
create policy "Creator can view own confirmed payment ledger" on public.payments
for select to authenticated using(creator_id=auth.uid());
create policy "Admin can view all payments" on public.payments
for select to authenticated using(public.is_admin());

-- Hardening: authenticated users can update only public presentation fields on their own profile.
revoke update on table public.profiles from authenticated;
grant update(username,display_name,headline,bio,location_label,avatar_url,cover_url,public_phone,public_email,phone_visible,email_visible,exclusive_price,exclusive_currency,updated_at)
  on public.profiles to authenticated;
