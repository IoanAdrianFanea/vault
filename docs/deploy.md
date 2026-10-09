# Deployment Guide

This guide covers deploying, maintaining, backing up, and restoring the Vault application on Render.

## 1. Overview

- **Architecture:** One Render web service running NestJS, which also serves the built React client in production.
- **Storage:** A persistent disk mounted at `/data`, holding the SQLite database, uploaded document files, and database backups.
- **Single instance requirement:** The service must run as exactly one instance. Rate limits are in memory, scheduled background jobs run in-process, and Render persistent disks attach to a single instance.

## 2. Render Settings

Configure the web service in the Render dashboard with these settings:

| Setting | Value |
|---|---|
| **Root Directory** | `server` |
| **Node Version** | Matches `.nvmrc` (v24) |
| **Build Command** | `npm install --include=dev && npx prisma generate && npm run build:full` |
| **Start Command** | `npm run start:render` |
| **Disk Mount Path** | `/data` |
| **Health Check Path** | `/` |

*Note on Build Command:* Dev dependencies are needed at build and start for the `prisma` CLI.

## 3. Environment Variables

Never commit secrets or write real values into documentation. Generate unique secrets for each environment.

### Secret Generation Command

Generate 32+ character secrets using:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Run this command twice to generate distinct values for `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`.

### Variables Table

| Variable | Required | Description |
|---|---|---|
| `NODE_ENV` | Required | Set to `production`. |
| `DATABASE_URL` | Required | Absolute `file:` URL on the persistent disk (e.g. `file:/data/vault.db`). |
| `STORAGE_ROOT` | Required | Absolute path on disk for document storage (e.g. `/data`). |
| `BACKUP_DIR` | Optional | Directory for database backups. Defaults to `<STORAGE_ROOT>/backups` (`/data/backups`). |
| `BACKUP_KEEP` | Optional | Number of automatic backup copies to retain. Defaults to `14` (min 1, max 365). |
| `JWT_ACCESS_SECRET` | Required | Secret for signing JWT access tokens (at least 32 characters; must differ from refresh secret). |
| `JWT_REFRESH_SECRET` | Required | Secret for signing JWT refresh tokens (at least 32 characters; must differ from access secret). |
| `JWT_ACCESS_TOKEN_EXPIRATION` | Optional | Access token expiration duration (defaults to `15m`). |
| `JWT_REFRESH_TOKEN_EXPIRATION` | Optional | Refresh token expiration duration (defaults to `7d`). |
| `FRONTEND_URL` | Required | Exact public site origin without trailing slash (e.g. `https://vault.example.com`). Used for CORS and email links. |
| `MAX_UPLOAD_MB` | Optional | Maximum upload file size in megabytes. Defaults to `50` (min 1, max 1024). |
| `SMTP_HOST` | Optional | SMTP host for email delivery. All SMTP fields or none must be provided. |
| `SMTP_PORT` | Optional | SMTP port. Defaults to `587`. |
| `SMTP_USER` | Optional | SMTP username. |
| `SMTP_PASS` | Optional | SMTP password. |
| `SMTP_FROM` | Optional | Sender address (e.g. `Vault <noreply@example.com>`). |
| `COMPRESSION_THRESHOLD_BYTES` | Optional | Size threshold in bytes above which to attempt gzip compression. |
| `COMPRESSION_MIN_SAVINGS_RATIO` | Optional | Minimum savings ratio (0 to 1) required to retain gzip compression. Defaults to `0.1`. |
| `PORT` | Set by Render | Application port injected automatically by Render. |
| `VITE_API_URL` | Optional | Client build variable. Defaults to `/api` on the same origin in production. |
| `VITE_MAX_UPLOAD_MB` | Optional | Client build variable. Maximum upload file size in MB. Should match `MAX_UPLOAD_MB`. |

## 4. Before Deploying a Migration

Before deploying code containing database migrations, take a manual backup from the Render Shell:

```bash
cd /opt/render/project/src/server && node -e "require('better-sqlite3')(process.env.DATABASE_URL.replace(/^file:/,'')).exec(\"VACUUM INTO '/data/backups/manual-YYYYMMDD-HHmm.sqlite'\")"
```

Replace `YYYYMMDD-HHmm` with the current date and time (e.g. `manual-20261008-2200.sqlite`).
Manual copies use the `manual-` prefix and are never pruned by automatic cleanup routines.

## 5. First Deploy of Phase 4.5

