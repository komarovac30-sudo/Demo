-- V13: per-visitor message mode.
-- Replaces the V12 creator-wide Force Text behavior with a setting on each chat thread.

alter table public.chat_threads
  add column if not exists force_sms_only boolean not null default false;

comment on column public.chat_threads.force_sms_only is
  'When true, this specific visitor conversation hands new visitor messages to the native SMS composer instead of storing a new web-chat message.';

create index if not exists chat_threads_creator_force_sms_idx
  on public.chat_threads(creator_id, force_sms_only, last_activity_at desc);
