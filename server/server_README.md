# Server

NestJS backend for the Construction Document Indexer.

## Stack

- NestJS 11
- Prisma ORM with SQLite (better-sqlite3)
- JWT (access + refresh token rotation)
- Argon2 password hashing
- pdf-parse for PDF text extraction
- tesseract.js for image OCR (JPEG/PNG)
- archiver for ZIP export
- nodemailer for verification and admin-notification emails

## Setup

```bash
npm install
```

Create `.env` in this directory (see `.env.example`):

```env
DATABASE_URL="file:./dev.db"
FRONTEND_URL="http://localhost:5173"

JWT_ACCESS_SECRET="generate-a-random-secret"
JWT_REFRESH_SECRET="generate-a-different-random-secret"
JWT_ACCESS_TOKEN_EXPIRATION="15m"
JWT_REFRESH_TOKEN_EXPIRATION="7d"

# Optional. If host/user/pass are blank, emails are logged to the console instead of sent.
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM="DocIndex <noreply@yourdomain.com>"
```

## Commands

```bash
# Development
npm run start:dev        # watch mode with hot reload, port 3000

# Database
npm run db:migrate       # run migrations (creates dev.db if missing)
npm run db:generate      # regenerate Prisma client after schema changes
npm run db:studio        # open Prisma Studio browser at localhost:5555

# Build
npm run build            # compile TypeScript to dist/
npm run start:prod       # run compiled output

# Tests
npm run test             # unit tests
npm run test:e2e         # end-to-end tests
npm run test:cov         # coverage report
```

## Module Structure

```
src/
├── auth/           JWT auth, refresh tokens, register/verify-email/login/logout/me,
│                   own-profile update, own-password change, password policy decorator
├── documents/      Upload, list, status counts, search, text, download, delete, bulk-delete,
│                   PDF text extraction + image OCR, custom filter value validation/query building
├── email/          Nodemailer transport — verification and admin-notification emails
├── exports/        Single-file download and ZIP export of selected documents
├── filters/        Admin-configurable custom filter fields (FilterDefinition CRUD, max 5 active)
├── prisma/         PrismaService wrapper
├── projects/       Project CRUD and membership management
├── storage/        BlobStore interface + LocalBlobStore implementation
└── users/          Admin user management, account status (approve/reject), roles
```

## Custom Filters & OCR (Phase 3)

- Admins manage up to 5 custom filter fields (`TEXT` / `NUMBER` / `DATE`) at `/admin/filters` (`FiltersModule`, `GET /filters` open to any authenticated user, create/update/delete admin-only).
- Values are entered once at upload time (`POST /documents/upload` accepts a `filterValues` form field: JSON `{ [filterDefinitionId]: "raw value" }`) and stored in `DocumentFilterValue`, typed to match the filter's declared type.
- The document list/search endpoints accept a `customFilters` query param (JSON `{ [filterDefinitionId]: { value?, from?, to? } }`) that combines with the existing `mainFilter` free-text search.
- Images (JPEG/PNG) are OCR'd via `tesseract.js` on upload so their text becomes searchable like PDFs. `tesseract.js` downloads its English language model (`eng.traineddata`, a few MB) to the working directory the first time OCR runs — this requires outbound internet access on first use; subsequent runs reuse the cached file.
- OCR failures (e.g. a corrupt or unreadable image) are caught and logged rather than failing the upload — the document still ends up `PROCESSED` with no extracted text.

## File Storage

Uploaded files are written to `./data/{userId}/{documentId}.{ext}` relative to the server working directory, where the extension is derived from the mime type (`pdf`, `jpg`, `png`).

The `data/` directory is gitignored and created automatically.

## Authentication Flow

- `POST /auth/register` creates a `PENDING`, email-unverified account and returns a message only — no tokens
- The user receives a verification link; every admin receives a notification to review the request in `/admin/pending`
- `POST /auth/login` rejects the attempt until the email is verified **and** an admin has set the account to `ACTIVE`
- On success it returns an access token (JSON) plus `mustChangePassword`, and sets a refresh token (HttpOnly cookie)
- Access tokens expire after 15 minutes
- `POST /auth/refresh` issues a new pair and invalidates the old refresh token (rotation)
- `POST /auth/logout` revokes all refresh tokens for the user and clears the cookie
- `PATCH /auth/me/password` also revokes all refresh tokens
- All protected endpoints require `Authorization: Bearer <accessToken>`

## Authorization

Admin checks are performed inline in controllers; project-scoping is enforced in the service layer. Non-admins only see documents belonging to projects they are a member of - `getAccessibleProjectIds()` in `DocumentsService` and `ExportsService` returns `null` for admins (unrestricted) and the user's project IDs otherwise.
