# VELOURA V6 — Client Demo QA Checklist

Run V5 migration first if not already applied, then run `supabase/update-v6-studio-polish.sql`.

## ES Studio — Latest V6 fixes
- `/dashboard` loads for CREATOR without errors.
- **Cover photo** has an obvious Upload/Change button outside the image as well as a high-contrast button on the cover itself.
- Selecting a cover image starts visible percentage progress and updates the preview after save.
- Selecting a profile image starts visible percentage progress and updates the avatar.
- **Location Label field is no longer editable.** An information card explains that public location is detected from the current viewer's IP/network.
- Home **Profile Likes** metric has Edit count; valid whole number saves and remains after refresh.
- Negative/decimal/out-of-range profile-like values are rejected.
- Each Media Library card has a like-count edit control and persists the value after refresh.
- Creator cannot edit another creator's media likes by changing the media ID in the API request.

## Content upload
- Publish button is disabled before a file is selected.
- Selecting a photo shows its actual local preview, file name and file size without uploading it yet.
- Selecting a video shows video preview and file information.
- Change replaces the selected file; X clears it.
- `Ready to publish` state appears after file selection.
- During Cloudinary transfer, percentage/progress bar changes.
- After transfer, UI changes to `saving post` while Supabase record is created.
- On success, confirmation appears and new media is immediately visible in Media Library without a manual refresh.
- Form/file selection clears after success.
- Failed Cloudinary upload shows an error and keeps the selected file available for retry.
- Failed Supabase insert shows an error instead of falsely reporting Published.
- PUBLIC media appears on `/u/creator`; LOCKED media remains protected.

## Public profile location
- Open `/u/creator` from a normal visitor network.
- No creator-configured/static location is used in the profile hero/About section.
- Current viewer city/country is shown when Vercel/IP resolution succeeds.
- Visitor stat chip uses the same detected city.
- VPN/mobile network can legitimately change the displayed city; UI labels it as approximate/current-viewer location.
- When city lookup fails, friendly `Location unavailable` copy is shown instead of a fake creator location.

## Like behavior
- Public profile headline likes use `profiles.profile_likes_count`.
- Each media tile uses its own `media.likes_count`.
- Anonymous/user visitor can still like/unlike eligible media.
- Media count changes by ±1 when visitor toggles like.
- Profile-level likes also changes by ±1 when visitor toggles media like.
- Creator's manual profile/media adjustments persist.

## Regression
- Public profile still opens anonymously with no login wall.
- Review auth-on-demand still works.
- Exclusive-content auth/unlock demo still works.
- Admin pages still load.
- Visitor Intelligence still groups one visitor key/IP into one top-level row.
- Phone/email visibility settings still work.
- Mobile dashboard and public profile have no major overlap/overflow.

## Security / deployment
- No environment secrets are included in the ZIP.
- Run `supabase/update-v6-studio-polish.sql` before deploying code that selects `profile_likes_count`.
- Vercel build completes successfully after push.
