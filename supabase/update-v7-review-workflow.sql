-- Veloura Demo - V7 Review Workflow
-- Run ONCE after update-v6-studio-polish.sql.
-- Fixes review verification flow and allows CREATOR-submitted reviews that require Admin verification.

alter table public.reviews
  add column if not exists verified_at timestamptz;

alter table public.reviews
  add column if not exists verified_by uuid references public.profiles(id) on delete set null;

-- V5 allowed only VISITOR and ADMIN. V7 adds CREATOR as a review source.
alter table public.reviews drop constraint if exists reviews_source_check;
alter table public.reviews
  add constraint reviews_source_check check (source in ('VISITOR','ADMIN','CREATOR'));

-- Existing published rows are treated as already verified for display/history.
update public.reviews
set verified_at = coalesce(verified_at, created_at)
where status='PUBLISHED' and verified_at is null;

create index if not exists reviews_creator_status_created_idx
  on public.reviews(creator_id, status, created_at desc);

create index if not exists reviews_verified_at_idx
  on public.reviews(verified_at desc)
  where verified_at is not null;

-- No direct authenticated INSERT/UPDATE grants are added here.
-- Review creation/verification continues through server-side APIs using role checks.
