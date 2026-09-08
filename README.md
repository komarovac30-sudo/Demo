# CreatorSpace Demo

A complete client-preview project built with Next.js, Supabase and Cloudinary.

## Included flows

- User A / Super Admin
  - Login
  - Create User B / Creator accounts
  - Add reviews
  - View recent activity
- User B / Creator
  - Login
  - Edit public profile
  - Upload photo/video directly to Cloudinary
  - Mark content Public or Locked
  - View recent analytics events
- User C / Visitor
  - Browse public creator profile without login
  - See locked-content cards
  - Enter an email + demo-site password
  - New visitors are created automatically as confirmed VISITOR accounts
  - Successful access is stored in `profile_unlocks`
- Activity tracking
  - PROFILE_VIEW
  - PHOTO_VIEW
  - VIDEO_PLAY
  - LOCKED_CONTENT_SEEN
  - UNLOCK_CLICK
  - UNLOCK_SUCCESS

## Environment variables

Your Vercel project should contain:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SECRET_KEY=...
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

Never commit the secret values to GitHub.

## Before deploying

1. Your existing Supabase tables should already be present:
   - profiles
   - media
   - reviews
   - profile_unlocks
   - activity_events
2. User A should have role `SUPER_ADMIN`.
3. User B should have role `CREATOR` and username `creator`.
4. Run `supabase/rls-hardening.sql` once if you have not already done so.

## Deploy through your existing GitHub -> Vercel connection

1. Extract this ZIP.
2. Open the extracted `creator-demo-project` folder.
3. Upload **the contents inside the folder** to the root of `fill-boop/Demo` (do not upload the outer folder itself).
4. Commit to `main`.
5. Vercel automatically detects the commit and builds the app.
6. Open Vercel -> Deployments and wait for `Ready`.

## Add demo content

After the first successful deployment, open Supabase -> SQL Editor and run:

`supabase/seed-demo.sql`

This populates the existing `creator` profile with local demo images/video and three reviews.

## Demo login accounts

Use the User A and User B credentials you created in Supabase Authentication. This project intentionally does not hard-code those passwords.

## Important demo-auth note

The Visitor unlock modal accepts credentials for **this demo website only**. It does not ask for or use Gmail, Facebook, or any external-service password.

## Local development (optional)

```bash
npm install
cp .env.example .env.local
npm run dev
```
