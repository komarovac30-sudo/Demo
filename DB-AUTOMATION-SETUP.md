# V9 — One-time database automation setup

After this one-time GitHub configuration, future SQL migrations placed in `supabase/migrations/` are applied automatically when you push them to `main`.

## Add these GitHub repository secrets
Open **GitHub → your repository → Settings → Secrets and variables → Actions → New repository secret**.

1. `SUPABASE_ACCESS_TOKEN` — create a personal access token in Supabase account settings.
2. `SUPABASE_DB_PASSWORD` — the database password for this Supabase project.
3. `SUPABASE_PROJECT_REF` — the project reference from the Supabase project URL/settings.

Do not put any of these values in the repository or in `.env.example`.

## First V9 deployment
1. Add the three secrets above.
2. Push V9 to `main`.
3. Open **GitHub → Actions → Apply Supabase migrations** and confirm the run succeeds.
4. Vercel can continue its normal GitHub deployment.

The V9 migration is additive, so the app remains compatible while the migration and Vercel deployment occur close together.

## Future releases
Put every database change in a new timestamped file under `supabase/migrations/`. Do not edit an old migration after it has run.

Example:
`supabase/migrations/20260920000100_add_something.sql`

## Demo seed data
Demo seeds are intentionally NOT run automatically on production pushes because they can overwrite real reviews/content. Run demo/reset seeds only when you intentionally want to reset demo data.

## Optional extra secret
`UNLOCK_SESSION_SECRET` can be added to Vercel as a long random secret. If omitted, V9 uses the existing server-only `SUPABASE_SECRET_KEY` to sign temporary unlock cookies.
