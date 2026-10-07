# SPDD Analysis: Phase 4.5 — Pilot readiness

## Summary for Review

**What this does.** Makes DocIndex safe for its first real user on Render. Deleting a user no longer deletes documents. Admins can't lock themselves out, and users aren't signed out unexpectedly. It adds basic security hardening, migrations that run on start and nightly database backups. It also adds an optional "save to a folder on this PC" setting for Chrome and Edge.

**How it works today.** I checked the brief's audit against commit 61ecf0b and it's accurate. I also found the following:
- The compiled server entry is `dist/src/main.js`, not `dist/main.js`, because `prisma.config.ts` sits beside `src/`. `start:prod` is already wrong.
- Sign-in matches the email exactly, capitals included. Register and admin-create don't lowercase the email, so typing it with different capitals fails.
- Changing your own email clears the verified flag. Without SMTP the user can never verify, so they're locked out at their next sign-in.
- The Users page has Edit, Change role and Delete only. Status changes exist only on Pending, which never lists active users.
- Search results carry no project name. Three client downloads read `filename="…"` with a regex that breaks on encoded names. The exports ZIP also hand-builds its header.
- Upload redirects to Documents 1.5 s after success. React StrictMode runs start-up effects twice in dev.

**What will change.**
- **Database:** one migration. Document gets an optional uploader plus uploader email and name copies, backfilled. Existing active users are marked verified.
- **Backend:**
  - Account and session: status checks in auth, refresh by token id, guards against admin self-lockout.
  - Hardening: config validation, security headers, rate limits, stricter CORS, an upload size and content check, safe download headers.
  - Operations: a quieter email fallback, friendly extraction errors, backups, migrations on start, docs.
- **Frontend:**
  - Sessions: one request helper with silent refresh, used by every API file, plus silent sign-in on load.
  - Admin guard UI, copy fixes, an upload size check, and a Files tab with a save-to-folder helper used by 5 download and upload paths.

**What will NOT change.** Storage layout and file keys stay the same, so no files move on the production disk. Visibility rules, the recycle bin and purge, and roles stay the same. Request and response shapes stay the same apart from new fields. No new UI libraries.

**Assumptions (confirmed at review).**
1. Groups A–E are build checkpoints, not separate deploys. Group A's migration needs Group C's migrate-on-start, so the first deploy comes after Group C, with a manual copy of the database taken first.
2. "Up to 7 days" means 7 days since last use, because each refresh restarts the clock, as today.
3. Backup and purge times are server time, which is UTC on Render.
4. The README, `.env.example`, the "Upload size limit" bullet in the backlog's "To Confirm" list and the existing "Email Verification Token Expiry" entry are updated rather than duplicated.
5. Render's build installs dev dependencies, so the `prisma` command is there at start. I'll remove the stale e2e test, because the full app won't boot in tests without real secrets.

**Top 3 risks.**
1. The Document migration rebuilds a table that holds live data. The backfill must be in the same migration, with a manual backup first.
2. Every API file gets new request code, so any screen could break. Two refreshes at once (two tabs, or StrictMode in dev) sign the user out, because the first revokes the token the second sends.
3. Security headers only apply to the production build, so a strict policy could break preview, fonts or downloads unnoticed.

**Decisions from review** (all recommendations accepted; details under Resolved Questions).
1. The start script runs `node dist/src/main`, and `start:prod` is fixed too.
2. Sign-in email is case-insensitive. New emails are lowercased on register and admin-create. Stored emails aren't rewritten.
3. Without SMTP, a self email change is refused ("Ask an admin to change your email"), and an admin's email edit counts as verified.
4. Self-registration without SMTP stays as it is and is documented in `docs/deploy.md`.
5. Search results gain `projectName` (a small server addition in Group E).
6. ZIP and CSV exports go to the project folder when every item is from one project, otherwise to the folder root.
7. The backup service is a documented exception to the "no `fs` in services" rule.
8. No deactivate-user UI in this phase.
9. Refresh races are prevented with Web Locks across tabs plus one in-flight refresh per tab.

## Resolved Questions

The reviewer replied "Confirmed: accept all recommendations and continue" on 7 Oct 2026. Each answer below is a settled requirement.

| # | Question | Answer |
|---|----------|--------|
| RQ1 | The build emits `dist/src/main.js` (because `prisma.config.ts` sits at the server root), so the brief's `start:render` = `prisma migrate deploy && node dist/main` would fail. Which path? | `start:render` runs `prisma migrate deploy` then `node dist/src/main`. `start:prod` is corrected to `node dist/src/main` as well. The Render Start Command is `npm run start:render`. |
| RQ2 | Sign-in uses an exact, case-sensitive email lookup, and register and admin-create store the email as typed. Normalise? | Yes. Email is trimmed and lowercased on register, admin-create and self email change (A4). Sign-in finds the account case-insensitively, so existing mixed-case accounts still work. Stored emails are not rewritten by the migration, to avoid unique-key collisions. |
| RQ3 | A self email change clears `emailVerifiedAt`. Without SMTP the user can't verify and is locked out at the next sign-in. How to prevent it? | While SMTP isn't configured, the server refuses a self email change with a clear message telling the user to ask an admin. An admin's email edit (`PATCH /users/:id`) sets `emailVerifiedAt` and clears any pending verification token, because the admin vouches for the address, as in P3. |
| RQ4 | Without SMTP, self-registered accounts can never verify, so approving them doesn't let them sign in. | No change in behaviour. `docs/deploy.md` states that self-registration needs SMTP, and pilot accounts are created from the admin page (P8). |
| RQ5 | Search results carry no project name, so downloads from Search can't go to `<folder>/<project>/`. | Add `projectName` to each search result. This is an additive server change made in Group E, so Group E is self-contained. |
| RQ6 | ZIP and CSV exports can span several projects. Which folder? | `<folder>/<project>/` when every exported item belongs to one project, otherwise the folder root. The admin archive ZIP always goes to the folder root (as in the brief). |
| RQ7 | Backups need direct file-system access (temporary file, rename, prune), but project rules forbid `fs` in services and route file access through `BlobStore`. | Allowed as a documented exception. The `BlobStore` rule covers document files, and backups are database infrastructure in their own module, with every path built only from config and a timestamp. |
| RQ8 | No UI exists to move an ACTIVE user to a non-ACTIVE status. Add one? | No. P2 is enforced on the server. On the Users page only Delete and Change role are guarded. Deleting a user is now safe (P1). |
| RQ9 | With token rotation, two refreshes at once using the same cookie (two tabs, or React StrictMode in dev) make the second one fail and sign the user out. | One in-flight refresh per tab, serialised across tabs with the browser's built-in Web Locks API. No new dependency and no server grace window. |
| RQ10 | The summary's assumptions. | All confirmed. (1) Groups A–E are build checkpoints, not separate deploys, and the first production deploy happens after Group C with a manual database copy taken first. (2) "Up to 7 days" is a sliding window from last use. (3) Backup and purge times are server time (UTC on Render). (4) README, `.env.example` and the backlog are updated in place. The "Upload size limit" bullet in "To Confirm With Stakeholder" is marked resolved, and the existing "Email Verification Token Expiry" entry becomes "Verification email resend + token expiry" rather than a duplicate. (5) Render's build installs dev dependencies, so the `prisma` CLI is available at start. The stale e2e test is removed, along with its config and script. |

