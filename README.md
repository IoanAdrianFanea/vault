# Construction Document Indexer

A multi-user web app for uploading, organising, searching and retrieving project documents for construction teams. Documents belong to projects, and access depends on a user's role and project membership.

## What it does

- Users upload PDFs, JPEGs and PNGs to the projects they belong to. Admins can upload to any project.
- Text is extracted on upload (PDF text, plus OCR for images), so everything is searchable straight away.
- Search runs across file names and document text, shows highlighted snippets, and combines with up to five admin-defined custom filter fields.
- Non-admins only ever see documents from their own projects. Admins see everything.
- Documents can be downloaded one at a time or exported as a ZIP, and the document list can be exported as CSV.
- In Chrome or Edge, downloads and copies of uploads can be saved straight into a chosen folder, one sub-folder per project.
- Deletion is soft: documents and projects sit in an admin-only recycle bin for 30 days, and every document deletion is logged.
- Admins can archive a finished project into a single zip, download it, or restore it later.
- Self-registration needs email verification and admin approval. Admins can also create users directly.
- An admin console covers projects, members, users, pending requests, the recycle bin, the archive and the custom filters.

## Tech stack

- **Client:** React 19, TypeScript, Vite, Tailwind CSS, React Router 7.
- **Server:** NestJS 11, Prisma 7 with SQLite (better-sqlite3), JWT access and refresh tokens, Argon2, `pdf-parse`, `tesseract.js`, `archiver`, `nodemailer`, `helmet`, `@nestjs/throttler` and `@nestjs/schedule`.
- **Hosting:** one Render web service. In production Nest serves the built client, and the database, files and backups live on a persistent disk. See [docs/deploy.md](docs/deploy.md).

## Project structure

```
client/   React app (src/api, components, hooks, pages, utils)
server/   NestJS API, Prisma schema and migrations
docs/     Project plan, backlog and deployment guide
spdd/     SPDD analysis, prompt and requirement records
```

## Running locally

Requires Node.js 20 (see `.nvmrc`) and npm.

### Server

```bash
cd server
npm install
cp .env.example .env     # then fill in the two JWT secrets
npm run db:migrate       # applies migrations and creates dev.db
npm run start:dev        # http://localhost:3000, with hot reload
```

Generate each JWT secret (32+ characters, different from each other) with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

If SMTP is not configured, emails are logged to the console instead of being sent. The first OCR run downloads the English language data (`eng.traineddata`) into the server's working directory, so it needs internet access once.

### Client

```bash
cd client
npm install
npm run dev              # http://localhost:5173
```

The client talks to `http://localhost:3000` by default. To change that, set `VITE_API_URL` in `client/.env.local`.

### npm scripts

| Where | Script | What it does |
|---|---|---|
| server | `start:dev` | Runs the API in watch mode |
| server | `build` | Compiles the API to `dist/` |
| server | `build:full` | Builds the client, then the API. This is what Render runs |
| server | `start:prod` | Runs the compiled API |
| server | `start:render` | Restores a database backup if one is requested, applies migrations, then starts the API |
| server | `db:migrate` | Applies and creates Prisma migrations in development |
| server | `db:generate` | Regenerates the Prisma client |
| server | `db:studio` | Opens Prisma Studio |
| server | `storage:migrate` | One-off move of files from the old per-user layout to the per-project layout |
| server | `test`, `test:watch`, `test:cov` | Jest unit tests |
| server | `lint`, `format` | ESLint (with fixes) and Prettier |
| client | `dev` | Runs the Vite dev server |
| client | `build` | Type-checks and builds to `client/dist/` |
| client | `lint` | Runs ESLint |
| client | `preview` | Serves the built client |

## Environment variables

Server variables live in `server/.env` (see [server/.env.example](server/.env.example)). They are validated at start-up, and the server refuses to start if any are invalid.

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | SQLite file URL, for example `file:./dev.db` |
| `STORAGE_ROOT` | Yes | Root folder for uploaded files (`active/`, `archived/`, `deleted/`) |
| `JWT_ACCESS_SECRET` | Yes | Signs access tokens (32+ characters) |
| `JWT_REFRESH_SECRET` | Yes | Signs refresh tokens (32+ characters, different from the access secret) |
| `FRONTEND_URL` | In production | Site origin without a trailing slash. Used for CORS, the content security policy and email links |
| `NODE_ENV` | No | `development`, `production` or `test`. `production` adds the `/api` prefix, serves the client and trusts one proxy hop |
| `PORT` | No | API port (default `3000`) |
| `JWT_ACCESS_TOKEN_EXPIRATION` | No | Access token lifetime, such as `15m` (default `15m`) |
| `JWT_REFRESH_TOKEN_EXPIRATION` | No | Refresh token lifetime, such as `7d` (default `7d`) |
| `MAX_UPLOAD_MB` | No | Upload size limit in MB, 1 to 1024 (default `50`) |
| `BACKUP_DIR` | No | Database backup folder (default `<STORAGE_ROOT>/backups`) |
| `BACKUP_KEEP` | No | Automatic backups to keep, 1 to 365 (default `14`) |
| `COMPRESSION_THRESHOLD_BYTES` | No | Files above this size are tried with gzip (default 5 MB) |
| `COMPRESSION_MIN_SAVINGS_RATIO` | No | Minimum saving, from 0 to 1, for the compressed copy to be kept (default `0.1`) |
| `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | All or none | Outgoing mail. With none set, emails are logged instead |
| `SMTP_PORT` | No | SMTP port (default `587`; `465` uses SSL, anything else STARTTLS) |

Client variables are read at build time from `client/.env.local`:

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | API base URL. Defaults to `http://localhost:3000` in development and `/api` in production |
| `VITE_MAX_UPLOAD_MB` | Client-side upload limit in MB (default `50`). Keep it equal to `MAX_UPLOAD_MB` |

