# Veloura V13 QA Checklist

## Visitor chat
- [ ] Open Chat from desktop public profile.
- [ ] Open Chat from mobile public profile.
- [ ] Confirm no security banner appears.
- [ ] Confirm subtitle says `Private & Secure Chat. • Messages and photos expire after 24 hours.`
- [ ] Send a text message in Web Chat mode.
- [ ] Send JPG/PNG/WebP payment proof up to 4 MB.
- [ ] Confirm expired messages/photos remain governed by the 24-hour retention flow.

## ES chat
- [ ] Open ES Studio → Messages.
- [ ] Select Visitor A and keep Web Chat enabled.
- [ ] Select Visitor B and enable Force Text.
- [ ] Return to Visitor A and confirm its setting is still Web Chat.
- [ ] Confirm per-visitor mode controls appear beside Block/Unblock.
- [ ] Confirm visitor receives the new mode within the polling interval.
- [ ] Send text reply from ES.
- [ ] Send photo-only reply from ES.
- [ ] Send text + photo reply from ES.
- [ ] Confirm ES photo preview/remove works before Send.
- [ ] Confirm Send remains visible after large received photos.
- [ ] Block and unblock visitor.

## Force Text
- [ ] With one visitor set to Force Text, visitor types text and taps Send.
- [ ] On mobile, native Messages app opens with ES number and typed message prefilled.
- [ ] Confirm visitor must tap the final SMS Send themselves.
- [ ] Confirm the force-text draft is not inserted as a new web-chat message.
- [ ] Confirm another visitor still uses normal Web Chat.

## Migration
- [ ] GitHub Action applies `20260917000500_v13_per_visitor_chat.sql` successfully.
- [ ] `chat_threads.force_sms_only` exists and defaults to false.
