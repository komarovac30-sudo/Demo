# V14 QA Checklist

## Migration
- [ ] GitHub Action applies `20260918000100_v14_profile_trust_details.sql` successfully.
- [ ] Existing profile/media/review/chat data is preserved.

## Creator Studio
- [ ] Age rejects values below 18.
- [ ] Height / body type / ethnicity / hair / eyes / measurements / cup / languages / tattoos-piercings save correctly.
- [ ] Blank optional details stay hidden on the public profile.
- [ ] Public profile QR renders after page load.
- [ ] Copy profile link copies the correct `/u/{username}` URL.

## Public About
- [ ] Only populated detail fields appear.
- [ ] Details wrap cleanly on mobile.
- [ ] About text and trust cards do not overlap.

## Reviews
- [ ] Average rating equals published reviews.
- [ ] 5→1 rating distribution counts reconcile with review cards.
- [ ] All / 5★ / 4★ / Featured filters work.
- [ ] Clicking a rating row filters to that exact star value.
- [ ] Verified Review label appears.
- [ ] Show more works after filtering.

## Private Gallery
- [ ] Photo/video private counts are correct.
- [ ] Locked preview stays protected.
- [ ] Unlock opens existing payment/access flow.
- [ ] Unlocked media still behaves as before.

## Sharing
- [ ] Header Share opens share modal.
- [ ] Mobile Share opens the same modal.
- [ ] Copy link works.
- [ ] Device Share works where supported.
- [ ] SMS share opens the Messages app on mobile.
- [ ] WhatsApp and Telegram links open correctly.
- [ ] QR scans to the current public profile URL.

## Mobile action bar
- [ ] Sticky Call / Text / Chat / Share bar appears on <=700px.
- [ ] Existing duplicate mobile Chat CTA is hidden.
- [ ] Action bar respects device safe area and does not cover content.
- [ ] Call/Text are hidden when no public phone is available.

## Regression
- [ ] Public media likes work.
- [ ] Review submission still works.
- [ ] Temporary chat still works.
- [ ] Payment/unlock still works.
- [ ] Creator gallery upload still works.
