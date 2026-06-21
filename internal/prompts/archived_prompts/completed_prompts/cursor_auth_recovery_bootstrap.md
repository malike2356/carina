Use this prompt in Cursor or Claude:

  In the core.carinaai.uk codebase, implement a real password recovery and bootstrap path for hosted auth so I can
  regain access to https://core.carinaai.uk/login without touching the database by hand.

  Current problem:
  - The live database does not have the hosted_users table.
  - The hosted login path exists in src/api/hosted-auth.ts, but there is no recovery flow.
  - I need a safe way to create or reset the hosted user password and get back into core.carinaai.uk.
  - Do not invent a fake password. Build the recovery flow in code.

  What to build:
  1. Make hosted auth self-healing
  - Ensure hosted migrations run before login/reset paths, not only on first register.
  - If hosted_users or other hosted auth tables are missing, create them automatically before auth operations.

  2. Add password reset support for hosted accounts
  - Add a password reset flow for hosted users.
  - Add endpoints for:
    - request password reset
    - confirm reset with token
  - Reset flow should work for hosted accounts created by registerUser.

  3. Add an operator recovery path that works even if email is not configured
  - Create a CLI command for operators, something like:
    - `carina hosted reset-password <email> <new-password>`
    - or `pnpm hosted:reset-password --email ... --password ...`
  - The CLI should:
    - run hosted migrations first
    - create the account if it does not exist, or update the password if it does
    - never print the password back to the terminal
    - print only success/failure and the affected email
  - This is the practical recovery path I can use today.

  4. Add a small UI flow if the app already has hosted login screens
  - Add a “Forgot password” link to the hosted login page.
  - If email delivery is configured, send a reset link.
  - If email is not configured, the page should still point users to the operator recovery path instead of failing
  silently.

  5. Make the implementation safe
  - Never log plaintext passwords or reset tokens.
  - Hash reset tokens before storing them.
  - Expire reset tokens after a short window, like 1 hour.
  - Invalidate tokens after use.

  6. Update tests
  - Add tests for hosted auth migrations running before login/reset.
  - Add tests for requesting a reset and completing it.
  - Add tests for the CLI recovery path.
  - Add tests for the “no hosted_users table yet” case.

  Files to inspect first:
  - src/api/hosted-auth.ts
  - src/api/hosted-web.ts
  - src/api/hosted.ts
  - src/api/hosted-migrations.ts
  - src/gateway/web.ts
  - any CLI command structure already used in the repo for admin operations

  Acceptance criteria:
  - I can recover or set a hosted login password from code, without DB surgery.
  - If the hosted auth tables are missing, the app can recreate them.
  - The login page has a real recovery path.
  - Tests pass.
  - No plaintext secrets are logged.

  Keep the change focused on hosted auth recovery. Do not refactor unrelated billing, Scout, or ops code unless
  required for the reset flow.

  If you want, I can also write a second prompt that adds a one-time bootstrap admin account for hosted auth, which is
  the fastest fallback if you want immediate access.


› yes


• Use this as the fallback prompt:

  In the core.carinaai.uk codebase, add a one-time hosted auth bootstrap mechanism so I can regain access immediately
  if the hosted_users table is missing or the login account was lost.

  Goal:
  - Provide a safe bootstrap path for the hosted login at https://core.carinaai.uk/login.
  - This is only for recovery and first-run setup.
  - Do not hard-code or invent a password in source.

  What to implement:
  1. Bootstrap env support
  - Add support for an env-driven bootstrap account, for example:
    - HOSTED_BOOTSTRAP_EMAIL
    - HOSTED_BOOTSTRAP_PASSWORD
  - If these are set, the hosted auth layer should ensure the account exists on startup or on first auth use.
  - If the account already exists, do not overwrite it unless an explicit reset flag is set.

  2. First-run recovery behavior
  - If hosted_users is missing, run hosted migrations automatically.
  - If HOSTED_BOOTSTRAP_* is present, create the bootstrap user with the given email/password.
  - If the bootstrap account exists, log a safe message that recovery is ready.
  - Do not print the password.

  3. Safe reset behavior
  - Add an explicit operator command or script flag to reset the bootstrap account password when needed.
  - The reset must be deliberate, e.g.:
    - `carina hosted bootstrap --reset`
  - Never reset passwords automatically without an explicit operator action.

  4. Login flow integration
  - Make sure the login code path can use the bootstrap account without special casing the UI.
  - The normal login form should work as-is once the bootstrap account exists.

  5. Documentation
  - Document the recovery flow in the repo instructions or README.
  - Include:
    - which env vars to set
    - when to use the bootstrap account
    - how to rotate or clear it after recovery

  6. Tests
  - Add tests for:
    - bootstrap account creation
    - no overwrite unless reset flag is set
    - hosted_users missing and migrations auto-run
    - successful login with bootstrap account

  Acceptance criteria:
  - I can regain access to hosted core login from an env-based bootstrap account.
  - The bootstrap path is safe, explicit, and recoverable.
  - No plaintext password is logged.
  - The app still behaves normally after the bootstrap account exists.

  Keep the change narrowly scoped to hosted auth recovery and bootstrap logic.

  Use the first prompt if you want a proper reset system. Use this one if you want the fastest path to get back in.


