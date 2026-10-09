# Deployment guide

How to deploy, back up and restore the app on Render. For local setup, see the [README](../README.md).

## Overview

- One Render web service runs NestJS, which also serves the built React client in production. API routes sit under `/api`.
- A persistent disk mounted at `/data` holds the SQLite database, uploaded files and database backups.
- The service must run as exactly one instance. Rate limits are held in memory, the backup and purge jobs run in-process, and a persistent disk attaches to a single instance.

## Render settings

| Setting | Value |
|---|---|
| Root directory | `server` |
| Node version | 20, matching `.nvmrc` |
| Build command | `npm install --include=dev && npx prisma generate && npm run build:full` |
| Start command | `npm run start:render` |
| Disk mount path | `/data` |
| Health check path | `/` |

Dev dependencies are installed because the `prisma` CLI is needed at build and at start. `build:full` builds the client first, then the API.

`start:render` does three things in order: it restores a database backup if one was requested (see [Restore from a backup copy](#restore-from-a-backup-copy)), runs `prisma migrate deploy`, then starts the API.

## Environment variables

Never commit secrets or put real values in documentation. Set these in the Render dashboard. The server validates them at start-up and refuses to start if any are invalid.

Generate each JWT secret separately:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

| Variable | Required | Value |
|---|---|---|
| `NODE_ENV` | Yes | `production` |
| `DATABASE_URL` | Yes | Absolute `file:` URL on the disk, for example `file:/data/vault.db` |
| `STORAGE_ROOT` | Yes | Absolute path on the disk, for example `/data` |
| `JWT_ACCESS_SECRET` | Yes | 32+ characters, different from the refresh secret |
| `JWT_REFRESH_SECRET` | Yes | 32+ characters, different from the access secret |
| `FRONTEND_URL` | Yes | Exact public origin without a trailing slash, for example `https://vault.example.com` |
| `JWT_ACCESS_TOKEN_EXPIRATION` | No | Default `15m` |
| `JWT_REFRESH_TOKEN_EXPIRATION` | No | Default `7d` |
| `MAX_UPLOAD_MB` | No | Default `50`, range 1 to 1024 |
| `BACKUP_DIR` | No | Default `<STORAGE_ROOT>/backups` |
| `BACKUP_KEEP` | No | Default `14`, range 1 to 365 |
| `COMPRESSION_THRESHOLD_BYTES` | No | Default 5 MB |
| `COMPRESSION_MIN_SAVINGS_RATIO` | No | Default `0.1` |
| `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | All or none | Outgoing mail |
| `SMTP_PORT` | No | Default `587` |
| `PORT` | Set by Render | Injected automatically |
| `VITE_API_URL` | No | Client build variable. Defaults to `/api`, which suits one service on one origin |
| `VITE_MAX_UPLOAD_MB` | No | Client build variable. Keep it equal to `MAX_UPLOAD_MB` |

`VITE_*` variables are baked in at build time, so changing them needs a new build.

## Before deploying a migration

Take a manual backup from the Render Shell first. Replace `YYYYMMDD-HHmm` with the current date and time:

```bash
cd /opt/render/project/src/server && node -e "require('better-sqlite3')(process.env.DATABASE_URL.replace(/^file:/,'')).exec(\"VACUUM INTO '/data/backups/manual-YYYYMMDD-HHmm.sqlite'\")"
```

Files named `manual-*` are never pruned by the automatic clean-up.

## Upgrading an existing deployment

1. Take a manual backup (above).
2. Check the build and start commands and the environment variables against this guide.
3. Deploy, then check the logs: `prisma migrate deploy` should apply any pending migrations, and a start-up backup should be logged if the newest one is over 24 hours old.
4. If session handling changed, ask users to sign in again.
5. After the first production deploy, run the [proxy check](#proxy-check).

## Automatic backups

- **Schedule:** every night at 02:30 server time, and at start-up when there is no backup or the newest is over 24 hours old.
- **Format:** `docindex-YYYYMMDD-HHmm.sqlite` in `BACKUP_DIR`, with the time in UTC. Each is a consistent copy made with `VACUUM INTO`.
- **Retention:** the newest `BACKUP_KEEP` files matching that name are kept and older ones are deleted.
- **Contents:** a backup holds the database only, not the uploaded files.
- **Disk space:** check with `du -sh /data/backups` in the Render Shell, or on the Disk page of the dashboard.

## Copy a backup off Render

The backups sit on the same disk as the database, so keep copies elsewhere too. From your own computer, after adding your SSH key in Render:

```bash
scp <service-ssh-address>:/data/backups/<backup-file-name>.sqlite .
```

Run this in a local terminal, not in the Render Shell. Automatic offsite copies are planned for Phase 5.

## Restore from a backup copy

1. In the Render Shell, list the backups and choose a file:

   ```bash
   ls -lh /data/backups
   ```

2. Optionally take a manual backup of the current database first.
3. Create the restore marker, using the chosen file name:

   ```bash
   echo docindex-YYYYMMDD-HHmm.sqlite > /data/backups/RESTORE
   ```

4. In the dashboard, run a manual deploy or restart the service.
5. On start-up, `start:render` reads the marker, replaces the database file, removes any stale `-journal`, `-wal` and `-shm` files, and renames the marker to `RESTORE.done-YYYYMMDD-HHmm`. Migrations then run on the restored database and the API starts.
6. Check the logs for `Database restored from <file name>`.

The marker must contain only the name of a `.sqlite` file in the backups folder. Otherwise the start-up fails with an error, so the service doesn't boot on a half-restored database.

Uploaded files aren't part of a database copy. Files uploaded after the backup remain on disk but won't appear in the app.

## Restore from a Render disk snapshot

To recover the database and the files together, use the Snapshots section of the Disk page in the Render dashboard. This returns the whole disk to the snapshot time, so anything written afterwards is lost. Prefer a database copy unless the disk's files are damaged.

## Proxy check

The app trusts one proxy hop in production so that rate limits use the real client IP. To confirm that:

1. Enter a wrong password for the same email 11 times from one network. The 11th attempt must return 429 with "Too many attempts. Wait a few minutes and try again."
2. From a different network, such as a phone hotspot, sign in. It must not be blocked. If it is, the proxy hop count is wrong.

## Email

SMTP is optional. Without it, the server logs lines starting `email not sent (SMTP not configured)` and does not send anything. Self-registration needs email verification, so it can't complete without SMTP. For a pilot without SMTP, create users from the admin Users page instead.
