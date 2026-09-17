-- V12 chat refinement
-- Adds an ES-controlled visitor chat mode. When enabled, visitor Send opens
-- the phone's native SMS composer with the typed text prefilled instead of
-- storing a new web-chat message.

alter table public.profiles
  add column if not exists chat_force_sms_only boolean not null default false;

comment on column public.profiles.chat_force_sms_only is
  'When true, visitor chat composer hands typed text off to the native SMS app instead of posting a new web chat message.';