1. Take a manual backup of the existing database via the Render Shell (see section 4).
2. In the Render Dashboard:
   - Update the Build Command to `npm install --include=dev && npx prisma generate && npm run build:full`.
   - Update the Start Command to `npm run start:render`.
   - Set the new environment variables (`STORAGE_ROOT`, `MAX_UPLOAD_MB`, `BACKUP_DIR`, `BACKUP_KEEP`, and verify `JWT_*` secrets meet length requirements).
3. Trigger a manual deploy and inspect service logs:
   - Verify `prisma migrate deploy` applies pending migrations.
   - Verify a startup backup is created and logged.
4. Have all users sign in once to issue fresh sessions with JWT session tracking (`jti`).
5. Perform the rate-limit proxy check (section 10) to verify client IP detection.

## 6. Automatic Backups

- **Schedule:** Backups run automatically every night at 02:30 server time (UTC), and on server startup whenever the newest existing backup is more than 24 hours old.
- **Retention:** The newest `BACKUP_KEEP` copies (default 14) are retained in `BACKUP_DIR`. Older copies matching `docindex-YYYYMMDD-HHmm.sqlite` are pruned automatically.
- **Disk Snapshots:** Render's daily persistent disk snapshot (retained for at least 7 days) includes these backup files.
- **Disk Space Monitoring:** Check disk usage via the Render dashboard Disk page or in the Shell with:
  ```bash
  du -sh /data/backups
  ```

## 7. Copy a Backup Off Render

To retain offsite copies outside Render:

### Using SCP (from your local machine)
After adding your SSH key in Render:
```bash
scp -s <service-ssh-address>:/data/backups/<backup-file-name>.sqlite .
```
*(Note: Run `scp` on your local PC terminal, not inside the Render Shell).*

### Using Magic Wormhole (if available)
If `which wormhole` succeeds in the Render Shell:
```bash
# In Render Shell:
wormhole send /data/backups/<backup-file-name>.sqlite

# On your local machine:
wormhole receive
```
Do not rely on Wormhole being pre-installed. Always store offsite backup copies in a separate storage provider.

## 8. Restore the Database From a Backup Copy

1. Open the Render Shell and list available backups:
   ```bash
   ls -lh /data/backups
   ```
   Choose the target `.sqlite` file.
2. Optionally take a manual backup of the current database before restoring (section 4).
3. Create the restore marker file (substituting the actual backup filename and `BACKUP_DIR`):
   ```bash
   echo docindex-YYYYMMDD-HHmm.sqlite > /data/backups/RESTORE
   ```
4. In the Render Dashboard: **Manual Deploy** → **Restart service**.
5. During startup:
   - Render stops the application process.
   - The `start:render` hook detects `/data/backups/RESTORE`, replaces the SQLite database file, removes stale journal/wal/shm files, and renames the marker to `RESTORE.done-YYYYMMDD-HHmm`.
   - `prisma migrate deploy` runs to bring the restored database up to date with migrations.
   - The application boots.
6. Check service logs to confirm: `"Database restored from <filename>"`.

*Note on document files:* Database copies contain metadata, users, and tags, but not uploaded file blobs. Documents uploaded after the backup was taken remain on disk in `STORAGE_ROOT` but will not appear in the database list.

## 9. Restore From a Render Snapshot

To recover both the database and file storage simultaneously:
1. In the Render Dashboard, go to the **Disk** page.
2. Open **Snapshots** and select **Restore**.
3. Render restores the entire disk state as of the snapshot timestamp. Any data written after the snapshot will be lost.

*Recommendation:* Prefer restoring from a database copy (section 8) unless persistent disk files are corrupted or missing.

## 10. Proxy Check

Verify that Render's proxy hop configuration correctly identifies client IP addresses:
1. Attempt to sign in with an incorrect password 11 times from one network connection.
2. The 11th attempt must receive HTTP 429: `"Too many attempts. Wait a few minutes and try again."`.
3. Concurrently attempt to sign in from a different network (e.g. mobile hotspot): sign-in attempts must still be accepted and not blocked. If they are blocked, the proxy hop count is incorrect.

## 11. Email

- SMTP configuration is optional.
- If SMTP variables are omitted, the server logs email notifications (e.g. `"email not sent (SMTP not configured)..."`).
- Self-registration requires email verification and therefore cannot complete without SMTP configured. For pilots without SMTP, create user accounts directly from the admin Users page.