## Original Business Requirement

> Source: the requirement pasted into the `/spdd-analysis` request, reproduced verbatim below. The paste arrived with its tables flattened to one cell per line (for example the Decisions, Rate limit values and Acceptance criteria tables); they're kept exactly as pasted. Where the brief and the Resolved Questions differ (for example the `node dist/main` start path), the Resolved Questions win.

/spdd-analysis

# Phase 4.5 — Pilot readiness

**Goal:** make DocIndex Manager safe and usable for a first real user (the stakeholder, a non-technical site manager) on the hosted site (Render, one instance, SQLite and files on the persistent disk). Nothing must be able to lose company documents, lock him out or log him out unexpectedly, and he must be able to pick a folder on his PC where files get saved.

This is one SPDD run. The canvas must group its Operations into the **ordered groups A–E** below. Each group must leave `npm run build:full` (from `server/`) passing on its own, because `/spdd-generate` is run one group at a time. Operations may depend on earlier groups, never on later ones.

## Verified current state (audit of commit 61ecf0b — trust these, re-check only what you change)

- `Document.uploadedById` is non-nullable with `onDelete: Cascade` (`schema.prisma:103-104`). `UsersService.deleteUser` is a plain `prisma.user.delete` (`users.service.ts:178`). Deleting a user hard-deletes their Document, DocumentText and DocumentFilterValue rows, leaves their files orphaned on disk and writes no DeletionLog entry.
- The only server read of the uploader is `documents.service.ts:477` `uploadedByEmail: doc.uploadedBy.email`. On the client, every read is already null-safe.
- `AuthService.validateUser` (used by `JwtStrategy`) and `AuthService.refresh` only check that the user exists, not `accountStatus`. Changing status or role revokes no refresh tokens. Only `changePassword` and `logout` do.
- `refresh()` looks up the **most recent** non-revoked token for the user, not the presented one, so signing in on a second device or tab breaks the first one's refresh.
- **No self-protection or last-admin protection:** an admin can delete, demote or reject themselves or the last admin, on both the server and the client (`AdminUsers.tsx:367-384`, `AdminPending.tsx`).
- `createUser` doesn't set `emailVerifiedAt` and `login` rejects unverified users (`auth.service.ts:113`), so **admin-created users can never sign in**. The create-user modal copy says they can.
- `updateMe` doesn't lowercase a changed email (`auth.service.ts:381`).
- When SMTP isn't configured, `EmailService` logs the full email HTML, **including the raw verification link** (`email.service.ts:44,85`).
- **No `helmet`, no rate limiting, no `trust proxy`.**
- **CORS** (`main.ts:22-44`) also allows `localhost`, `127.0.0.1` and `*.local` in production, and throws an `Error` for disallowed origins.
- **Uploads:** `FileInterceptor('file')` has no `limits` and uses memory storage. The type check uses only the client-sent `file.mimetype`. The client already handles a 413 (`client/src/api/documents.ts:123`). The Upload page shows no size limit.
- **`Content-Disposition`** interpolates raw filenames (`documents.controller.ts:112`, `archive.controller.ts:68`).
- **Config:** `ConfigModule.forRoot` has no validation. If `JWT_REFRESH_SECRET` is missing, refresh tokens are likely signed with the access secret. The refresh cookie `maxAge` is hard-coded to 7 days.
- **Extraction errors:** raw internal error messages (pdf-parse, filesystem) are stored in `Document.errorMessage` and shown to users (`documents.service.ts:234`).
- **Migrations:** there's no `prisma migrate deploy` anywhere (no `render.yaml`, no script). Render's disk is unavailable during build, so migrations can only run at start.
- **Database:** SQLite through `PrismaBetterSqlite3`, with no WAL. The only cron is `purge.task.ts` (daily 03:00).
- **Client sessions:**

- The access token is in `sessionStorage` (`Login.tsx:32`).
- **The client never calls `/auth/refresh`.** On a 401 the API functions just throw, with no retry and no redirect, so users hit errors once the 15-minute access token expires.
- The API base URL comes from `VITE_API_URL`, falling back to `http://localhost:3000` (`client/src/api/auth.ts:2`).
- **Client downloads** use blob + anchor in `api/exports.ts` (document download, ZIP export), `api/archive.ts:116` and `utils/csv.ts:34`.
- **Client upload:** `Upload.tsx` `handleUploadAll` uploads files one at a time via `documents.ts` `uploadDocument` (FormData).
- **Settings:** the per-user settings UI is `ProfileSettingsModal.tsx`, with tabs Profile and Security.
- The e2e test `server/test/app.e2e-spec.ts` is stale: it expects "Hello World!" from `GET /`.

## Ground rules

1. Keep all existing behaviour unless this prompt changes it.
2. **New npm dependencies allowed: exactly `helmet` and `@nestjs/throttler` (server). Nothing else.** No IndexedDB wrapper and no `@types` package for the File System Access API: write a small local `.d.ts` for the missing types.
3. **Server:** NestJS built-in exceptions; DTOs with class-validator; no repository layer. Any schema change gets a Prisma migration, and its data backfill goes in the migration SQL.
4. **Client:**

- Build from `client/src/components/ui/` and follow the UI Rules in `.github/copilot-instructions.md` (role-based tokens, no `dark:`, no native dialogs, UK English, sentence case).
- Admin-only UI stays absent for non-admins.
5. **Never log secrets, passwords, tokens or verification links in production.**
6. `npm run build:full` passes after every group. Note every Render setting change under **Deploy steps** in the canvas.

