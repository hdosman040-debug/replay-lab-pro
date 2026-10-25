# Authentication acceptance

## Deployment configuration

- Build with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY for the intended project.
- Use one stable HTTPS app origin. Confirm the deployed Git commit.
- Supabase Site URL must point to that origin; allow its /login and /login?mode=reset URLs. Explicitly allow any staging origins used for email tests.
- Verify confirmation/recovery email templates honor redirect destinations.
- The UI requires at least eight characters for signup/reset. Match the Supabase policy and document any stronger server requirements. Sign-in does not impose a new-password length rule on existing accounts.
- No server auth policy is changed by this patch. Test with disposable staging accounts.

## Automated checks (Linux or GitHub Actions)

```sh
npm ci
npx tsc --noEmit
npm run test:auth
npx playwright install --with-deps chromium
npm run test:e2e
npm run build
```

E2E uses mocked Supabase responses and synthetic credentials. It verifies form submission and navigation, not email delivery, actual server policies, or native password-manager UI. Mobile viewport emulation is not Android Chrome.

## Manual Android checks

Use a regular Chrome tab with Google Password Manager enabled, and a second Chromium browser with its actual configured provider. Record browser/version, provider, origin, commit, and pass/fail; never record passwords or recovery tokens.

1. Signup with a generated password. Toggle visibility. Submit. With email confirmation enabled, the form disappears; follow the email link, sign in, log out, and sign in using the saved credential. Check the saved email and site origin. Generated passwords may save without a separate Save prompt.
2. Repeat with a manually entered password and a second disposable account. Verify Save and subsequent autofill. Try a wrong password: stay on the form, retain entered values, and permit retry.
3. Request a reset. Open the fresh link and verify the account email before generating a new password. A mismatch must not submit. Complete the update; verify the correct saved entry is updated, the new password works, the old one fails, and the other account is unchanged.
4. Try an expired/reused link and a direct /login?mode=reset visit without a recovery event. Show an explicit fresh-link instruction and disable Update. Recovery intent is intentionally document-local: refreshing after the token has been consumed requires a new email link.
5. Open a recovery link while a different account is signed in. Verify the displayed recovery identity and that subsequent workspace data belongs only to that identity. In another tab, sign out/switch accounts and check that an open workspace reloads without exposing the previous account's data.
6. On the deployed build, verify missing configuration produces an explicit message rather than a placeholder-endpoint login request. Restore configuration and rebuild before acceptance.

Keep the PR unmerged until the deployed preview's real Android round trip and staging email flow pass. Browser settings can suppress prompts; absence of a popup alone is not proof that the credential was not saved.
