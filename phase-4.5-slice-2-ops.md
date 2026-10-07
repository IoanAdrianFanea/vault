# Phase 4.5 — Pilot readiness · Slice 2 of 3: deployment, backups and docs (Group C)

This is one slice of the Phase 4.5 canvas, with the review amendments already applied. It is self-contained: implement only the operations below, in order, and don't open the full canvas. The Norms and Safeguards at the end apply to every operation.

### Group C — Deployment and backups (server and docs)

#### C1 Update Scripts - `server/package.json` (RQ1)
1. `"start:prod": "node dist/src/main"` (was `dist/main`, which doesn't exist; the build writes `dist/src/main.js` because `prisma.config.ts` sits at the server root).
2. Add `"start:render": "node dist/src/scripts/restore-database.js && prisma migrate deploy && node dist/src/main"`.
3. Remove `"test:e2e"`. Delete `server/test/app.e2e-spec.ts` and `server/test/jest-e2e.json`, and with them the empty `server/test/` folder (RQ10: the full app won't boot in tests without real secrets after B2).
4. Check `prisma migrate deploy` with the Prisma 7 config:
   - `$env:DATABASE_URL='file:./deploy-check.db'; npx prisma migrate deploy` applies every migration to a fresh file, which proves `prisma.config.ts` (and its `dotenv/config` import) loads outside Nest.
   - Delete `deploy-check.db` afterwards.

#### C2 Create Restore Hook - `server/src/backup/restore-database.ts` and `server/src/scripts/restore-database.ts`
1. `server/src/backup/restore-database.ts` exports `restoreDatabaseIfRequested(env: NodeJS.ProcessEnv, now = new Date()): Promise<{ restored: boolean; message: string }>`:
   1. If `DATABASE_URL` is missing or doesn't start with `file:`, return `{ restored: false, message: 'Restore skipped: DATABASE_URL is not a SQLite file URL' }`.
   2. `dbPath = path.resolve(env.DATABASE_URL.slice('file:'.length))`.
   3. `backupDir = path.resolve(env.BACKUP_DIR?.trim() || path.join(env.STORAGE_ROOT?.trim() || './data', 'backups'))`. This is the same default as B2.
   4. `markerPath = path.join(backupDir, 'RESTORE')`. If it doesn't exist, return `{ restored: false, message: 'No restore requested' }`.
   5. `fileName = (await fs.readFile(markerPath, 'utf8')).trim()`. It must match `/^[A-Za-z0-9._-]+\.sqlite$/`, otherwise throw `new Error('RESTORE must contain only the name of a .sqlite file in the backups folder')`. That rule blocks path separators.
   6. `source = path.join(backupDir, fileName)`. If it's missing, throw `new Error(\`Backup ${fileName} was not found in the backups folder\`)`.
   7. Copy `source` to `${dbPath}.restore-tmp`. Remove `${dbPath}-journal`, `${dbPath}-wal` and `${dbPath}-shm` with `force` (a stale hot journal would otherwise be replayed onto the restored file). Rename the temp file over `dbPath`.
   8. Rename the marker to `RESTORE.done-YYYYMMDD-HHmm` (UTC), so a restart doesn't restore again.
   9. Return `{ restored: true, message: \`Database restored from ${fileName}\` }`.
2. `server/src/scripts/restore-database.ts` (runner, no Nest context):
   - Call it with `process.env`.
   - On success, log `message` with `new Logger('RestoreDatabase')` when `restored`.
   - On error, log `Database restore failed: <message>` and `process.exit(1)`, so a failed restore never continues into migrate or start.
3. Test file: `server/src/backup/restore-database.spec.ts` (new), using a temp directory. Cases:
   - No marker: nothing changes.
   - A valid marker replaces the database file, removes `-journal` and renames the marker.
   - A marker containing `../x.sqlite` throws.
   - A missing backup throws.
4. The restore hook and `BackupService` (C3) are the only server code outside `LocalBlobStore` that use `fs` (RQ7). Each file starts with a one-line comment saying so.

#### C3 Create Module and Service - `server/src/backup/` (P9)
1. File: `server/src/backup/backup.service.ts`.
   - `@Injectable() export class BackupService implements OnApplicationBootstrap`, with a `logger` and `isRunning = false`.
   - `backupDir = config.get<string>('BACKUP_DIR')` (already resolved in B2) and `keep = config.get<number>('BACKUP_KEEP') ?? 14`.
   - `export function backupFileName(date: Date): string` returns `docindex-YYYYMMDD-HHmm.sqlite` in UTC. `BACKUP_FILE_PATTERN = /^docindex-(\d{8})-(\d{4})\.sqlite$/`.
   - **`onApplicationBootstrap(): void`:** `void this.runStartupBackupIfStale()`. It doesn't block start-up.
   - **`@Cron('30 2 * * *', { name: 'database-backup' }) async handleNightlyBackup()`:** runs `await this.runBackup('nightly')`. That's 02:30 server time (UTC on Render), before the 03:00 purge.
   - **`async runStartupBackupIfStale(now = new Date())`:** if there's no backup, or the newest is more than 24 hours older than `now`, run `this.runBackup('startup')`.
   - **`async runBackup(reason: 'nightly' | 'startup'): Promise<string | null>`:**
     1. If `isRunning`, warn `Database backup already running; skipping ${reason} run` and return `null`.
     2. Set `isRunning`. `finalPath = path.join(backupDir, backupFileName(new Date()))` and `tempPath = \`${finalPath}.tmp\``.
     3. Run `fs.mkdir(backupDir, { recursive: true })`. If `finalPath` already exists, log that and return it.
     4. Run `fs.rm(tempPath, { force: true })`, then `await this.prisma.$executeRaw\`VACUUM INTO ${tempPath}\``. That's a bound parameter, and the path is built only from config and the time.
        - If the adapter rejects a bound parameter for `VACUUM INTO`, use `$executeRawUnsafe(\`VACUUM INTO '${tempPath.replace(/'/g, "''")}'\`)` instead. The same rule applies: the path never contains user input.
     5. Rename `tempPath` to `finalPath`. Read its size and log `Database backup (${reason}) written: ${fileName} (${size} bytes)`.
     6. Run `await this.pruneOldBackups()` and return `finalPath`.
     7. **On any error:** `fs.rm(tempPath, { force: true })`, log `Database backup (${reason}) failed: ${String(error)}`, return `null`. It never throws.
     8. **Finally:** set `isRunning = false`.
   - **`private async listBackups(): Promise<{ name: string; createdAt: Date }[]>`:**
     - Reads the folder (a missing folder gives `[]`).
     - Keeps only names matching the pattern, with the UTC date parsed from the name.
     - Sorts newest first.
     - Manual copies such as `manual-…sqlite` are never listed, so they're never pruned.
   - **`private async pruneOldBackups()`:** deletes `listBackups().slice(this.keep)` and logs each deletion.
2. File: `server/src/backup/backup.module.ts`: `@Module({ providers: [BackupService] })`. `server/src/app.module.ts` imports `BackupModule`.
3. File: `server/src/scripts/migrate-storage-layout.ts`: add `'backups'` to the list of top-level folders the clean-up skips.
4. Test file: `server/src/backup/backup.service.spec.ts` (new). It uses a temp directory and a Prisma mock whose `$executeRaw` writes a file at the bound path. Cases:
   - The file name matches the pattern.
   - Pruning keeps the newest `keep` copies and never touches `manual-x.sqlite`.
   - A startup run is skipped when the newest copy is less than 24 hours old, and runs when it's older.
   - A failing `$executeRaw` leaves no `.tmp` file and returns `null`.

#### C4 Create Docs - `docs/deploy.md`
Write it for an operator. Commands are shown, but real values are never written down. Sections:
1. **Overview:**
   - One Render web service, with Nest serving the built client.
   - A persistent disk mounted at `/data`, holding the SQLite database, document files and backups.
   - It must stay one instance: rate limits are in memory, scheduled jobs run in-process, and Render disks attach to one instance.
2. **Render settings:**
   - Root Directory: `server`.
   - Node version: from `.nvmrc`.
   - Build Command: `npm install --include=dev && npx prisma generate && npm run build:full`. Dev dependencies are needed at start for the `prisma` CLI.
   - Start Command: `npm run start:render`.
   - Disk mount path: `/data`.
   - Health check path: `/`.
3. **Environment variables:** a table with name, when it's required, and description. Never list values.
   - **Server:** `NODE_ENV` (must be `production`), `DATABASE_URL` (absolute `file:` path on the disk), `STORAGE_ROOT`, `BACKUP_DIR`, `BACKUP_KEEP`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (32+ characters, different), `JWT_ACCESS_TOKEN_EXPIRATION`, `JWT_REFRESH_TOKEN_EXPIRATION`, `FRONTEND_URL` (exact site origin, no trailing slash), `MAX_UPLOAD_MB`, `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`/`SMTP_FROM` (all or nothing), `COMPRESSION_THRESHOLD_BYTES`, `COMPRESSION_MIN_SAVINGS_RATIO`, and `PORT` (set by Render).
   - **Client build:** `VITE_API_URL` (optional in production: the client defaults to `/api` on the same origin) and `VITE_MAX_UPLOAD_MB` (same as `MAX_UPLOAD_MB`).
   - Include the secret-generation command.
4. **Before deploying a migration:** take a manual backup from the Render Shell:
   - `cd /opt/render/project/src/server && node -e "require('better-sqlite3')(process.env.DATABASE_URL.replace(/^file:/,'')).exec(\"VACUUM INTO '/data/backups/manual-YYYYMMDD-HHmm.sqlite'\")"`, replacing the date.
   - Manual copies aren't pruned automatically.
5. **First deploy of Phase 4.5:**
   - Take the manual backup.
   - Set the new environment variables, plus the Build and Start Commands.
   - Deploy and check the logs show the migrations applied and a startup backup written.
   - Everyone signs in once.
   - Check that the client IP in a rate-limit test matches your public IP (see "Proxy check").
6. **Automatic backups:**
   - They run at 02:30 server time (UTC) and at startup when the newest is more than 24 hours old. The newest `BACKUP_KEEP` copies are kept in `BACKUP_DIR`.
   - Render's daily disk snapshot (kept at least 7 days) contains these copies.
   - Check space with `du -sh /data/backups` and on the service's Disk page.
7. **Copy a backup off Render:**
   - From your own PC, after adding an SSH key in Render: `scp -s <service-ssh-address>:/data/backups/<file> .` (`scp` runs on your PC, not in the Render Shell).
   - Or, if `which wormhole` finds it in the Render Shell, run `wormhole send /data/backups/<file>` there and `wormhole receive` on your PC. Don't rely on it being installed.
   - Keep offsite copies somewhere other than Render.
8. **Restore the database from a backup copy:**
   1. In the Render Shell, `ls -lh /data/backups` and pick a file.
   2. Optionally take a manual backup of the current state first.
   3. Run `echo docindex-YYYYMMDD-HHmm.sqlite > /data/backups/RESTORE` (use `BACKUP_DIR` if it's set).
   4. Dashboard → Manual Deploy → Restart service. Render stops the app, and the start command restores the file before migrations and start-up, then renames the marker to `RESTORE.done-…`.
   5. Check the logs for "Database restored from …".
   - Document files aren't part of a database copy. Files uploaded after the copy stay on disk but aren't listed.
9. **Restore from a Render snapshot:**
   - Disk page → Snapshots → Restore. This restores the database, files and backups together, and everything after the snapshot is lost.
   - Prefer a database copy unless the files are damaged.
10. **Proxy check:**
    - Sign in with a wrong password 11 times from one network: the 11th gets "Too many attempts…".
    - A different network must still be able to sign in. If not, the proxy hop count is wrong.
11. **Email:**
    - SMTP is optional. Without it, the server logs only "email not sent (SMTP not configured)…".
    - Self-registration can't complete without SMTP (RQ4), so create pilot accounts from the admin Users page.

#### C5 Update Docs - plan, backlog, README
1. `docs/project-plan.md`:
   - Add a section `## Phase 4.5 – Pilot readiness` between Phase 4 and Phase 5. It has a status table with these rows:
     - user deletion keeps documents;
     - account status lockout;
     - admin self and last-admin protection;
     - admin-created users verified;
     - case-insensitive email;
     - refresh by session id;
     - config validation;
     - security headers and CORS;
     - rate limits;
     - upload limit and content check;
     - safe download filenames;
     - migrations at start and restore hook;
     - database backups;
     - deploy guide;
     - silent session refresh (planned, group D);
     - admin guard UI (planned, group D);
     - save to folder (planned, group E).
   - Mark everything from Groups A–C ✅ done.
   - In Phase 5's list, note that "Backup strategy" and "Environment-based configuration" were brought forward into Phase 4.5 (automatic offsite backups stay in Phase 5).
   - In "Known Technical Notes", remove the `AuthService.refresh` bullet, which is now resolved.
2. `docs/BACKLOG.md`:
   - **"To Confirm With Stakeholder":** strike the "Upload size limit" bullet and mark it decided: 50 MB by default, configurable with `MAX_UPLOAD_MB`.
   - **Move to "Resolved", each with a one-line "done in Phase 4.5" note:** "User Deletion Cascades to Uploaded Documents", "Refresh Token Lookup" and "Protect Admin Accounts From Deletion".
   - **Rename** "Email Verification Token Expiry" to "Verification Email Resend and Token Expiry". Add that there's no way to resend a verification email, and keep the existing expiry text.
   - **Add** "Offsite Backups (Automatic)": nightly copies stay on the Render disk, so copy them off automatically to separate storage.
   - **Under "Restrict Self-Registration",** add that registration can't complete while SMTP is unconfigured (RQ4).
3. `README.md`:
   - The sample `server/.env` adds `STORAGE_ROOT` and uses blank secrets with the "32+ characters, different" note.
   - The environment variables table adds `NODE_ENV`, `MAX_UPLOAD_MB`, `BACKUP_DIR`, `BACKUP_KEEP` and `VITE_MAX_UPLOAD_MB`. `FRONTEND_URL` now reads "Site origin, used for CORS in production and email links", and `SMTP_*` "all or nothing".
   - The API Overview row for upload becomes "Uploads PDF/JPEG/PNG up to `MAX_UPLOAD_MB` (413 if larger, 400 if the content doesn't match)". Add a line under the table: login, register, verify-email and refresh are rate-limited (429).
   - The account lifecycle note says admin-created users count as verified, and only an ACTIVE account can use the app.
   - Phase Status adds "Phase 4.5 – Pilot readiness" and links `docs/deploy.md`. The Phase 2 sentence about the removed 50 MB limit gets "(reinstated as a configurable limit in Phase 4.5)".

#### Group C gate
- From `server/`, `npm test` and `npm run build:full` pass.
- `npm run start:render` runs locally (in PowerShell, with `DATABASE_URL` pointing at a copy of `dev.db`). With no marker it starts normally, and a `docindex-*.sqlite` file appears under `BACKUP_DIR`.
- Write a `RESTORE` marker naming that file and run `start:render` again: the log shows "Database restored from …", and the marker is renamed.
- Every doc change in C4 and C5 is present.
- **Production can now be deployed** (first deploy), following `docs/deploy.md`.

---

## Norms

1. **Server structure:**
   - Feature modules: `auth`, `users`, `documents`, `backup`, `config`, `common`.
   - Services call `PrismaService` directly; there's no repository layer.
   - Role, ownership and admin-safety checks live in services, with the acting user's id passed from the controller.
   - Use only NestJS built-in exceptions (`BadRequestException`, `UnauthorizedException`, `ConflictException`, `NotFoundException`, `PayloadTooLargeException`). Messages are user-facing, in sentence case, with a full stop, and never include paths or stack traces.
2. **Transactions:** wherever a check must hold at the moment of a write (last active admin, revoking on a status change), use one interactive `prisma.$transaction(async (tx) => …)`. A refresh-token claim uses a conditional `updateMany` and checks `count`.
3. **Configuration:**
   - Read settings through `ConfigService.get` after `validateEnv`, never `process.env` in services.
   - Exceptions: `main.ts` reads through `app.get(ConfigService)`. The restore runner reads `process.env`, because it runs before Nest.
   - Defaults are defined once, in `EnvironmentVariables`.
4. **Validation:** DTOs use class-validator. Emails are normalised with `@Transform(normalizeEmail)`, and every accepted field is declared (`whitelist` and `forbidNonWhitelisted` stay on).
5. **Files:**
   - Document files go only through `BLOB_STORE`.
   - `fs` is allowed only in `LocalBlobStore`, `BackupService`, the restore hook and the existing storage-migration script (RQ7). Each file says so in its header comment.
   - Paths are built from config and constants, never from request data.
6. **Logging:**
   - Use Nest `Logger` per class.
   - Never log passwords, tokens, cookies, verification links or email bodies in production. Email fallback logs carry only the type and recipient. The user-deletion log carries only the deleted email, the acting admin's id and a count.
7. **Tests:**
   - `*.spec.ts` sits next to the code, under `server/src`.
   - Services are constructed directly with `jest.fn()` Prisma mocks (the `archive.service.spec.ts` pattern), with real `argon2` and `JwtService` where behaviour depends on them.
   - File-system tests use `os.tmpdir()` folders and clean up.
8. **Client API:**
   - Every request goes through `apiFetch` in `client/src/api/http.ts`, and only `http.ts` touches the access token.
   - One module per resource. Modules keep their own error mapping and pass server messages through with `readErrorMessage` where they already show them.
9. **Client UI:**
   - Build from `components/ui` (barrel import outside `components/ui`). Use `InlineAlert` for every notice, `ConfirmDialog` for destructive confirmations, `IconButton` with `disabled` and a conditional `title` for blocked actions, and `Spinner` while checking a session.
   - Helpers and constants live in `.ts` files.
   - Tailwind role tokens only. No `dark:`, no hex values, no native dialogs, no hover-only actions.
   - UK English, sentence case. Numbers and counts use `utils/format.ts`.
10. **Save helper:** any click that may write to the save folder calls `beginSave()` as its first statement and passes the result to the API or `saveFile`. Nothing awaits before it.
11. **Migrations:**
    - Use `prisma migrate dev --create-only` and add the backfill SQL before applying.
    - Never edit an applied migration.
    - New columns are nullable or have defaults.
12. **Comments:** only where the reason isn't obvious: the SQLite `LIKE` fallback, `jwtid`, the `object-src blob:` reason, the `fs` exceptions, and calling `beginSave` before `await`.

## Safeguards

1. **Functional constraints:**
   - Deleting a user never deletes, soft-deletes or hides a Document, its `DocumentText`, its filter values or its file. The list shows the uploader from the relation, or else from the snapshot.
   - A non-ACTIVE account gets 401 on its next authenticated request and on refresh. Leaving ACTIVE revokes every refresh token for that user.
   - An admin can't delete, change the role of, or change the status of their own account. The last ACTIVE admin can't be deleted, demoted or set to non-ACTIVE. Each case returns 409 with the fixed messages from A3.
   - Admin-created users can sign in with their temporary password and are sent to change it.
   - Sessions: access tokens last 15 minutes and refresh silently. Each browser keeps a sliding 7-day session. Several devices work at once. Logout ends all sessions. A password change ends the others and keeps the current one.
   - Uploads over `MAX_UPLOAD_MB` get 413 "File is larger than N MB." and are blocked in the client. Content that doesn't match the declared type gets 400 "This file isn't a valid PDF, JPG or PNG.".
   - "Save to folder" never overwrites, never moves existing files, never fails the upload or download it accompanies, and falls back to a normal download whenever the folder can't be used. Upload copies are the exception: they don't fall back to a download.
2. **Performance constraints:**
   - Login is limited to 10 attempts per 15 minutes per IP + email. Register and verify-email: 10 per 15 minutes per IP. Refresh uses the global limit. Everything else: 300 per minute per IP, per route.
   - Uploads are capped at `MAX_UPLOAD_MB` (default 50) while streaming.
   - A backup runs at most once at a time, doesn't block start-up, and keeps at most `BACKUP_KEEP` automatic copies.
   - Concurrent refreshes in one tab make one network request.
3. **Security constraints:**
   - Only ACTIVE accounts act. Admin endpoints keep their existing role checks. Non-admin visibility rules for documents and projects are unchanged.
   - Production CORS allows only the normalised `FRONTEND_URL` and requests with no origin. Other origins are refused without an error page.
   - Security headers are on every response.
   - The CSP allows only the app's own origin, plus `fonts.googleapis.com` styles, `fonts.gstatic.com` fonts, and `blob:`/`data:` images and frames for previews. No inline scripts.
   - `trust proxy` is `1` in production only.
   - JWT secrets are at least 32 characters and different from each other.
   - The refresh cookie stays `httpOnly`, `sameSite: 'strict'`, and `secure` in production. Its `maxAge` comes from `JWT_REFRESH_TOKEN_EXPIRATION`.
   - The restore marker accepts only a bare `.sqlite` file name, so there's no path traversal. Backup paths never contain request data. There's no HTTP endpoint for backups or restore.
   - No secret, token, link or email body is logged in production.
4. **Integration constraints:**
   - Request and response shapes are unchanged except for these additive fields: `projectName` on search results and on `GET /documents/:id`, a nullable `uploadedByEmail` on the list, and a `Set-Cookie` on the 204 from `PATCH /auth/me/password`.
   - Status codes change in these places:
     - 409 on guarded admin actions.
     - 400 for a wrong current password (was 401).
     - 400 for a self email change without SMTP.
     - 413 and 400 on upload.
     - 429 on the rate limits.
     - 401 for non-ACTIVE accounts.
   - Stored files and storage keys are unchanged, so no file migration is needed.
   - Refresh cookies issued before the deploy fail once (no `jti`), and the user signs in again.
   - The `/api` prefix stays production-only. Static SPA serving is unchanged.
5. **Business rule constraints:**
   - The uploader snapshot is written once at upload (and by the migration backfill) and never updated afterwards.
   - Emails are compared case-insensitively. Stored emails are not rewritten.
   - A self email change is refused while SMTP isn't configured. An admin's email change marks the address verified.
   - Multi-project exports go to the save folder's root. Archives always go to the root.
6. **Error handling constraints:**
   - Use NestJS built-in exceptions with clear, user-facing messages.
   - Error messages must not expose file paths, stack traces or other internal details. Extraction failures store "Couldn't read text from this file." or "Couldn't process this image.", and the raw error goes only to the log.
   - Failed operations must not leave files or database rows half-finished:
     - A rejected upload (size or signature) creates no row or blob.
     - A failed backup leaves no `.tmp` file.
     - A failed restore stops the start command before migrations.
     - A failed folder write removes its own partial file.
   - The client never shows a native dialog. Session failures redirect once to `/login?next=…`. Auth endpoints never trigger refresh-on-401.
7. **Technical constraints:**
   - Exactly two new dependencies (`helmet` and `@nestjs/throttler`).
   - No IndexedDB wrapper and no File System Access `@types` package.
   - The `server/.env` file is never committed.
   - `npm run build:full` passes after every group, as does `npm test` from `server/`.
   - The client keeps `noUnusedLocals` and `noUnusedParameters` clean.
8. **Data constraints:**
   - The migration backfill fills every Document's snapshot and verifies only ACTIVE users with no pending verification token.
   - Dates written in SQL use the adapter's ISO format (`strftime('%Y-%m-%dT%H:%M:%f+00:00','now')`).
   - Backup files follow the `docindex-YYYYMMDD-HHmm.sqlite` pattern (UTC). Manual copies use other names and are never pruned.
   - Saved file and folder names are sanitised for Windows, including reserved device names.
9. **API constraints:**
   - 429 bodies carry "Too many attempts. Wait a few minutes and try again.".
   - Download endpoints send `Content-Disposition` built by `res.attachment`, which is RFC 6266 and 5987 safe and includes `filename*` for non-ASCII names. In development the header is exposed through CORS.
   - No new endpoints. Existing routes, methods and guards are unchanged apart from the throttling decorators and the changes listed above.
