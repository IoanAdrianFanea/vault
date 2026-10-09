# Backlog

Open items only. Each one was checked against the current code.

## To confirm with the stakeholder

- **Project-scoped visibility:** non-admins only see their own projects. It is implemented, but not formally signed off.
- **Storage usage indicator in the sidebar:** only if the stakeholder asks for it.

## Manual checks

- **Re-run the access scenarios against project-scoped visibility:** sign in as a user who belongs to Project A only, with one document in each of Projects A and B. The document list, search and status counts must show only A. `GET /documents/:id`, `/text` and `/download` for the B document must return 404, and `POST /exports` including it must return 404 and export nothing. Also check that a user outside a project can't upload to it and that an admin sees everything.

## Accounts and security

Most of these are planned for Phase 5.5 in the [project plan](project-plan.md).

- **Verification email expiry and resend:** the email says the link is valid for 24 hours, but no expiry is stored or checked, and a lost email can't be resent. Add an expiry column, or an `EmailVerification` table if password-reset tokens are also needed.
- **Password reset:** there is no forgot-password flow.
- **Restrict self-registration:** `POST /auth/register` is public. Accounts need verification and approval, and registration can't complete without SMTP. Optionally allow switching it off for closed deployments.
- **Shared admin guard:** every admin-only handler repeats an inline role check, and `UsersController` throws `BadRequestException` in some places and `ForbiddenException` in others. A `@Roles('ADMIN')` decorator with a guard would remove the duplication and make responses consistent.
- **Unused user fields:** remove `language` and `timezone` from `User`. Nothing reads them.

## Documents and search

- **Search scalability:** `searchDocuments` loads every accessible document with text into memory and filters in JavaScript, returning 20 results. It needs a database-side rewrite (SQLite FTS5) before real data volumes.
- **Pagination:** `GET /documents` returns at most 50 rows. The page says so, but offers no way to see more.
- **Escape search snippets on the server:** the API wraps unescaped file names and text in `<mark>` tags. The client renders them safely, but the API should HTML-escape the text around the tags.
- **Uploader on `GET /documents/:id`:** the response has `projectName` but not `uploadedByEmail`, so the Search drawer can't show who uploaded a document.
- **Edit custom filter values after upload:** values are entered once, at upload.
- **Custom filter values as table columns:** show them as optional columns in the Documents table.
- **Retry processing endpoint:** re-run extraction for a `FAILED` document. The Retry action in the Documents table is a `TODO(backend)` handler.
- **Register PDF export:** render the filtered document register as a PDF. "Generate register PDF" in the export menu is a `TODO(backend)` handler.
- **New project members:** `POST /projects` creates a project with no members. Consider adding the creating admin, or making the next step clearer in the UI.

## Operations

- **Automatic offsite backups:** nightly database copies stay on the persistent disk, and copying them off is manual. Planned for Phase 5.
- **Print document button:** print with a preview. Low priority, Phase 5 if time allows.

## Phase 6

- **Bring the Jobs section back:** the sample-data page (`client/src/pages/Jobs.tsx`, `client/src/components/jobs/`) stays in the repo, unrouted. When Phase 6 adds real jobs, re-add the routes in `App.tsx` and the sidebar link in `AppShell.tsx`, and remove the toast and redirect.

## Phase 7 ideas

- Email attachment ingestion: forward an email to a project address and upload the attachments automatically.
- Offline-friendly viewing: cache recently viewed documents.
- A single native app for laptop, tablet and phone, to be evaluated once the web app is stable.

## Resolved

- **User deletion kept uploaded documents:** documents stay with `uploadedById` set to null and a stored copy of the uploader's email and name (Phase 4.5).
- **Refresh token lookup:** tokens are looked up by session id (`jti`), so several devices can stay signed in (Phase 4.5).
- **Admin account protection:** admins can't delete, demote or deactivate themselves, or remove the last active admin (409) (Phase 4.5).
- **Upload size limit:** 50 MB by default, set with `MAX_UPLOAD_MB`, with a file content check (Phase 4.5).
- **Forced password change on first sign-in:** `mustChangePassword` is set for admin-created users and after an admin sets a password.
- **Full name on self-registration:** the Register page sends it and the server stores it.
- **Custom filter access:** any signed-in user can read the filters. Only admins can manage them.
- **Compression thresholds:** 5 MB and a 10% minimum saving, both configurable.
- **Password policy:** 10 or more characters with an uppercase letter, a lowercase letter, a number and a special character.
- **Project list scoping:** `GET /projects` returns only a member's projects, and admins see all.
