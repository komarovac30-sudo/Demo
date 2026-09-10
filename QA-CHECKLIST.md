# VELOURA V5 — Client Demo QA Checklist

Run `supabase/update-v5-full-rework.sql` first. For presentation data, also run `supabase/seed-demo-v5.sql`.

## Public Visitor — `/u/creator`

- Profile opens while logged out with **no login wall** and no Visitor login button in the public header.
- Cover, avatar, display name, handle, headline, Miami location label and verified presentation render correctly.
- Phone and email actions are visible only when their ES visibility toggles are enabled.
- Approximate **Visitor city** appears in the public stat strip when IP/Vercel city resolution succeeds; it is hidden rather than showing an ugly error when unavailable.
- Public photos open in the media viewer; public video plays.
- Logged-out visitor can like/unlike public photo/video and count changes.
- Private tiles do not expose unlocked asset URLs through the public profile API response.
- Clicking private content/Unlock starts the gated auth flow.
- Clicking Write a Review starts the gated auth flow.
- Visitor can create a demo account, return to the intended action and continue.
- Review accepts first name, last name, optional image, 1–5 stars and review text; submitted Visitor review is Pending.
- Review with no avatar renders the default avatar after Admin publication.
- Published reviews are visible while logged out.
- Demo checkout clearly says no real payment is processed.
- Successful demo checkout unlocks only the selected ES profile.
- Refresh keeps unlocked access for the signed-in Visitor account.
- Mobile layout has no horizontal overflow and key contact/media/unlock actions are touch friendly.

## ES Studio — `/dashboard`

- CREATOR login lands on clean Home, not an event-heavy analytics page.
- Summary shows Total Visitors, Profile Views, Likes, Unlocks/demo revenue.
- Change Cover opens local-device file picker and updates public profile.
- Change Profile Photo opens local-device file picker and updates public profile.
- Remove Cover/Remove Profile Photo falls back safely without breaking layout.
- Display name, username, headline, location, About, phone/email, visibility and exclusive price save successfully.
- Username validation rejects invalid characters and out-of-range length.
- Post New Content accepts photo/video and PUBLIC/LOCKED selection.
- New PUBLIC media appears publicly.
- New LOCKED media is protected for anonymous Visitors.
- ES can remove own media.
- Advanced opens Visitor Intelligence.
- ES analytics show only the logged-in ES profile's activity.

## Admin — `/admin`

- SUPER_ADMIN sees separate User Type B / Total ES and User Type 3 / Total Visitor Accounts cards.
- Active and disabled ES counts are visible.
- Home remains compact; raw event tables are not shown there.
- `/admin/creators` can create an ES and assign CREATOR role.
- Duplicate username is blocked without leaving an orphan auth account.
- Admin can activate/disable and verify/unverify an ES.
- Disabled ES public route becomes unavailable.
- `/admin/reviews` can create review with First Name, Last Name, optional avatar, stars and text.
- No reviewer avatar uses the default avatar.
- Visitor-submitted Pending review can be Published, returned to Pending, Rejected or Deleted.
- Only Published reviews appear publicly.

## Visitor Intelligence

- Repeated events with the same captured visitor key/IP appear as one top-level row.
- Event-level records remain available in detail view.
- Creator detail URL and Admin detail URL use a hashed visitor key rather than raw IP.
- Detail view shows first/last seen, approximate city/country, device, browser, OS, profile visits, media views, likes and unlocks.
- Events are grouped into 30-minute sessions.
- Content-interest panel reconciles with media events.
- Admin can see platform-wide ES association; Creator cannot see another ES's activity.
- UI includes the caveat that one IP is not guaranteed to equal one physical person.

## Security / Failure Checks

- Vercel contains required Supabase and Cloudinary environment variables.
- No secret keys exist in the Git repository.
- Direct role modification is not available through normal Creator profile update permissions.
- Public activity endpoint rejects unsupported event types and media that does not belong to the selected ES.
- Locked original media URL is null/hidden in unauthorized public profile API payload.
- Failed review/upload/profile save gives a visible error.
- Failed/cancelled real payment must not grant access when a production payment provider replaces DEMO_CHECKOUT.

## Target Browsers / Viewports

- Chrome desktop
- Edge desktop
- Safari desktop where available
- Android Chrome
- iPhone-size Safari viewport
- Tablet width
