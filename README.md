# Construction Document Indexer

A multi-user web application for uploading, organising, searching, and retrieving project-related documents for construction operations.

Built for shared company use — documents are organised by project, and access is controlled by role plus project membership.

---

## What It Does

- Authenticated users log in and browse documents from the projects they are assigned to
- Admins see and manage every project and document
- Documents are grouped by project — projects are the primary organising unit
- Users upload PDFs, JPEGs and PNGs to projects they are assigned to
- Uploaded PDFs are text-extracted on upload and made searchable immediately (images are stored without extraction until OCR lands in Phase 3)
- Full-text search with contextual snippets runs across everything the user can see
- Self-registration requires both email verification and admin approval
- An admin console manages projects, memberships, users, pending registrations and the recycle bin
- Users can delete documents in their own projects; admins can delete anywhere and have unrestricted upload access
- Deletions are soft: every deletion is logged with actor, project and timestamp, files are recoverable for 30 days, and the log survives permanent deletion
- Selected documents can be downloaded individually or exported as a ZIP

---

## Tech Stack

**Frontend**
- React 19 + TypeScript
- Vite
- Tailwind CSS
- React Router v7

**Backend**
- NestJS 11
- Prisma ORM + SQLite (via better-sqlite3)
- JWT authentication (access + refresh token rotation)
- Argon2 password hashing
- `pdf-parse` for text extraction
- `archiver` for ZIP export
- `cookie-parser` for HttpOnly refresh token cookie
- `nodemailer` for verification and approval emails
- `@nestjs/schedule` for the 30-day recycle bin purge

---

## Project Structure

```
/
├── client/          React frontend
├── server/          NestJS backend
├── docs/            Architecture and planning documents
└── .gitignore
```

---

## Running Locally

### Prerequisites

- Node.js 20+
- npm

### 1. Server

```bash
cd server
npm install
```

Create `server/.env`:

```env
DATABASE_URL="file:./dev.db"
FRONTEND_URL="http://localhost:5173"

JWT_ACCESS_SECRET="your-access-secret-here"
JWT_REFRESH_SECRET="your-refresh-secret-here"
JWT_ACCESS_TOKEN_EXPIRATION="15m"
JWT_REFRESH_TOKEN_EXPIRATION="7d"

# Optional — leave blank to log emails to the console instead of sending them
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM="DocIndex <noreply@yourdomain.com>"
```

See `server/.env.example` for the full annotated list.

Apply database migrations and start:

```bash
npm run db:migrate     # applies all Prisma migrations and creates dev.db
npm run start:dev      # starts server on http://localhost:3000 with hot reload
```

Other useful server commands:

```bash
npm run db:studio      # opens Prisma Studio (database browser)
npm run db:generate    # regenerates Prisma client after schema changes
npm run build          # compiles to dist/
```

### 2. Client

```bash
cd client
npm install
npm run dev            # starts Vite dev server on http://localhost:5173
```

The client reads `VITE_API_URL` from environment. If not set, it defaults to `http://localhost:3000`. Create `client/.env.local` to override:

```env
VITE_API_URL=http://localhost:3000
```

---

## Storage

Uploaded files are stored locally under `server/data/` at:

```
server/data/{userId}/{documentId}.{ext}
```

The extension is derived from the mime type (`pdf`, `jpg`, `png`).

Soft-deleted documents keep the same shape behind a `deleted/` prefix while they sit in the recycle bin:

```
server/data/deleted/{projectId}/{documentId}.{ext}[.gz]
```

Restoring moves the file back; only the 30-day purge (or an admin permanently deleting from the recycle bin) removes it from disk.

This directory is gitignored. It is created automatically on first upload.

Storage sits behind the `BlobStore` interface with a project-based layout (`active/{projectId}/`, `archived/{projectId}.zip`, `deleted/{projectId}/`).

---

## Environment Variables

| Variable | Location | Purpose |
|---|---|---|
| `DATABASE_URL` | `server/.env` | SQLite file path |
| `FRONTEND_URL` | `server/.env` | Base URL used in email links (CORS currently allows all localhost) |
| `JWT_ACCESS_SECRET` | `server/.env` | Signs access tokens |
| `JWT_REFRESH_SECRET` | `server/.env` | Signs refresh tokens |
| `JWT_ACCESS_TOKEN_EXPIRATION` | `server/.env` | Access token TTL (e.g. `15m`) |
| `JWT_REFRESH_TOKEN_EXPIRATION` | `server/.env` | Refresh token TTL (e.g. `7d`) |
| `SMTP_HOST` | `server/.env` | SMTP server. If host/user/pass are blank, emails are logged to the console |
| `SMTP_PORT` | `server/.env` | SMTP port (`465` implies SSL, otherwise STARTTLS) |
| `SMTP_USER` | `server/.env` | SMTP username |
| `SMTP_PASS` | `server/.env` | SMTP password |
| `SMTP_FROM` | `server/.env` | From address on outgoing mail |
| `STORAGE_ROOT` | `server/.env` | Root directory for file storage (default: `./data`) |
| `COMPRESSION_THRESHOLD_BYTES` | `server/.env` | Files larger than this in bytes are evaluated for compression (default: `5242880` = 5MB) |
| `COMPRESSION_MIN_SAVINGS_RATIO` | `server/.env` | Minimum ratio savings needed to keep compressed file (default: `0.1` = 10%) |
| `VITE_API_URL` | `client/.env.local` | Backend base URL |

---

## Accounts and Roles

