-- V10 lightweight guest chat.
-- Text only, no login for visitors, simple polling, and 24-hour retention.

create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  guest_key_hash text not null,
  guest_label text not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','BLOCKED')),
  created_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now()
);

create unique index if not exists chat_threads_creator_guest_unique
  on public.chat_threads(creator_id, guest_key_hash);
create index if not exists chat_threads_creator_activity_idx
  on public.chat_threads(creator_id, last_activity_at desc);

create table if not exists public.chat_messages (
  id bigint generated always as identity primary key,
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  sender_type text not null check (sender_type in ('VISITOR','CREATOR')),
  message text not null check (char_length(message) between 1 and 1000),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);

create index if not exists chat_messages_thread_created_idx
  on public.chat_messages(thread_id, created_at asc);
create index if not exists chat_messages_expiry_idx
  on public.chat_messages(expires_at);

alter table public.chat_threads enable row level security;
alter table public.chat_messages enable row level security;
revoke all on table public.chat_threads from anon, authenticated;
revoke all on table public.chat_messages from anon, authenticated;
grant all on table public.chat_threads to service_role;
grant all on table public.chat_messages to service_role;

create or replace function public.cleanup_expired_chats()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.chat_messages where expires_at <= now();
  delete from public.chat_threads t
  where t.last_activity_at <= now() - interval '24 hours'
    and not exists (
      select 1 from public.chat_messages m where m.thread_id = t.id
    );
end;
$$;

revoke all on function public.cleanup_expired_chats() from public;
grant execute on function public.cleanup_expired_chats() to service_role;

-- Supabase hosted projects support pg_cron. The job runs every 10 minutes and physically
-- removes expired messages. APIs also hide/delete expired rows before returning data.
-- The guarded block keeps deployment safe if Cron is temporarily unavailable.
do $outer$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron could not be enabled; API cleanup will still hide and purge expired chat opportunistically.';
  end;

  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'veloura-chat-cleanup-10m',
      '*/10 * * * *',
      'select public.cleanup_expired_chats();'
    );
  end if;
end
$outer$;
