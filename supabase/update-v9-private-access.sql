-- V9 private-access/payment settings. Additive and safe to run against an existing V8 database.
create table if not exists public.creator_payment_settings (
  creator_id uuid primary key references public.profiles(id) on delete cascade,
  btc_address text,
  contact_phone text,
  instructions text,
  unlock_code_hash text,
  unlock_code_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.creator_payment_settings enable row level security;
revoke all on table public.creator_payment_settings from anon, authenticated;
grant all on table public.creator_payment_settings to service_role;

create index if not exists creator_payment_settings_updated_idx on public.creator_payment_settings(updated_at desc);

-- Seed only safe payment presentation fields for the existing demo profile. No unlock code is seeded.
insert into public.creator_payment_settings (creator_id, contact_phone, instructions)
select id, public_phone, 'Send payment, then text me with your payment reference. I’ll confirm it and send your private-gallery unlock code.'
from public.profiles where username='creator' and role='CREATOR'
on conflict (creator_id) do nothing;

-- Lightweight brute-force protection for anonymous unlock-code checks.
create table if not exists public.unlock_code_attempts (
  id bigint generated always as identity primary key,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  visitor_key text not null,
  succeeded boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists unlock_code_attempts_rate_idx on public.unlock_code_attempts(creator_id, visitor_key, created_at desc);
alter table public.unlock_code_attempts enable row level security;
revoke all on table public.unlock_code_attempts from anon, authenticated;
grant all on table public.unlock_code_attempts to service_role;