| Role | Capabilities |
|---|---|
| `USER` | Login, upload to assigned projects, browse/search/download/export within assigned projects, delete documents in assigned projects, edit own name, email and password |
| `ADMIN` | Everything a USER can do, across all projects, plus manage projects, memberships and users, approve registrations, and restore or permanently delete from the recycle bin |

Users are assigned to projects via `ProjectMembership`. Admins bypass membership checks.

Account lifecycle:

1. A user self-registers → account is created as `PENDING` with an unverified email
2. A verification email goes to the user, and a notification goes to every admin
3. The user clicks the verification link → `emailVerifiedAt` is set
4. An admin approves in `/admin/pending` → `accountStatus` becomes `ACTIVE`
5. Login is only permitted once **both** steps are complete

Admin-created users (`POST /users`) are `ACTIVE` immediately and are forced to change their temporary password on first login.

Password policy: at least 10 characters with an uppercase letter, a lowercase letter, a digit and a special character.

---

## API Overview

| Endpoint | Auth | Notes |
|---|---|---|
| `POST /auth/register` | Public | Creates a PENDING account, sends verification + admin notification emails |
| `GET /auth/verify-email?token=` | Public | Consumes the email verification token |
| `POST /auth/login` | Public | Returns access token, sets refresh cookie; rejects unverified or unapproved accounts |
| `POST /auth/refresh` | Cookie | Rotates refresh token |
| `POST /auth/logout` | JWT | Revokes refresh tokens, clears cookie |
| `GET /auth/me` | JWT | Returns current user |
| `PATCH /auth/me` | JWT | Updates own profile (fullName, email, language, timezone); an email change requires re-verification |
| `PATCH /auth/me/password` | JWT | Changes own password, revokes all sessions |
| `GET /projects` | JWT | Lists projects the caller is a member of (admins see all) |
| `POST /projects` | JWT + ADMIN | Creates a project |
| `GET /projects/:id` | JWT + ADMIN | Project details with members |
| `PATCH /projects/:id` | JWT + ADMIN | Renames a project |
| `DELETE /projects/:id` | JWT + ADMIN | Deletes a project and its documents |
| `GET /projects/:id/members` | JWT + ADMIN | Lists members |
| `POST /projects/:id/members` | JWT + ADMIN | Adds a member |
| `DELETE /projects/:id/members/:userId` | JWT + ADMIN | Removes a member |
| `POST /documents/upload` | JWT | Uploads PDF/JPEG/PNG (no size limit), extracts PDF text, links to project |
| `GET /documents` | JWT | Lists documents with filters and sorting (max 50) |
| `GET /documents/status-counts` | JWT | Document counts grouped by status |
| `GET /documents/search` | JWT | Full-text search with snippets (`?q=query`, max 20) |
| `GET /documents/:id` | JWT | Document metadata and text preview |
| `GET /documents/:id/text` | JWT | Full extracted text |
| `GET /documents/:id/download` | JWT | Downloads the original file |
| `DELETE /documents/:id` | JWT | Soft deletes the document (admins anywhere, users within their projects) and logs it |
| `POST /documents/bulk-delete` | JWT | Bulk soft delete, returns `{ deleted, failed }` |
| `GET /recycle-bin` | JWT + ADMIN | Lists soft-deleted documents with actor, project and days remaining |
| `POST /recycle-bin/:id/restore` | JWT + ADMIN | Restores a soft-deleted document |
| `DELETE /recycle-bin/:id` | JWT + ADMIN | Permanently deletes a soft-deleted document (log row kept) |
| `POST /exports` | JWT | Exports selected documents as ZIP |
| `GET /users` | JWT + ADMIN | Lists all users |
| `GET /users/search?q=` | JWT + ADMIN | Searches users by name or email |
| `GET /users/pending` | JWT + ADMIN | Registrations awaiting approval |
| `GET /users/rejected` | JWT + ADMIN | Rejected registrations |
| `GET /users/:id` | JWT | Own profile, or any profile for admins |
| `POST /users` | JWT + ADMIN | Creates an active user with a temporary password |
| `PATCH /users/:id` | JWT + ADMIN | Edits name, email or temporary password |
| `PATCH /users/:id/status` | JWT + ADMIN | Approves or rejects a registration |
| `POST /users/:id/role` | JWT + ADMIN | Sets user role |
| `DELETE /users/:id` | JWT + ADMIN | Deletes a user |

All document reads and exports are project-scoped: non-admins only ever see documents from projects they are a member of. Soft-deleted documents are hidden from every read path and are only visible in the recycle bin.

---

## Phase Status

See `docs/project-plan.md` for full detail.

**Phase 1 – Core Operational MVP** — complete.

**Phase 2 – Access, Admin Console & Auditability** — complete. Admin console, project-scoped visibility (documents and projects), the registration/approval lifecycle, self-service email change, delete logging, soft delete with the 30-day recycle bin and its scheduled purge are all in place, and the 50MB upload limit has been removed.

**Phase 3 – Custom Filters & Search** — complete. Admin-configurable metadata fields (`/admin/filters`), search + filter combined, and OCR extraction for images.

**Phase 4 – Project Archive & Storage Structure** — complete. Dedicated archive page (`/admin/archive`), project zip creation/extraction, recycle-bin integration, transparent file compression, and project-based storage structure.

**Phases 5–7** — not started. The `/jobs` page is a static mock preview of Phase 6.

---

## Non-Goals (Current Phases)

- Microservices
- Distributed tracing
- Email ingestion
- OCR for scanned images (planned for Phase 3)
- Offline sync
- Native Windows / Android apps (to be evaluated after workflows are stable)