## Decisions (confirm at the review checkpoint)

#
Decision

P1
**Deleting a user keeps their documents.** `uploadedById` becomes nullable with `onDelete: SetNull`. New snapshot columns on `Document` (`uploadedByEmail`, `uploadedByName`) are filled at upload and backfilled from `User` in the migration. The register keeps showing who uploaded each document.

P2
**Any account that isn't `ACTIVE` loses access immediately.** It's refused on every authenticated request and on refresh, and its refresh tokens are revoked when its status changes away from `ACTIVE`. Role changes take effect on the next request (the role is already re-read).

P3
**Admin-created accounts count as verified,** because the admin vouches for them. `createUser` sets `emailVerifiedAt`. The migration backfills existing ACTIVE users that have no `emailVerifiedAt` and no pending `emailVerificationToken`.

P4
**Admins can't lock the system or themselves out.** You can't delete yourself or change your own role or status. Nobody can delete, demote or set to non-ACTIVE the last ACTIVE admin. The server returns 409 with a clear message, and the client hides or disables those actions with a tooltip explaining why.

P5
**Sessions:** 15-minute access tokens, refreshed silently. Users stay signed in for up to 7 days per browser, using the existing httpOnly refresh cookie. Multiple devices and tabs work: each refresh token carries its row id (`jti`) and refresh looks up that exact row.

P6
**Rate limits** use `@nestjs/throttler`, with real client IPs from `trust proxy`. The office shares one IP, so login is keyed by IP + email. On 429, the client shows "Too many attempts. Wait a few minutes and try again."

P7
**Upload limit:** 50 MB per file by default, configurable with `MAX_UPLOAD_MB`. The server returns 413. The client checks the size before uploading. The Upload page copy becomes "PDF, JPG or PNG, up to 50 MB".

P8
**SMTP is optional in production.** If it isn't configured, log a startup warning, and the console fallback must not print links or tokens in production. For the pilot, accounts are created from the admin page.

P9
**Backups:** a nightly in-app `VACUUM INTO` at 02:30 (before the 03:00 purge), plus one at startup if none exists from the last 24h. Keep the newest 14 copies. Render's daily disk snapshot then always contains a database copy that restores cleanly. Offsite copies are manual for now (written restore and copy-off guide).

P10
**"Save to folder" setting:** per browser, saved on this computer only, Chrome and Edge on desktop only. With a folder set, downloads, and copies of files the user uploads, go to `<folder>/<project name>/<file name>`. **Changing the folder never moves existing files.** New files simply go to the new folder. Clearing it returns to normal browser downloads. Nothing is stored on the server.

## Rate limit values (P6)

Route
Limit
Keyed by

`POST /auth/login`
10 per 15 min
IP + lowercased email

`POST /auth/register` and `GET /auth/verify-email`
10 per 15 min
IP

`POST /auth/refresh`
60 per min
IP

Everything else (global default)
300 per min
IP

---

## Group A — Accounts and data safety (server)

1. **User deletion keeps documents (P1):**

- Schema change, migration and backfill.
- The list endpoint uses the relation when present, otherwise the snapshot.
- Upload fills the snapshot.
- `deleteUser` writes a log line (no PII beyond the email) and still cascades memberships and refresh tokens.
2. **Account status lockout (P2):** in `validateUser` (401), in `refresh` (401) and in `updateAccountStatus` (revoke tokens when the status leaves `ACTIVE`).
3. **Self-protection and last-admin protection (P4):** applies to delete, change role and change status, single and bulk paths.
4. **Admin-created users are verified (P3):** `createUser` sets `emailVerifiedAt`, plus the migration backfill. `updateMe` lowercases and trims a changed email.
5. **Refresh by `jti` (P5):**

- Create the `RefreshToken` row id first, sign the refresh JWT with `jti` = that id, store the hash.
- `refresh` finds the row by `jti` + `userId` (not revoked, not expired) and verifies the hash, then revokes **only that row** before issuing a new pair.
- `logout` still revokes all of the user's rows.
- The cookie `maxAge` comes from `JWT_REFRESH_TOKEN_EXPIRATION`.
6. **Extraction errors:** store a short user-facing message ("Couldn't read text from this file." / "Couldn't process this image.") in `errorMessage`, and log the raw error server-side.
7. **Tests** (Jest, unit level, next to the code):

- deleting a user keeps their documents and the snapshot shows the uploader
- an inactive user is rejected by `validateUser` and `refresh`
- the last-admin and self guards
- two concurrent sessions can both refresh (`jti`)

## Group B — Hardening and config (server)

1. **Config validation** via `ConfigModule.forRoot({ validate })` with class-validator. Startup fails with a readable list of problems.

- **Required everywhere:** `DATABASE_URL`, `STORAGE_ROOT`, and `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` (each at least 32 characters, and **different from each other**).
- **Required in production:** `NODE_ENV=production` and `FRONTEND_URL`.
- **SMTP:** all or nothing. If any `SMTP_*` value is set, require `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` and `SMTP_FROM`. If none is set in production, show a startup warning (P8).
- **Optional, with defaults:** `MAX_UPLOAD_MB` (50), `BACKUP_DIR` (`<STORAGE_ROOT>/backups`), `BACKUP_KEEP` (14), and the existing compression and expiry variables.
- Update `.env.example` to match.
2. **`EmailService` fallback:** in production, log only "email not sent (SMTP not configured): <type> to <recipient>", never the HTML or the link.
3. **helmet:**

- Build a Content Security Policy from what the client actually loads. Read `client/index.html`: Google Fonts stylesheets and font files for Inter and Material Symbols, if used.
- Allow `blob:` where the preview, image thumbnails and downloads need it (images, frames or objects, depending on how `DocumentPreviewModal` renders a PDF; check it).
- No inline-script allowances unless something proves it needs one.
- Verify that the login, preview, fonts, icons and downloads still work in a production build.
4. **CORS:**

- The `localhost` / `127.0.0.1` / `*.local` patterns apply only when not in production. In production, allow only `FRONTEND_URL` and requests with no origin.
- Disallowed origins get `callback(null, false)` (no thrown error).
5. **Proxy:** `app.set('trust proxy', 1)` in production.
6. **Rate limiting** per the P6 table, with a custom tracker for the login route (IP + email). 429 responses carry a plain message.
7. **Uploads:**

