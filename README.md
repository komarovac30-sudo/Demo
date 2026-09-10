# VELOURA — ES Profile Platform Demo (V5 Full Rework)

VELOURA is a fictional client-preview build of the ES Profile Platform described in the SRS. It keeps the existing **Next.js + Supabase + Cloudinary + Vercel** architecture, but reworks the product into three clear experiences:

- **User A / SUPER_ADMIN** — clean command center, ES management, review moderation, Visitor Intelligence.
- **User B / ES / CREATOR** — clean studio, quick metrics, local avatar/cover upload, public profile editing, public/private media publishing, advanced Visitor Intelligence.
- **User C / VISITOR** — public-first profile browsing with no initial login wall. Authentication is requested only for gated actions such as submitting a review or unlocking exclusive digital content.

All names, phone numbers, email addresses, reviews, media artwork, IP addresses and payment records included in the seed are **fictional demo data**. The demo does not copy a real ES identity or review.

## Main V5 routes

```text
/                         Demo landing page
/login                    Private ES/Admin sign-in
/u/creator                Public Sienna Vale demo profile
/dashboard                ES Studio Home
/dashboard/visitors       ES Advanced Visitor Intelligence
/dashboard/visitors/[key] ES visitor detail
/admin                    Admin Home
/admin/creators           ES management
/admin/reviews            Review creation/moderation
/admin/visitors           Platform Visitor Intelligence
/admin/visitors/[key]     Admin visitor detail
```

## V5 highlights

### Public profile
- Cinematic Luxury Dark redesign.
- Cover + avatar + verified presentation + headline + city label.
- Click-to-call / click-to-email contact actions when the ES exposes those fields.
- Public photos/videos viewable while logged out.
- Anonymous public-media likes supported with a stable visitor key.
- Private/exclusive media protected until entitlement exists.
- Published reviews visible without login.
- “Write a review” triggers sign-in/create-account only when clicked.
- Review form: first name, last name, optional local avatar, 1–5 stars, review text.
- Private-content unlock triggers auth only when clicked.
- Demo checkout simulates a confirmed **digital-content** purchase; no real money is charged.

### ES Studio
- Small Home summary: unique visitors, profile views, likes, unlocks and demo revenue.
- Local-device avatar and cover upload through Cloudinary.
- Edit display name, username, headline, location, About, public phone/email and visibility toggles.
- Configure demo exclusive-library price/currency.
- Post new photo/video and choose PUBLIC or LOCKED.
- Recent media management.
- Detailed analytics moved under Advanced / Visitor Intelligence.

### Admin Command Center
- User Type B (ES) and User Type 3 (Visitor Accounts) shown separately.
- Active/disabled ES counts.
- Dedicated ES management page.
- Dedicated review management page.
- Admin can create a review with first name, last name, optional avatar/default avatar, stars and review text.
- Visitor reviews default to Pending and can be Published, returned to Pending, Rejected or Deleted.
- Platform-wide Visitor Intelligence and drill-down.

### Visitor Intelligence
- One captured unique IP/visitor key = one top-level row.
- Event-level history is preserved.
- Raw IP is not placed in the visitor-detail URL; the route uses a hashed key.
- Detail view includes first/last seen, approximate location, device/browser/OS, visits, media views, likes, unlocks, sessions and chronological journey.
- IP-based grouping is an analytics approximation; one IP is not guaranteed to equal one physical person.

## Required Vercel environment variables

Keep your existing values in Vercel. Do not commit secrets.

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SECRET_KEY=...
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

## Upgrade your EXISTING Supabase database

If your current Demo database already has the previous schema/V3 likes/V4 analytics foundation:

1. Open **Supabase → SQL Editor**.
2. Run once:

```text
supabase/update-v5-full-rework.sql
```

3. For a populated client preview, optionally run:

```text
supabase/seed-demo-v5.sql
```

The seed updates the existing `@creator` account to the fictional **Sienna Vale** demo profile and adds synthetic media/reviews/analytics. It does not create login passwords.

For a completely fresh Supabase project, use `supabase/full-schema.sql` instead of the migration, then create your Admin/ES auth users and run the seed.

## Deployment workflow

1. Extract this project ZIP.
2. Copy the **contents** into your local `Demo` GitHub repository folder.
3. Replace the existing application files.
4. Do not overwrite or commit private `.env` values.
5. Run the V5 SQL migration in Supabase before using the new pages.
6. In GitHub Desktop: review changes → Commit to `main` → Push origin.
7. Vercel should deploy automatically.
8. Test `/u/creator`, `/dashboard`, `/dashboard/visitors`, `/admin`, `/admin/creators`, `/admin/reviews`, `/admin/visitors`.

## Demo checkout vs production payment

`/api/exclusive/demo-unlock` intentionally uses `DEMO_CHECKOUT`. It creates a simulated confirmed digital-content payment record and creator-specific unlock so the client can experience the complete flow without a live processor.

Before production:
- replace it with an approved payment provider,
- verify success server-side/webhook-side,
- define refunds/reversals,
- validate the provider/hosting rules for the intended content category,
- complete age/identity/compliance requirements from the SRS.

The project does **not** implement offline/in-person service booking or payment.

## Local development

```bash
npm ci
npm run dev
```

Production validation:

```bash
npm run build
```

## Demo identity

Public demo URL after deployment:

```text
/u/creator
```

The seeded presentation is intentionally fictional:

```text
Sienna Vale
Miami, Florida
+1 (305) 555-0148
hello@siennavale.demo
```

The `.demo` email domain and North American 555 number are placeholders and are not intended to contact a real person.