## Storage

Files are stored through the `BlobStore` interface, implemented by `LocalBlobStore` under `STORAGE_ROOT`:

```
active/{projectId}/{documentId}.{ext}[.gz]
archived/{projectId}.zip
deleted/{projectId}/{documentId}.{ext}[.gz]
```

A `.gz` suffix marks a file that was compressed because it saved enough space. Reads decompress it transparently. The uploads folder is gitignored.

## Accounts and roles

| Role | Can do |
|---|---|
| `USER` | Sign in, upload to assigned projects, browse, search, download, export and delete documents in those projects, and edit their own name, email and password |
| `ADMIN` | Everything a user can do across all projects, plus the admin console |

**Self-registration:**

1. The user registers and the account is created as `PENDING` with an unverified email.
2. The user gets a verification email, and every admin gets a notification.
3. The user follows the link, which sets `emailVerifiedAt`.
4. An admin approves the request in `/admin/pending`, which sets the account to `ACTIVE`.
5. Sign-in only works once both steps are done. Rejected requests move to a separate list.

**Admin-created users:** these are `ACTIVE` and verified straight away, and must change their temporary password at first sign-in.

**Protections:** only `ACTIVE` accounts can use the app, and an account that stops being active is refused on its next request. Admins can't delete, demote or deactivate themselves, and the last active admin can't be removed (409). Deleting a user keeps their documents, which then show the uploader's email from a stored copy.

**Passwords:** at least 10 characters with an uppercase letter, a lowercase letter, a number and a special character. Temporary passwords set by an admin only need 8 characters.

**Sessions:** the access token is held in `sessionStorage`, and the refresh token is an HttpOnly cookie that rotates on each use. The client refreshes silently when the access token is missing or expires. Changing your password signs out your other sessions.

## API overview

All routes need a valid access token unless marked public. In production they sit under `/api`. Routes marked admin reject non-admin users.

| Area | Routes |
|---|---|
| Auth | Public: `POST /auth/register`, `GET /auth/verify-email?token=`, `POST /auth/login`, `POST /auth/refresh` (uses the cookie). Signed in: `POST /auth/logout`, `GET` and `PATCH /auth/me`, `PATCH /auth/me/password` |
| Projects | `GET /projects` (members' projects, or all for admins). Admin: `POST /projects`, `GET`, `PATCH` and `DELETE /projects/:id`, `GET` and `POST /projects/:id/members`, `DELETE /projects/:id/members/:userId` |
| Documents | `POST /documents/upload`, `GET /documents`, `GET /documents/status-counts`, `GET /documents/search?q=`, `GET /documents/:id`, `GET /documents/:id/text`, `GET /documents/:id/download`, `DELETE /documents/:id`, `POST /documents/bulk-delete` |
| Exports | `POST /exports` (selected documents as a ZIP) |
| Filters | `GET /filters` (any user). Admin: `POST /filters`, `PATCH` and `DELETE /filters/:id` |
| Users (admin) | `GET /users`, `POST /users`, `GET /users/search?q=`, `GET /users/pending`, `GET /users/rejected`, `PATCH /users/:id`, `PATCH /users/:id/status`, `POST /users/:id/role`, `DELETE /users/:id`. `GET /users/:id` also works for your own profile |
| Recycle bin (admin) | `GET /recycle-bin`, `POST /recycle-bin/:id/restore`, `DELETE /recycle-bin/:id`, `GET /recycle-bin/projects`, `GET /recycle-bin/projects/:id/documents`, `POST /recycle-bin/projects/:id/restore`, `DELETE /recycle-bin/projects/:id` |
| Archive (admin) | `GET /archive`, `POST /archive/:id`, `POST /archive/:id/restore`, `GET /archive/:id/download`, `DELETE /archive/:id` |

Behaviour worth knowing:

- Uploads accept PDF, JPEG and PNG up to `MAX_UPLOAD_MB`. A larger file gets 413, and a file whose content doesn't match its type gets 400.
- `POST /documents/upload` takes a multipart `file` and `projectId`, plus an optional `filterValues` field: JSON of `{ [filterDefinitionId]: "value" }`. `GET /documents` and search accept a `customFilters` query parameter: JSON of `{ [filterDefinitionId]: { value?, from?, to? } }`, combined with `mainFilter` (keyword).
- `GET /documents` returns at most 50 rows and search returns at most 20. Search needs at least 2 characters.
- Documents outside a user's projects return 404, not 403, so their existence isn't revealed. Soft-deleted documents are hidden everywhere except the recycle bin.
- `POST /auth/register`, `GET /auth/verify-email` and `POST /auth/login` allow 10 requests per 15 minutes (per IP, and per IP and email for login). Every other route allows 300 requests per minute per IP. Going over returns 429.

## Current status

Phases 1 to 4.5 and the UI redesign are complete. Phase 5 (deployment and OneDrive storage) is next. The `/jobs` page is a sample-data preview of Phase 6, and a few controls are placeholders waiting for backend endpoints (see [docs/project-plan.md](docs/project-plan.md)).

- [docs/project-plan.md](docs/project-plan.md): phase summaries, Phase 5 detail and technical notes
- [docs/BACKLOG.md](docs/BACKLOG.md): open ideas and resolved items
- [docs/deploy.md](docs/deploy.md): Render settings, backups and restore

## Not planned for now

- Microservices or distributed tracing
- Email ingestion
- Offline sync
- Native apps (to be evaluated once the web workflows are stable)