- multer `limits: { fileSize: MAX_UPLOAD_MB, files: 1 }`, with oversize → 413 "File is larger than N MB."
- **Check magic bytes** before saving:

- PDF: `%PDF-`
- JPEG: `FF D8 FF`
- PNG: `89 50 4E 47 0D 0A 1A 0A`
- Reject mismatches with 400 "This file isn't a valid PDF, JPG or PNG."
8. **`Content-Disposition`:** replace hand-built headers with Express `res.attachment(filename)` (RFC 5987-safe) in the document and archive downloads.

## Group C — Deployment and backups (server and docs)

1. **Migrations at start:** add a script `start:render` = `prisma migrate deploy && node dist/main`. Deploy step: set Render's Start Command to `npm run start:render` (run from `server/`). Check the Prisma 7 config (`prisma.config.ts`) works for `migrate deploy` with the production `DATABASE_URL`.
2. **Backup service (P9)** using `@nestjs/schedule` (already installed):

- `VACUUM INTO '<BACKUP_DIR>/docindex-YYYYMMDD-HHmm.sqlite'` through Prisma raw SQL. The path is built only from config and the timestamp, never from user input.
- Write to a temporary name, then rename.
- Delete the oldest copies beyond `BACKUP_KEEP`.
- Log success and failure.
- Run once at startup if the newest copy is older than 24h.
- No HTTP endpoint.
3. **Docs:**

- `docs/deploy.md` (create or update):

- every Render setting: Build Command, Start Command, every env var with a description, never values
- how to restore the database from a backup copy or a Render snapshot
- how to copy the newest backup off Render (Render shell / SSH)
- "take a manual backup before deploying a migration"
- `docs/project-plan.md`: add "Phase 4.5 – Pilot readiness" before Phase 5.
- `docs/BACKLOG.md`:

- mark resolved: "User deletion cascades to uploaded documents", "Refresh token lookup", "Protect admin accounts from deletion", "Upload size limit" (50 MB, configurable)
- add: "Offsite backups (automatic)" and "Verification email resend + token expiry"
4. **Stale e2e test:** fix `server/test/app.e2e-spec.ts` to hit a real public route, or remove it.

## Group D — Sessions and admin guards (client)

1. **Shared request helper** `client/src/api/http.ts` (`apiFetch`), used by every module in `client/src/api/`. It:

- adds the bearer token
- sends cookies to `/auth/login`, `/auth/refresh` and `/auth/logout` (`credentials: 'include'`, so dev cross-origin works too)
- **on a 401, refreshes once and retries once.** One in-flight refresh promise is shared by concurrent requests.
- **if the refresh fails:** clears the token and goes to `/login?next=<current path>`, and Login returns there after signing in
- surfaces 413 and 429 messages as-is

Request and response shapes stay unchanged.
2. **Silent sign-in on load:** if there's no access token in `sessionStorage` (new tab or browser restart), try one refresh before deciding the user is signed out. Guarded routes wait for that check instead of flashing the login page.
3. **Admin guards (P4):**

- On your own row in Users, and for the last active admin, the Delete, Change role and status actions are disabled with a `title` tooltip ("You can't delete your own account", "At least one admin is required").
- Bulk actions skip those rows and say so.
- The server's 409 message is shown in an `InlineAlert` as a fallback.
4. **Copy fixes:**

- **Delete user** (`DeleteUserModal.tsx`, the bulk delete in `AdminUsers.tsx`, both places in `AdminPending.tsx`): "Delete <name>? They'll lose access straight away. Documents they uploaded stay in the register." For bulk: "Delete N users? They'll lose access straight away. Documents they uploaded stay in the register."
- **Create user:** the current copy becomes true once A4 lands; keep it.
- **Upload:** "PDF, JPG or PNG, up to 50 MB". Files over the limit are rejected before upload with an `InlineAlert` that lists them.
- **Login:** the 429 message is shown in the existing error `InlineAlert`.

## Group E — "Save to folder" setting (client, P10)

1. **Settings UI:** a third tab, "Files", in `ProfileSettingsModal`.

- Section title "Save location".
- Text: "Choose a folder on this computer. Files you download, and copies of files you upload, are saved there in a folder per project. Changing the folder doesn't move files you've already saved."
- It shows the current folder name, or "Not set — files go to your browser's Downloads folder".
- Buttons: "Choose folder" / "Change folder" (primary) and "Stop saving to a folder" (secondary).
- Note: "Only works in Chrome or Edge on a computer. The setting is saved in this browser only."
- In browsers without `showDirectoryPicker`: show the explanation, with the buttons disabled.
2. **Storage:** keep the `FileSystemDirectoryHandle` in IndexedDB (small hand-written helper, no library). Add a local `.d.ts` for `showDirectoryPicker`, `queryPermission` and `requestPermission`.
3. **One save helper** `client/src/utils/saveFile.ts`: `saveFile(blob, fileName, { projectName? })`.

