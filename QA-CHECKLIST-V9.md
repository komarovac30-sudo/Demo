# V9 QA Checklist — Private Access & DB Automation

## Public profile / mobile
- [ ] Public profile loads without login.
- [ ] Skeleton shows while the profile loads.
- [ ] On mobile, location appears in its own row below numeric stats.
- [ ] Location icon, city text and green activity dot remain vertically aligned.
- [ ] Existing horizontal stats scrolling remains usable.

## Private Gallery — Bitcoin
- [ ] Locked media opens the payment-choice modal without forcing signup.
- [ ] Bitcoin option is enabled only when the ES has configured a BTC address.
- [ ] BTC address can be copied.
- [ ] Open Wallet uses a `bitcoin:` link.
- [ ] “I’ve sent the BTC” moves to contact/code confirmation.
- [ ] No wallet seed/private key is requested anywhere.

## Private Gallery — Arrange Payment
- [ ] Arrange Payment shows the configured ES payment contact number.
- [ ] Text button opens the device SMS composer where supported.
- [ ] Contact number can be copied.
- [ ] Payment instructions are readable on mobile.

## Unlock code
- [ ] ES can create/update the code in Private Studio → Payment & Private Access.
- [ ] The code is never returned from the settings API after saving.
- [ ] Wrong code shows a friendly error and does not reveal private media.
- [ ] Ten failed attempts in 10 minutes trigger rate limiting.
- [ ] Correct code reloads the profile with private media available.
- [ ] Refreshing the page during the temporary window keeps access.
- [ ] Access cookie is HTTP-only and expires after one hour.

## Creator Studio
- [ ] BTC address saves.
- [ ] Payment contact number saves.
- [ ] Payment instructions save.
- [ ] Leaving the unlock-code field blank keeps the existing code.
- [ ] Replacing the unlock code invalidates the old code immediately.
- [ ] Existing cover/avatar/content/review functionality still works.

## Database automation
- [ ] GitHub repository contains `.github/workflows/supabase-migrate.yml`.
- [ ] Repository secrets `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_REF` exist.
- [ ] Push to `main` with a new migration triggers “Apply Supabase migrations”.
- [ ] Migration completes before testing V9 private access.
- [ ] Demo seeds do not run automatically.
