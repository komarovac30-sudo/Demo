# Veloura V11 QA Checklist

## Mobile public profile
- [ ] At <=700px, dedicated **Chat with <first name>** button is visible directly below hero.
- [ ] Desktop still shows normal Chat action in profile hero.
- [ ] Mobile stats show Admirers / Photos / Videos.
- [ ] Approximate visitor location appears in its own row/chip with no green status dot.
- [ ] Long city/country names do not overflow.

## Payment contact
- [ ] Open Private Gallery > Arrange Payment.
- [ ] Contact layout shows Text and Copy on first row.
- [ ] Chat appears on second row across full width.
- [ ] Chat closes the payment modal.
- [ ] Chat opens with payment-related draft text pre-filled.
- [ ] BTC > I've sent the BTC > contact screen has the same Chat action.

## Guest chat
- [ ] Chat opens without Visitor login.
- [ ] Text message sends and appears for ES.
- [ ] Photo picker accepts JPG.
- [ ] Photo picker accepts PNG.
- [ ] Photo picker accepts WebP.
- [ ] Unsupported files are rejected.
- [ ] File >4 MB is rejected.
- [ ] Selected photo preview is shown before sending.
- [ ] Selected photo can be removed before sending.
- [ ] Photo can be sent with text.
- [ ] Photo can be sent without custom text.
- [ ] Sent image displays inside Visitor chat.
- [ ] Creator sees image in ES Studio > Messages.
- [ ] Clicking proof image opens signed image URL.
- [ ] Blocked guest cannot send photo or text.
- [ ] Existing rate limit still works.
- [ ] Continue by Text still opens native SMS app on supported mobile device.

## Privacy / retention
- [ ] `chat-attachments` Supabase Storage bucket exists and is PRIVATE.
- [ ] There is no public Storage read policy for chat attachments.
- [ ] Signed attachment URLs expire.
- [ ] Expired chat messages are not returned after 24 hours.
- [ ] Expired attachment messages are not returned after 24 hours.
- [ ] On subsequent chat API activity, expired private Storage objects are removed.

## Migration automation
- [ ] GitHub Actions migration workflow starts after push containing V11 migration.
- [ ] `SUPABASE_ACCESS_TOKEN` secret exists.
- [ ] `SUPABASE_PROJECT_REF` secret exists.
- [ ] `SUPABASE_DB_PASSWORD` secret exists.
- [ ] Migration finishes green before testing chat photo upload.