- If a folder is set and permission is granted, write to `<folder>/<projectName>/<fileName>` (or the folder root when there's no project).
- Otherwise fall back to the existing blob + anchor download.
- Sanitise names for Windows: strip `<>:"/\|?*` and control characters, and trim trailing dots and spaces.
- On a name clash, use "name (2).pdf", "name (3).pdf" and so on.
- **Never overwrite** an existing file.
4. **Permission:** check with `queryPermission`. If it isn't granted, call `requestPermission` **at the very start of the click handler, before any `await`**, so the browser still sees a user gesture. If it's denied, fall back to a normal download and show a one-line `InlineAlert` where the action happened.
5. **Wire it into:**

- the single document download (with `projectName`)
- ZIP export
- CSV export
- the admin archive ZIP download (folder root)
- after each successful upload in `Upload.tsx` `handleUploadAll`, write the original `File` into `<folder>/<selected project name>/`. A failed copy never fails the upload; it gets a short warning.
6. **Feedback:** where the action already shows messages, add a short "Saved to <folder>/<project>" confirmation. Don't add a new toast system.

---

## Out of scope

OneDrive/SharePoint, automatic offsite backups, a phone layout, the password reset flow, verification email resend and token expiry, structured logging, a print button.

## Acceptance criteria

#
Criterion

AC1
Deleting a user keeps every document they uploaded, and the register still shows the uploader. The document list never errors on a deleted uploader.

AC2
A user set to non-ACTIVE is refused on their next request and can't refresh. An admin can't delete, demote or deactivate themselves or the last active admin (server 409, client disabled with an explanation).

AC3
An admin-created user can sign in with the temporary password and is sent to change it.

AC4
A user stays signed in across the 15-minute access-token expiry, in a new tab, and after a browser restart (up to 7 days). Two devices stay signed in at once. A failed refresh lands on `/login` and returns to the previous page after signing in.

AC5
Login is rate-limited per IP + email, and the other limits match the P6 table. Security headers are present. Production CORS allows only `FRONTEND_URL`. The preview, fonts and downloads still work under the CSP.

AC6
Uploads over the limit get 413 (and are blocked in the client). Files whose content doesn't match PDF, JPG or PNG get 400. Filenames with quotes or non-Latin characters download correctly.

AC7
The app refuses to start with missing or weak JWT secrets or identical access and refresh secrets, and lists every problem. No token or verification link is ever logged in production.

AC8
Migrations apply automatically on start. A backup copy is created nightly and at startup when stale, keeping the newest `BACKUP_KEEP`. `docs/deploy.md` explains restore and copy-off.

AC9
In Chrome or Edge, the user can choose, change and clear a save folder. Downloads and upload copies land in `<folder>/<project>/` without overwriting anything. Changing the folder moves nothing. Other browsers fall back to normal downloads with an explanation.

AC10
New unit tests pass. `npm run build:full` passes. No native dialogs, no `dark:` classes and no hover-only actions in touched files.

## Domain Concept Identification

### Existing Concepts (from codebase)

- **User (account):** identity, role (`USER` / `ADMIN`), account status (`PENDING` / `ACTIVE` / `REJECTED`), email-verified flag and forced password change.
  - Owns refresh tokens, project memberships and uploaded documents.
  - Other records that reference users already survive a user's deletion by keeping an email copy: `DeletionLog.actorEmail`, `Project.deletedByEmail` and `archivedByEmail`, and `FilterDefinition.createdBy` (set to null).
  - `Document.uploadedBy` is the only reference that cascades, so it's the outlier.
- **Document:** belongs to one Project and records who uploaded it.
  - Has extracted text, custom filter values, a processing status with an error message, and a soft-delete marker.
  - Its file lives in `BlobStore` under a project-based key that doesn't involve the uploader, so P1 never moves a file.
- **RefreshToken (session):** one row per sign-in, holding a hash, an expiry and a revoked time.
  - Today it's found by "newest row for this user", not by identity.
  - Logout and password change revoke every row for the user.
- **Access token and request authentication:** a short-lived bearer token. The JWT strategy re-reads the user on every request, so role changes already apply immediately, but account status is never checked.
- **Account lifecycle:** register → verify email → admin approval, or admin-create.
  - Login refuses unverified, PENDING and REJECTED accounts with specific messages.
  - Admin-create sets ACTIVE and forced password change but not verified, which is the P3 bug.
- **Admin user management:**
  - Single-user endpoints only: role, status, edit, delete.
  - "Bulk" actions are client loops over the single endpoints using `Promise.allSettled`.
  - Admin checks sit in the controllers. Users has Edit, Change role and Delete. Pending has Approve, Reject and Delete for PENDING and REJECTED users only.
- **EmailService:** sends with SMTP when it's configured, otherwise logs the full message, links included.
- **Upload pipeline:**
  - Buffers the file in memory and trusts the declared type.
  - Creates the Document row, then writes to `BlobStore`, then runs synchronous extraction (PDF text, or image OCR whose failures are swallowed).
  - On any failure it stores the raw error message on the Document.
- **Downloads:** single document, exports ZIP and admin archive ZIP.
  - Each one builds `Content-Disposition` by hand.
  - The client reads the name back with one shared regex pattern, duplicated three times.
- **Scheduled jobs:** `PurgeTask`, a daily in-process cron through `@nestjs/schedule` with an in-process re-entry guard. It's the precedent for the backup job.
- **Configuration:** `ConfigModule` loads `.env` with no validation. Defaults are scattered across services.
- **Bootstrap (`main.ts`):** sets the `/api` prefix in production and allows CORS for localhost, `*.local` and `FRONTEND_URL` (throwing for anything else). It also parses cookies, runs a global validation pipe, and serves the SPA in production.
- **Client API layer:** eight resource modules, each reading the token from `sessionStorage` and calling `fetch` with its own error mapping.
- **Client session gating:**
  - `AppShell` treats "no token" as signed-out and has no redirect.
  - `AdminGuard` calls `getMe` and redirects non-admins to `/`.
  - Non-admin routes have no guard.
- **Client feature surfaces:**
  - Login, plus Upload (a sequential upload loop that redirects after success).
  - `ProfileSettingsModal` (Profile and Security tabs).
  - `AdminUsers`, `AdminPending`, `DeleteUserModal` and `CreateUserModal`.
  - The download call sites: Documents, Drawer, Preview, Search, Export modal, CSV and AdminArchive.
  - `DocumentPreviewModal`, which renders `blob:` URLs in an `img` or `iframe`.

### New Concepts Required

- **Uploader snapshot:** a point-in-time record of who uploaded a document (email and name) that outlives the account. The document register uses the live account when it exists, otherwise the snapshot.
- **Account eligibility:** one rule, "only ACTIVE accounts may act". Request authentication and refresh both use it, and a status change away from ACTIVE ends every session.
- **Admin safety invariant:** an admin can't delete, demote or change the status of themselves, and the system always keeps at least one ACTIVE admin. It's enforced in the service layer and reflected in the admin UI.
- **Session identity:** each refresh token names its own session row, so sessions on different devices refresh independently.
- **Validated configuration:** one startup-time definition of every environment variable, with production-only and all-or-nothing (SMTP) rules. It holds the defaults for upload size and backups.
- **Request protection policy:** security headers (including a Content Security Policy fitted to what the client loads), production-only CORS, proxy-aware client IPs, and named rate limits. Login is keyed by IP + email.
- **Upload policy:** a size ceiling and a content-signature check that runs before anything is stored.
- **Database backup:** dated, self-contained copies of the database with retention, a nightly schedule and a startup catch-up.
- **Release migration step:** migrations applied on every start, before the app boots.
- **Client request helper and session bootstrap:** one place that attaches the token, refreshes once on 401, coordinates refreshes across tabs, and redirects to sign-in with a return path. A start-up check restores the session from the refresh cookie.
- **Admin guard presentation:** the client's own view of "is this me / is this the last active admin", used to disable actions and filter bulk selections.
- **Save location (client-only, per browser):** a folder the user picked, remembered in this browser.
  - One save helper writes to `<folder>/<project>/` with Windows-safe names and never overwrites.
  - It falls back to a normal browser download.
  - It never stores anything on the server.
- **Download filename decoding:** one client helper that reads both plain and encoded (`filename*`) names.

### Key Business Rules

- **Documents outlive their uploader.** Deleting a user never removes, hides or orphans a document's register entry. The uploader stays visible from the snapshot. *(Document, User, uploader snapshot)*
- **Only ACTIVE accounts can use the system,** on every authenticated request and every refresh. Leaving ACTIVE ends every session at once, and a role change applies on the next request. *(User, RefreshToken, account eligibility)*
- **The system always has at least one ACTIVE admin, and no admin can lock themselves out.** The server refuses with 409 and the client explains why. *(User, admin safety invariant)*
- **An admin vouches for an address.** Admin-created accounts and admin email edits count as verified (P3, RQ3).
- **Email identity is case-insensitive** (RQ2).
- **A self email change needs working email delivery** (RQ3).
- **Each browser session is independent.** Logout and password change end every session. A refresh ends only the session it rotates. *(RefreshToken, session identity)*
- **Nothing secret is ever logged in production:** no passwords, tokens, verification links or email bodies. *(EmailService, all loggers)*
- **An upload is accepted only if it's within the size limit and its content really is a PDF, JPEG or PNG.** The declared type alone is not trusted. *(Upload policy)*
- **Users see friendly error text.** Internal error detail goes to the server log only. *(Document.errorMessage)*
- **Backups are built only from configuration and time.** They're never reachable over HTTP and never exceed the retention count. *(Database backup)*
- **"Save to folder" (implicit rules):**
  - It never overwrites, never moves existing files, and never fails the action it accompanies.
  - A failed copy after an upload is a warning, not an upload failure.
  - Without permission or support, it falls back to a normal download. *(Save location)*
- **Implicit rule:** the uploader snapshot is a point-in-time copy. It isn't updated when a living user renames themselves; the live relation already shows the current name.
- **Implicit rule:** ACTIVE admins never appear on the Pending page, so the admin safety invariant is enforced there only by the server.

## Strategic Approach

### Solution Direction

- **Delivery order:** five ordered build checkpoints, each leaving `npm run build:full` green. Production is first deployed after Group C (RQ10 assumption 1).
  - **A, server data and accounts:** schema, then service rules, then unit tests.
  - **B, server edge hardening:** config validation, then bootstrap middleware, then upload and download handling.
  - **C, operations:** start-time migrations, backup job, docs.
  - **D, client sessions and admin UI:** request helper first, then every API module, then the session bootstrap, then pages and copy.
  - **E, client save-to-folder:** plus the additive `projectName` on search results.
- **Server request path:** security headers, CORS and rate limit → JWT guard → strategy (which checks account eligibility) → controller (DTO validation, upload policy) → service (business rules: admin safety, visibility) → Prisma.
- **Client request path:** page → resource API module → shared request helper. On a 401 the helper runs one refresh (shared by the tab and coordinated across tabs) and retries once. If that fails, it goes to sign-in and returns to the page afterwards.
- **Existing conventions to reuse:**
  - NestJS built-in exceptions, with `ConflictException` for guard refusals.
  - class-validator DTOs and the email-copy pattern already used by `DeletionLog` and `Project`.
  - `@nestjs/schedule`, following `PurgeTask`, and the existing accessible-project helpers.
  - On the client: `components/ui` primitives (`InlineAlert`, `Tabs`, `Button`, `IconButton` with `title`) and `utils/format`.

### Key Design Decisions

- **Keep documents when a user is deleted:**
  - Option 1, soft-deactivate users: avoids a schema change but adds a second "removed" state everywhere.
  - Option 2, nullable uploader with a snapshot: follows the established `*Email` pattern.
  - → **Option 2** (P1). The backfill goes in the same migration as the table change, so no window exists where documents lack an uploader.
- **Where eligibility is enforced:**
  - Option 1, a guard on every controller: easy to miss one.
  - Option 2, one check in `AuthService`, used by both the strategy and refresh.
  - → **Option 2.** Revocation on a status change lives in the users service with the other status logic.
- **Where admin safety is enforced:**
  - Option 1, in controllers: next to the existing role checks.
  - Option 2, in `UsersService`: follows the project rule that role checks belong in the service layer, but the actor's identity must be passed in.
  - → **Option 2.** The "is this the last active admin" check and the write are atomic, so two concurrent demotions can't both succeed. Bulk is covered automatically because it's a client loop over these endpoints.
- **Session identity:**
  - Option 1, look up by a deterministic token hash: changes the stored format.
  - Option 2, put the row id in the token: keeps the slow hash as a second check.
  - → **Option 2 (`jti`).** Refresh-token reuse detection isn't added, because it's out of scope.
- **Configuration:**
  - Option 1, lazy per-service defaults: today's behaviour, where failures show up late.
  - Option 2, validated at startup: fails fast and lists every problem.
  - → **Option 2.** Typed coercion (numbers, for example) becomes the single source of defaults. This incidentally makes `SMTP_PORT=465` choose SSL, as the README already documents.
- **Rate limiting:** `@nestjs/throttler` as a global guard with per-route overrides, plus a login-specific tracker (IP + lowercased email). Storage is in-memory, which suits one instance. `trust proxy` is set to one hop, as Render recommends.
- **Upload policy placement:**
  - The size limit is enforced while the upload streams in, so oversize requests are cut off before they fill memory.
  - The signature check runs before the service, so a rejected file never creates a Document row or a file on disk.
- **Download headers:**
  - The Express attachment helper is used on all three downloads, including exports, which the brief doesn't mention.
  - One client decoder replaces the three regexes and prefers the encoded name. Without this, AC6 fails for non-Latin names.
- **Migrations:**
  - Run at start through an npm script (RQ1), because Render's disk isn't available during the build.
  - A manual backup before any migration deploy is a documented step.
- **Backups:**
  - An in-app scheduled job (02:30 UTC) that copies the database into a temporary file, renames it and prunes old copies.
  - A startup catch-up when the newest copy is older than 24 hours.
  - A documented `fs` exception (RQ7).
  - Render's daily disk snapshot captures these copies.
- **Client request helper and cross-tab coordination:**
  - One helper used by all eight modules, which keep their existing error messages.
  - One in-flight refresh per tab plus Web Locks across tabs (RQ9).
  - The helper never refreshes for the auth endpoints themselves, and never redirects from public pages.
- **Session bootstrap:**
  - A single "checking session" state shared by `AppShell` routes and `AdminGuard`.
  - With no token in `sessionStorage`, it tries one refresh before deciding the user is signed out, so no login flash.
- **Save to folder:**
  - Client-only, using the File System Access API. The folder handle is kept in IndexedDB through a tiny local helper, with local type declarations limited to what the DOM types lack.
  - Permission is requested synchronously at the start of each click handler.
  - Exports spanning several projects go to the folder root (RQ6). Search downloads use the new `projectName` (RQ5).
  - The Upload page's "Saved to…" message has to survive the existing post-upload redirect. The canvas decides how (for example, a short delay or passing the message along).
- **Email handling (RQ2, RQ3):**
  - Normalise on input and look up case-insensitively at sign-in, with no data rewrite.
  - While SMTP is unconfigured, the server refuses a self email change. Admin email edits count as verified.
- **Content Security Policy:**
  - Allow only the app's own origin, plus Google Fonts (the stylesheets host and the font files host).
  - Allow `blob:` for image and frame previews and for downloads. No inline scripts.
  - Verify on a local production build, because Vite's dev server never sends these headers.

### Alternatives Considered

- **Soft-deactivate users instead of deleting** (suggested in the backlog): rejected by P1. Deleting is now safe, and a deactivate UI is out of scope (RQ8).
- **A server-side grace window for a just-rotated refresh token:** rejected (RQ9). It weakens rotation, and Web Locks solves the same race on the client.
- **Keeping the access token in `localStorage` to survive restarts:** rejected. The HttpOnly refresh cookie plus a silent refresh gives the same experience without exposing a long-lived token to scripts.
- **Lowercasing stored emails in the migration:** rejected (RQ2), because two accounts differing only by case would collide on the unique index.
- **Routing backups through `BlobStore`:** rejected (RQ7). `BlobStore` is keyed under `STORAGE_ROOT` for documents and `BACKUP_DIR` may live elsewhere.
- **Running migrations in the build step:** impossible, because the persistent disk isn't mounted during Render builds.
- **A separate Render cron service for backups:** rejected, because a Render disk attaches to one service only.
- **`express-rate-limit`, a file-type detection library or an IndexedDB wrapper:** not allowed (ground rule 2). Three signatures and a small IndexedDB helper are enough.
- **Asking the server for the project name at download time** (header or extra request): rejected in favour of an additive `projectName` on search results (RQ5), which matches the list endpoint.

## Risk & Gap Analysis

### Requirement Ambiguities

- **"Single and bulk paths" for admin guards (A3):** the server has no bulk user endpoints. The single-endpoint guards cover bulk automatically, and the client must skip protected rows and say so.
- **"Change role and status actions are disabled" (D3):** the Users page has no status action (RQ8). On Users only Delete and Change role are disabled, and Edit stays enabled. On Pending the guard can never trigger for an active admin.
- **Upload messages:** the brief wants a "Saved to <folder>/<project>" confirmation on Upload, but the page redirects to Documents 1.5 s after success. How the message survives the redirect is left to the canvas.
- **Error message ownership (413 and 429):**
  - Today the client hard-codes "The file is too large to upload." for 413. D1 says to show the server's 413 message as-is, so the server's "File is larger than N MB." wins.
  - For 429, P6 fixes the copy ("Too many attempts. Wait a few minutes and try again."), so the client shows that regardless of the server text.
- **`.env.example` vs all-or-nothing SMTP:** the example file ships placeholder SMTP values. Under the new validation, a copied example counts as "SMTP configured" with a fake host. The example needs blank or commented SMTP values.
- **Exports filename:** B8 lists only the document and archive downloads. The exports ZIP has the same hand-built header and is included for consistency (its name is generated by the server, so the risk is low).
- **Uploader name for the snapshot:** `fullName` can be null or empty (the register path stores `''`). The snapshot keeps it as-is, and the register falls back to the email.

### Edge Cases

- **Sessions:**
  - **Refresh cookies issued before the deploy have no `jti`:** each user must sign in once after the release. This goes in the deploy notes.
  - **Distinct JWT secrets:** if production currently uses the same JWT secret for access and refresh tokens, the new validation stops the app from starting. The secrets must be set before deploying, and rotating them signs everyone out.
  - **A user set to non-ACTIVE with an open tab:** the next call returns 401, refresh returns 401, and they're redirected to sign-in, where the existing PENDING or REJECTED message explains why.
  - **Last-admin count:** only ACTIVE admins count. A PENDING user who was given the ADMIN role doesn't.
  - **Two admins demoting each other at the same time:** this must not leave zero admins, so the check and the write are atomic.
  - **Redirect loops:** the auth endpoints (login, refresh, logout) must never trigger refresh-on-401, and public pages (`/login`, `/register`, `/verify-email`) must never redirect. A wrong-password 401 must stay a login error.
- **Uploads:**
  - A file declared as PNG whose content is a JPEG (renamed extension) is rejected as a mismatch, as the brief says. Empty files have no signature and get 400.
  - A file exactly at the limit is accepted. Multipart requests with more than one file are rejected by the one-file limit.
- **Save to folder:**
  - Windows-reserved names such as `CON`, `PRN`, `AUX`, `NUL`, `COM1` and `LPT1` aren't covered by the character list in E3. A write may fail, which falls back to a normal download with a notice.
  - Two project names that sanitise to the same folder share it. The collision rule prevents overwrites.
  - Paths over Windows' length limit, or a saved folder that was deleted, moved or renamed on disk, make the write fail. That falls back with a one-line alert. Settings may show a stale folder name until it's changed.
  - **Permission after a browser restart:** it goes back to "prompt" unless the user chose "allow on every visit". That's why `requestPermission` must run before any `await` in the click handler.
- **Backups:**
  - `BACKUP_DIR` defaults to inside `STORAGE_ROOT`. The legacy `storage:migrate` script scans top-level folders of `STORAGE_ROOT` and would see `backups/`. That's low risk (it's a one-off legacy script), but it should skip or document that folder.
  - **Ordering at start:** the startup backup runs after `migrate deploy`, so it's a post-migration copy. Protection against a bad migration comes from the manual pre-deploy backup and the previous nightly copy.
  - **Disk full during `VACUUM INTO`:** the temporary file must be cleaned up and the failure logged, without affecting the running app.
