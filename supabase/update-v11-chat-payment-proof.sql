-- V11 chat polish: private payment-proof photos for temporary guest chat.
-- Files are stored in a private Supabase Storage bucket and are only exposed
-- through short-lived signed URLs after guest/creator authorization.

alter table public.chat_messages
  add column if not exists attachment_path text,
  add column if not exists attachment_name text,
  add column if not exists attachment_mime text,
  add column if not exists attachment_size bigint;

alter table public.chat_messages
  drop constraint if exists chat_messages_attachment_mime_check;
alter table public.chat_messages
  add constraint chat_messages_attachment_mime_check
  check (
    attachment_mime is null
    or attachment_mime in ('image/jpeg','image/png','image/webp')
  );

alter table public.chat_messages
  drop constraint if exists chat_messages_attachment_size_check;
alter table public.chat_messages
  add constraint chat_messages_attachment_size_check
  check (attachment_size is null or (attachment_size > 0 and attachment_size <= 4194304));

create index if not exists chat_messages_attachment_expiry_idx
  on public.chat_messages(expires_at)
  where attachment_path is not null;

-- Private bucket. No public read policies are created; the application uses the
-- service role to upload/delete and returns short-lived signed URLs to authorized chat participants.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-attachments',
  'chat-attachments',
  false,
  4194304,
  array['image/jpeg','image/png','image/webp']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Keep the existing database cron cleanup for text-only messages. Attachment rows
-- are hidden after expires_at and then removed together with the private Storage object
-- by the chat API cleanup path. This avoids orphaning Storage objects via direct SQL deletion.
create or replace function public.cleanup_expired_chats()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.chat_messages
  where expires_at <= now()
    and attachment_path is null;

  delete from public.chat_threads t
  where t.last_activity_at <= now() - interval '24 hours'
    and not exists (
      select 1 from public.chat_messages m where m.thread_id = t.id
    );
end;
$$;

revoke all on function public.cleanup_expired_chats() from public;
grant execute on function public.cleanup_expired_chats() to service_role;
