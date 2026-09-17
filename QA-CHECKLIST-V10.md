# Veloura V10 QA Checklist

## Database / Deployment
- [ ] Push V10 to `main`.
- [ ] GitHub Actions → **Apply Supabase migrations** succeeds.
- [ ] `chat_threads` exists in Supabase.
- [ ] `chat_messages` exists in Supabase.
- [ ] `cleanup_expired_chats` exists.
- [ ] Cron job `veloura-chat-cleanup-10m` exists under Supabase Cron/pg_cron.

## Public Profile — Mobile Location
- [ ] Open `/u/creator` on iPhone-sized viewport.
- [ ] Stats row shows only Admirers, Photos, Videos.
- [ ] Location is shown in its own row below stats.
- [ ] Copy begins with `Approx.` when city is available.
- [ ] No green location dot appears.
- [ ] Long city/country text does not overlap or leave the card.
- [ ] Desktop still shows approximate viewer location cleanly.

## Guest Chat
- [ ] Public profile shows **Chat** without requiring login.
- [ ] Opening Chat does not redirect to login.
- [ ] Empty-state is clear before the first message.
- [ ] Visitor can send a text message.
- [ ] Sent message appears immediately after refresh/poll.
- [ ] Refreshing the same browser keeps the same temporary conversation.
- [ ] More than 6 visitor sends inside 60 seconds triggers a friendly rate-limit message.
- [ ] Message input blocks empty submissions.
- [ ] Message length is limited to 1,000 characters.
- [ ] If ES phone is configured, **Continue by Text** opens native SMS app on mobile.

## Creator Messages
- [ ] Creator logs into ES Studio.
- [ ] Sidebar has **Messages**.
- [ ] `/dashboard/messages` lists guest conversations.
- [ ] Opening a conversation shows the correct visitor messages.
- [ ] Creator can reply.
- [ ] Visitor receives creator reply on next poll.
- [ ] Creator can block visitor.
- [ ] Blocked visitor cannot send new messages.
- [ ] Creator can unblock visitor and resume chat.

## 24-hour Retention
- [ ] Every new `chat_messages` row has `expires_at` about 24h after `created_at`.
- [ ] Expired rows are excluded by both visitor and creator message APIs.
- [ ] Running `select public.cleanup_expired_chats();` removes expired messages.
- [ ] Cron cleanup runs without errors.
- [ ] Empty inactive thread is removed after the retention window.

## Regression
- [ ] Public Gallery works.
- [ ] Likes work.
- [ ] Client Reviews work.
- [ ] Private Gallery unlock works.
- [ ] Bitcoin/Arrange Payment flow still works.
- [ ] ES Studio profile/media/review tools still work.
- [ ] Admin dashboard still works.
