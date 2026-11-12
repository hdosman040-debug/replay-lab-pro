# Journal and session save protection

The previous client replaced the entire journal/session value without checking what it had loaded. An older tab or phone could overwrite a newer save. The updated client compares the loaded revision in the same database update, preserves conflicting edits in separate local outboxes, and offers a JSON download before reloading the cloud version. It does not automatically merge different trading journals.

## Deployment order

These are incremental migrations for the existing `public.user_state` table, not a full database bootstrap.

1. Apply `add_user_state_revisions` before deploying the frontend. It adds revision and deletion fields and temporarily increments revisions for legacy writes.
2. Deploy this frontend, then verify its production assets and the save/recovery tests.
3. Apply `enforce_user_state_revisions`. Old open tabs will need to reload. The database rejects their unversioned overwrites. Client hard deletes are removed; deletion keeps a versioned tombstone.
4. Run `supabase/tests/user_state_revisions.sql` with administrator access. It uses a random temporary key, exercises authenticated RLS and stale-write rejection, and rolls everything back. Verify existing journal/session values are unchanged and run Supabase advisors.

Do not run both migrations ahead of the frontend rollout. Do not roll back to the old frontend after enforcement. A frontend rollback should keep this storage adapter and recovery notice; removing enforcement reintroduces lost-update risk.

## Recovery behavior

- Only the signed-in account's drafts are loaded or exported.
- A compatible interrupted save resumes automatically after an authenticated cloud read.
- An old draft with no recorded base version, or edits based on a stale version, pause saving. Cloud data is retained and the unsaved copy is downloadable.
- “Download backup & reload cloud” downloads the JSON and archives drafts locally before reloading. If the archive cannot be stored, the app stays open and keeps the drafts.
- Downloads contain raw journal/session state; preserve them for manual reconciliation. There is no automatic JSON merge/import in this change.
- No pre-trade modal or entry gate is added.

## Checks

```sh
npx tsc --noEmit
npx vitest run src/lib/store src/lib/auth/session.test.ts src/components/workspace/tradeRecording.test.ts
npx playwright test --config e2e/save-conflicts.config.ts
npm run build
```

The browser test uses mocked Supabase requests and runs on desktop and Android-sized Chromium. It verifies revision filtering, conflict visibility, backup contents, cloud reload, and mobile overflow. The separate market-data integration tests require configured Supabase environment variables and live historical data.
