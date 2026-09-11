# VELOURA V7 — Review Workflow QA Checklist

Run `supabase/update-v7-review-workflow.sql` after V6 before testing Creator review submission.

## 1. Admin manual review — reset bug
- Open `/admin/reviews` as SUPER_ADMIN.
- Select an ES.
- Enter first name, last name, rating and review text.
- Optionally upload reviewer image.
- Click Save review.
- Review saves successfully.
- Success message appears only once.
- `Cannot read properties of null (reading 'reset')` does NOT appear.
- Form clears only after successful save.
- If no image was uploaded, default reviewer avatar is shown.

## 2. Creator-submitted review
- Open `/dashboard` as CREATOR.
- Scroll to Reviews.
- Enter reviewer first name + last name.
- Optionally select reviewer image; preview appears.
- Select 1–5 stars.
- Enter at least 10 characters of review text.
- Click `Submit for verification`.
- Success message confirms Admin verification is required.
- New review appears in Creator list as PENDING.
- Review does NOT appear publicly yet.
- Multiple Creator-submitted reviews are allowed because they represent reviews received from different people.

## 3. Admin verification
- Open `/admin/reviews`.
- Pending count includes the Creator-submitted review.
- Source chip says `Creator submitted`.
- Click Verify.
- Success message says `Review verified and published.`
- Status becomes VERIFIED/PUBLISHED.
- Refresh page; verified state remains.
- Move review back to Pending; it disappears from public page.
- Verify again; it reappears publicly.
- Reject hides it publicly.
- Delete removes it permanently.

## 4. Public review presentation
- Open `/u/creator` while logged out.
- Open Reviews tab.
- Only PUBLISHED reviews are visible.
- Published review label says `Verified review`.
- Text `Verified demo review` is not present.
- Reviewer avatar shows uploaded image or default avatar.
- Rating stars and review text render correctly.

## 5. Visitor review regression
- Logged-out Visitor can read published reviews.
- Click Write a review; authentication appears only then.
- After Visitor login/registration, review form works.
- Visitor review is saved as PENDING.
- Admin can Verify it.
- One active Visitor review per Visitor + ES remains enforced.

## 6. Review image upload
- CREATOR can upload review avatar.
- SUPER_ADMIN can upload review avatar.
- VISITOR can upload review avatar.
- Unsupported/failed upload shows an error.
- No image uses `/demo/reviewers/default-reviewer.svg`.

## 7. Security
- Creator can submit reviews only for own creator ID.
- Creator cannot mark own review PUBLISHED through POST payload manipulation.
- Only SUPER_ADMIN can call the moderation PATCH endpoint.
- Direct authenticated DB write permission was not added for review status verification.
- Public API returns published reviews only.

## 8. V6 regression
- Content upload preview/progress works.
- Cover/avatar upload works.
- Profile/media like edit works.
- Public visitor location still uses current viewer network/IP approximation.
- Visitor Intelligence still works.

## V8 — Skeleton & Experience Polish

- [ ] Public profile route shows structured skeleton while data loads.
- [ ] ES Studio shows dashboard skeleton while auth/profile data loads.
- [ ] Admin Home shows dashboard skeleton while counts load.
- [ ] Admin ES management and Reviews show list skeletons.
- [ ] Visitor Intelligence and visitor detail have skeleton states.
- [ ] Skeleton shimmer respects reduced-motion preference.
- [ ] Public tabs read Gallery / Client Reviews / About Me.
- [ ] Public hero shows Discreet / Refined / Private mood tags.
- [ ] Profile total likes are labeled Admirers.
- [ ] Contact buttons read Direct Call / Private Email.
- [ ] Private content wording consistently uses Private Collection / Private Gallery.
- [ ] Public review cards display Verified Review.
- [ ] ES Studio uses Add to My Gallery / My Gallery / Client Reviews / Profile Insights wording.
- [ ] Running seed-demo-v8.sql creates exactly 20 published fictional reviews for @creator.
- [ ] Review average/rating count renders correctly with 20 rows.
- [ ] V7 Creator -> Pending -> Admin Verify -> Public review flow still works after V8 UI changes.