- **Rate limits and CORS:**
  - **Shared office IP:** the whole office shares the global 300/min and refresh 60/min buckets. That's ample for a pilot, but worth noting in the docs.
  - **`FRONTEND_URL` exact match:** a trailing slash or a scheme mismatch would block every same-origin POST (`Origin` is sent), login included. Validation or comparison should normalise it.

### Technical Risks

- **Migration rebuilds a live table:** making `uploadedById` nullable with a new `onDelete` makes Prisma rebuild the `Document` table in SQLite (copy, drop, rename) with foreign keys off. A mistake loses data.
  - **Mitigation:** put the backfill in the same migration, rehearse it on a copy of the production database, and take a manual backup first (documented in `deploy.md`).
- **Deploy gap between A and C:** Group A's code expects new columns, but migrations only run automatically from Group C onward. Deploying A alone would crash at runtime. Mitigation: deploy after C (RQ10).
- **Prisma CLI at start:**
  - `prisma` is a devDependency, and `prisma.config.ts` imports `dotenv/config` while `dotenv` is only a transitive dependency.
  - If Render's install skips dev dependencies (for example, because `NODE_ENV=production` is set at build time), `migrate deploy` fails at start.
  - **Mitigation:** the build installs dev dependencies (as `build:full` already does for the client), and the canvas confirms `dotenv` resolves.
