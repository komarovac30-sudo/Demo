-- Veloura Demo - V5 Full Rework
-- Run ONCE in Supabase SQL Editor before deploying the V5 application code.
-- This migration evolves the existing Demo schema without deleting current data.

-- 1) ES public profile/contact fields.
alter table public.profiles add column if not exists headline text;
alter table public.profiles add column if not exists location_label text;
alter table public.profiles add column if not exists public_phone text;
alter table public.profiles add column if not exists public_email text;
alter table public.profiles add column if not exists phone_visible boolean not null default false;
alter table public.profiles add column if not exists email_visible boolean not null default false;
alter table public.profiles add column if not exists is_verified boolean not null default false;
alter table public.profiles add column if not exists exclusive_price numeric(10,2) not null default 24.99;
alter table public.profiles add column if not exists exclusive_currency text not null default 'USD';

-- Allow creators to edit presentation/contact fields but never role/status.
revoke update on table public.profiles from authenticated;
grant update(
  username, display_name, bio, avatar_url, cover_url, headline, location_label,
  public_phone, public_email, phone_visible, email_visible,
  exclusive_price, exclusive_currency, updated_at
) on table public.profiles to authenticated;

-- 2) Richer review model while keeping reviewer_name for compatibility.
alter table public.reviews add column if not exists reviewer_first_name text;
alter table public.reviews add column if not exists reviewer_last_name text;
alter table public.reviews add column if not exists status text not null default 'PUBLISHED';
alter table public.reviews add column if not exists source text not null default 'ADMIN';
alter table public.reviews add column if not exists visitor_id uuid references public.profiles(id) on delete set null;

update public.reviews
set reviewer_first_name = coalesce(reviewer_first_name, split_part(reviewer_name, ' ', 1)),
    reviewer_last_name = coalesce(reviewer_last_name, nullif(regexp_replace(reviewer_name, '^\\S+\\s*', ''), '')),
    status = case when is_published then 'PUBLISHED' else 'PENDING' end,
    source = coalesce(source, 'ADMIN')
where reviewer_first_name is null or status is null or source is null;

do $$ begin
  if not exists (select 1 from pg_constraint where conname='reviews_status_check') then
    alter table public.reviews add constraint reviews_status_check check (status in ('PENDING','PUBLISHED','REJECTED'));
  end if;
  if not exists (select 1 from pg_constraint where conname='reviews_source_check') then
    alter table public.reviews add constraint reviews_source_check check (source in ('VISITOR','ADMIN'));
  end if;
end $$;

create index if not exists reviews_status_idx on public.reviews(status);
create index if not exists reviews_visitor_idx on public.reviews(visitor_id);
create unique index if not exists reviews_one_active_visitor_per_creator_idx
  on public.reviews(creator_id, visitor_id)
  where visitor_id is not null and status <> 'REJECTED';

-- Existing public policy stays valid because is_published remains the public gate.
-- Visitor review writes happen through server-side API/service role.

-- 3) Anonymous + signed-in media likes. Keep old likes and add a stable anonymous key.
alter table public.media add column if not exists likes_count integer not null default 0;
create table if not exists public.media_likes (
  id uuid primary key default gen_random_uuid(),
  media_id uuid not null references public.media(id) on delete cascade,
  visitor_id uuid references public.profiles(id) on delete cascade,
  visitor_key text,
  created_at timestamptz not null default now()
);
alter table public.media_likes add column if not exists visitor_key text;
alter table public.media_likes alter column visitor_id drop not null;
create unique index if not exists media_likes_media_visitor_key_idx
  on public.media_likes(media_id, visitor_key)
  where visitor_key is not null;
create unique index if not exists media_likes_media_visitor_id_v5_idx
  on public.media_likes(media_id, visitor_id)
  where visitor_id is not null;
alter table public.media_likes enable row level security;
revoke all on table public.media_likes from anon, authenticated;
grant all on table public.media_likes to service_role;

-- 4) Demo/payment-ready digital entitlement ledger.
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid not null references public.profiles(id) on delete cascade,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  media_id uuid references public.media(id) on delete set null,
  amount numeric(10,2) not null check (amount >= 0),
  currency text not null default 'USD',
  provider text not null,
  provider_reference text,
  status text not null check (status in ('PENDING','CONFIRMED','FAILED','CANCELLED','REFUNDED')),
  access_scope text not null default 'CREATOR_LIBRARY',
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);
create index if not exists payments_creator_idx on public.payments(creator_id, created_at desc);
create index if not exists payments_visitor_idx on public.payments(visitor_id, created_at desc);
create index if not exists payments_status_idx on public.payments(status, created_at desc);
create unique index if not exists payments_provider_reference_idx on public.payments(provider_reference) where provider_reference is not null;
create unique index if not exists payments_confirmed_creator_access_idx
  on public.payments(visitor_id, creator_id)
  where status='CONFIRMED' and access_scope='CREATOR_LIBRARY';
alter table public.payments enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='payments' and policyname='Visitor can view own payments') then
    create policy "Visitor can view own payments" on public.payments for select to authenticated using(visitor_id=auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='payments' and policyname='Creator can view own payments') then
    create policy "Creator can view own payments" on public.payments for select to authenticated using(creator_id=auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='payments' and policyname='Admin can view payments') then
    create policy "Admin can view payments" on public.payments for select to authenticated using(public.is_admin());
  end if;
end $$;
revoke insert, update, delete on table public.payments from anon, authenticated;
grant all on table public.payments to service_role;

-- Link the creator-specific entitlement back to its payment when available.
alter table public.profile_unlocks add column if not exists payment_id uuid references public.payments(id) on delete set null;
alter table public.profile_unlocks add column if not exists access_scope text not null default 'CREATOR_LIBRARY';

-- 5) Visitor intelligence indexes.
create index if not exists activity_visitor_key_idx on public.activity_events ((metadata->>'visitor_key'));
create index if not exists activity_ip_idx on public.activity_events ((metadata->>'ip_address'));
create index if not exists activity_profile_visitor_key_idx on public.activity_events (profile_id, (metadata->>'visitor_key'));

-- 6) Give the existing @creator profile realistic fictional client-demo content.
update public.profiles
set display_name='Sienna Vale',
    headline='Independent companion • Private photo journal',
    location_label='Miami, Florida',
    public_phone='+1 (305) 555-0148',
    public_email='hello@siennavale.demo',
    phone_visible=true,
    email_visible=true,
    is_verified=true,
    exclusive_price=24.99,
    exclusive_currency='USD',
    bio='Warm, polished and easygoing. This fictional demo profile is designed to show a premium public presence, a private media collection, trusted reviews and clear contact options without putting a login wall in front of normal browsing.'
where username='creator' and role='CREATOR';

-- Keep is_published and status synchronized for existing rows.
update public.reviews set is_published=(status='PUBLISHED');
