# Veloura V12 QA Checklist

## Migration
- [ ] GitHub Action `Apply Supabase migrations` is green.
- [ ] `profiles.chat_force_sms_only` exists and defaults to `false`.

## Creator chat layout
- [ ] Open `/dashboard/messages`.
- [ ] Select a thread containing a large payment-proof image.
- [ ] Scroll the message history.
- [ ] Reply input and Send button remain visible at the bottom.
- [ ] A newly received proof image does not push the composer outside the panel.

## Copy / security notice
- [ ] Visitor chat header shows `Private Chat`.
- [ ] Old text `Simple private web chat • messages and photos expire after 24 hours` is gone.
- [ ] Security notice appears on the first chat open in a fresh browser/storage state.
- [ ] Close and reopen: the notice does not keep appearing.
- [ ] Creator Messages page also shows the security notice only once per browser.
- [ ] UI does not claim end-to-end encryption.

## Web Chat mode
- [ ] In ES Studio > Messages select `Web Chat`.
- [ ] Public visitor can send text.
- [ ] Public visitor can attach JPG/PNG/WebP proof up to 4 MB.
- [ ] Creator receives text/photo.
- [ ] 24-hour expiry behavior remains unchanged.

## Force Text mode
- [ ] Select `Force Text` in ES Studio > Messages.
- [ ] Refresh public profile/chat.
- [ ] Photo attachment button is hidden.
- [ ] Type a message and press Send on Android/iPhone.
- [ ] Native Messages/SMS composer opens with ES phone number and typed text prefilled.
- [ ] The SMS is NOT auto-sent; user must tap Send in the native app.
- [ ] Typed text remains available as a local browser draft if visitor returns.
- [ ] No new web-chat message is stored for that Send action.
- [ ] On desktop, typed text is copied and a clear phone-number handoff message appears.

## Existing chat
- [ ] Existing web messages remain readable after enabling Force Text until they expire.
- [ ] Creator can still reply to existing web threads.
- [ ] Block/unblock still works.