- **Strict config validation can stop production starting:** for example, equal secrets, a missing `FRONTEND_URL` or partial SMTP. Mitigation: the deploy steps list every required variable before the deploy.
- **Request helper rollout regressions:** every API module and every screen is affected. Each module's existing error mapping (for example, register 409 → "Email already exists") must be preserved. Mitigation: smoke-test each screen after Group D.
- **Refresh races:** two tabs, or StrictMode double-running effects in dev, would sign the user out without RQ9. Mitigation: per-tab single-flight plus Web Locks. Verify with two tabs and in dev.
- **CSP only applies in production:**
  - Vite's dev server never sends the policy, so a too-strict policy breaks preview, fonts or icons only after deploy.
  - Helmet's default policy includes `upgrade-insecure-requests`, which can break a local production run over plain `http://localhost` during verification. The canvas decides whether to keep that directive.
  - **Mitigation:** verify login, preview (PDF in an iframe, images), fonts, icons and every download on a local production build.
- **Dev-only filename gap:** in dev the API is cross-origin and CORS doesn't expose `Content-Disposition`, so dev downloads fall back to generic names. Production is same-origin and unaffected, but AC6 must be verified on a production build (or by exposing the header in dev).
- **File System Access typings:** the TypeScript DOM library already declares directory and file handles, but not `showDirectoryPicker`, `queryPermission` or `requestPermission`. The local `.d.ts` must only add what's missing, or `tsc` fails on duplicate declarations.
- **Wrong proxy hop count on Render:** every visitor would share one IP bucket, or IPs could be spoofed. Mitigation: after the first deploy, check one logged client IP against a known public IP. Note this in `deploy.md`.
- **Backup disk usage and restore safety:**
  - Disk use: 14 copies of a database that holds extracted text can grow. `deploy.md` should say how to check disk usage.
  - Restore: Render's disk is only reachable while the service runs, so replacing the live database file under a running app risks corruption.
  - **Mitigation:** `deploy.md` describes a restore that never overwrites the open database file in place, for example a restore step at start or swapping files while the app isn't using them. The canvas defines the exact procedure.
