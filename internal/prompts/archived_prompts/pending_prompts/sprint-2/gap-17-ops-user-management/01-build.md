# Gap 17 - Prompt 01: Build Ops User Management

**Status: COMPLETED 2026-06-21**

**What was built:**
- `db/migrations/006_ops_users.sql` - ops_users table
- `lib/ops-users.ts` - DB helpers (find, create, update, reset token)
- `lib/bootstrap-users.ts` - first-run user seeder from env vars
- `routes/auth.ts` - updated to email+password, password reset endpoints
- `routes/users.ts` - CRUD for user management (superadmin only)
- `middleware/auth.ts` - updated to check userId in session + role
- `views/login.ejs` - added email field
- `views/users/index.ejs` - user list with add/edit/deactivate/reset-password
- `views/users/form.ejs` - shared create/edit form
- `views/reset-password.ejs` - public password-reset page
- `server.ts` - registered usersRouter, bootstrap call on startup