- **Locking during backups:** the database runs without WAL, so writers block briefly while `VACUUM INTO` reads. That's negligible at 02:30 for this database size.

### Acceptance Criteria Coverage

| AC# | Description | Addressable? | Gaps/Notes |
|-----|-------------|--------------|------------|
| AC1 | Deleting a user keeps their documents and the register still shows the uploader | Yes | Snapshot plus backfill in one migration. Only the list endpoint reads the uploader today. The client already treats it as optional. |
| AC2 | Non-ACTIVE refused on next request and refresh; self and last-admin protection (409 plus disabled client actions) | Yes | Server covers delete, role and status. The client disables Delete and Change role on Users. No status UI exists (RQ8). Bulk is covered through the single endpoints, with client skipping and reporting. |
| AC3 | An admin-created user can sign in with the temporary password and is sent to change it | Yes | Verified on create plus migration backfill. The forced change is already wired to `/change-password`. Case-insensitive sign-in (RQ2) removes a second lockout. |
| AC4 | Stays signed in across expiry, new tab and restart (7 days); two devices; failed refresh → `/login` and back | Yes | Needs `jti` refresh, the request helper, silent sign-in and cross-tab coordination (RQ9). Cookies issued before the deploy need one sign-in. |
| AC5 | Login limited per IP + email, other limits per P6; security headers; production CORS only `FRONTEND_URL`; CSP keeps preview, fonts and downloads working | Partial | All addressable, but the CSP can only be verified on a production build and `trust proxy` only on Render. `FRONTEND_URL` must be normalised. |
| AC6 | Over-limit uploads get 413 and are blocked in the client; content mismatch gets 400; quotes and non-Latin names download correctly | Yes | Needs the client filename decoder (not in the brief) and the exports header. In dev, non-Latin filenames need the header exposed or a production build to verify. |
| AC7 | Refuses to start with missing, weak or identical JWT secrets and lists every problem; nothing secret logged in production | Yes | The only leak found is the email fallback. No other log line prints tokens or links. |
| AC8 | Migrations on start; nightly and stale-at-startup backups keeping `BACKUP_KEEP`; `deploy.md` covers restore and copy-off | Yes | Start path corrected (RQ1). Needs dev dependencies at build. The restore procedure must avoid overwriting the live database file. |
| AC9 | Chrome and Edge can choose, change and clear a folder; downloads and upload copies land in `<folder>/<project>/` without overwriting; nothing moves; other browsers fall back with an explanation | Yes | Search needs `projectName` (RQ5). Multi-project exports go to the folder root (RQ6). The Upload confirmation must survive the redirect. Windows-reserved names fall back. |
| AC10 | New unit tests pass; `build:full` passes; no native dialogs, `dark:` classes or hover-only actions in touched files | Yes | Unit tests follow the existing `*.spec.ts` style (mocked Prisma). Run a final grep over touched files for `dark:`, `window.confirm`, `window.alert` and `opacity-0`. |
