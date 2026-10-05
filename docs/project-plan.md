# Project Plan – Construction Document Indexer

A multi-user document indexing and retrieval tool for construction operations teams.

---

## Current Position

**Phases 2, 3, and 4 are complete. Phase 5 is next.**

All four Phase 2 workstreams are built and wired end to end:

- Admin console (projects, membership, users, pending registrations, recycle bin) — **done**
- Project-scoped visibility across list, search, read, download, export and the project list itself — **done**
- Registration lifecycle (PENDING accounts, email verification, admin approval, password policy) — **done**
- Delete logging and 30-day recovery (soft delete, `DeletionLog`, recycle bin, scheduled purge) — **done**

The smaller Phase 2 items are closed too: the 50MB upload limit is gone, users can change their own email address (with re-verification), `GET /projects` is membership-scoped for non-admins, and the Register page now sends the full name it collects.

Phase 3 (custom filters, combined search+filter, OCR for images) is now built end to end.

Phase 4 (project archive, zip storage, recycle-bin integration, transparent compression, and project-based storage layout) is now built end to end.

Phases 5–7 are not started. The `/jobs` page exists in the frontend as a **static mock preview** of Phase 6.

---

## Goal

Build a multi-user application for uploading, organising, searching, and retrieving project-related documents.

Primary users: procurement team, managers, quantity surveyors.

Core problems being solved:
- Time lost in manual document lookup
- No shared, searchable document store
- No project-based organisation
- No audit trail of changes or deletions

---

## Product Direction

This is a project-scoped document system. Documents belong to projects, and a user's access to documents is determined by their project assignments.

Key rules:
- Documents are scoped to projects
- Users see only documents from projects they are assigned to
- Admins see and manage everything
- All destructive actions are logged for auditing
- Self-registration requires admin approval and email verification
- `uploadedBy` is stored for traceability

**Tentative — to confirm with stakeholder:**
- Project-scoped visibility for non-admins — **now implemented in code** (a reversal of the earlier "company-wide" decision). Still needs explicit stakeholder sign-off.
- Custom filters: available to all users vs creator-only

---

## Phase 1 – Core Operational MVP

Status: **complete**

| Item | Notes |
|---|---|
| JWT authentication with access + refresh tokens | Refresh token rotation, HttpOnly cookie |
| Argon2 password hashing | |
| USER / ADMIN role model | Enforced in service layer |
| Project entity + membership | `Project` + `ProjectMembership` in schema |
| Project management endpoints | Create, update, delete, list members, add/remove members |
| User admin endpoints | List, create, get by id, set role |
| Upload authorization | Admins unrestricted; users must be project members |
| PDF + image upload + local storage | Stored under `server/data/` via `LocalBlobStore` |
| PDF text extraction | `pdf-parse`, synchronous, runs on upload |
| Image upload without extraction | JPEG + PNG supported; status set to PROCESSED, no DocumentText created |
| 50MB file size limit | Removed in Phase 2 — uploads are no longer size-capped |
| Document status tracking | `UPLOADED → PROCESSING → PROCESSED / FAILED` |
| Document list with filtering and sorting | Filter by project, text, date range; sort by upload date, name, status |
| Full-text search with snippets | Searches filename + extracted text, returns `<mark>` highlighted snippets |
| Document details and text preview | First 150 chars of extracted text in list response |
| Download original file | |
| Admin-only delete (single + bulk) | Widened in Phase 2: project members can delete in their own projects |
| Status indicators in UI | Coloured badges per document status |
| ZIP export of selected documents | |
| Storage abstraction | `BlobStore` interface, `LocalBlobStore` implementation |

---

## Phase 2 – Access, Admin Console & Auditability

Status: **complete** — all 4 workstreams delivered.

### Admin Console (UI) — complete

| Item | Status | Notes |
|---|---|---|
| Project management page | ✅ done | `AdminProjects` — create, rename, delete, list, member count |
| Project membership page | ✅ done | `ManageMembersModal` — user search, add, remove |
| User management page | ✅ done | `AdminUsers` — list, create, edit name/email/temp password, change role, delete |
| Pending registrations queue | ✅ done | `AdminPending` — approve/reject via `PATCH /users/:id/status`, rejected list included |
| Recycle bin page | ✅ done | `AdminRecycleBin` at `/admin/recycle-bin` — list, restore, permanent delete |
| Admin route guard | ✅ done | `AdminGuard` checks `role === 'ADMIN'` via `/auth/me` |

### Project-Scoped Visibility — complete

| Item | Status | Notes |
|---|---|---|
| Users see only documents from assigned projects | ✅ done | `getAccessibleProjectIds` in `DocumentsService` and `ExportsService` |
| Admins see everything | ✅ done | Admins resolve to `null` (no project restriction) |
| Applies to list, search, details, text, status counts | ✅ done | Soft-deleted rows excluded from all of them |
| Applies to download and export | ✅ done | Enforced in `ExportsService` |
| Project list scoping | ✅ done | `GET /projects` is membership-scoped for non-admins; admins see all. `?scope=uploadable` still accepted and resolves identically |
| 50MB upload limit removed | ✅ done | `MAX_UPLOAD_BYTES` check and Multer `limits` both removed; mime-type allowlist kept |

### Authentication and Account Lifecycle — complete

| Item | Status | Notes |
|---|---|---|
| Self-registration creates a `PENDING` user | ✅ done | `accountStatus` defaults to `PENDING` in schema |
| Email sent to admin for approval | ✅ done | `EmailService.sendAdminApprovalNotification`, sent per-admin |
| Email sent to user to verify their address | ✅ done | SHA-256 hashed token, `GET /auth/verify-email`, `VerifyEmail` page |
| Both approval and verification required before login | ✅ done | Both checked in `AuthService.login` with distinct messages |
| Password policy enforcement | ✅ done | `IsStrongPassword`: min 10 chars, upper, lower, digit, special. Mirrored client-side on Register |
| Registration stores the full name | ✅ done | `RegisterDto.fullName` → `UsersService.create`; sent by the Register page |
| Users can change their own name | ✅ done | `PATCH /auth/me` |
| Users can change their own password | ✅ done | `PATCH /auth/me/password`, revokes all refresh tokens |
| Users can change their own email | ✅ done | `PATCH /auth/me` — 409 on duplicate, clears `emailVerifiedAt` and sends a new verification link |
| Admins can edit other users' details | ✅ done | `PATCH /users/:id` — name, email, temporary password (forces `mustChangePassword`) |

Known gaps in this workstream:
- The verification email says the link is valid for 24 hours, but no expiry is stored or checked. Tokens are currently valid indefinitely until consumed.
- The password policy applies to `RegisterDto` and `ChangePasswordDto` only. `CreateUserDto` (admin create) has no policy at all, and `AdminEditUserDto` uses a plain 8-character minimum. This is deliberate for temporary passwords, but worth confirming.

### Delete Logging and 30-Day Recovery — complete

| Item | Status | Notes |
|---|---|---|
| All file deletions logged with actor, timestamp, project | ✅ done | `DeletionLog` model; `documentId` is a plain string and context is denormalised so the row outlives the document |
| Soft delete with 30-day restoration window | ✅ done | `Document.deletedAt` (indexed); retention lives in `DELETION_RETENTION_DAYS` |
| Soft-deleted rows hidden from every read path | ✅ done | List, search, details, text, status counts, download, export |
| File moved rather than unlinked | ✅ done | `BlobStore.moveFile` → `deleted/{userId}/{documentId}.{ext}` |
| Recycle bin / restore UI for admins | ✅ done | `GET /recycle-bin`, `POST /recycle-bin/:id/restore`, `DELETE /recycle-bin/:id` behind `AdminGuard` |
| Users can delete files from their assigned projects | ✅ done | Admins anywhere; members within their projects; everyone else gets 404 |
| Permanent deletion after 30 days | ✅ done | `PurgeTask` via `@nestjs/schedule`, daily at 03:00; idempotent and tolerant of missing files |

---

## Phase 3 – Custom Filters & Search

Status: **complete**

`/admin/filters` is now a real, functional admin page: `FilterDefinition` and `DocumentFilterValue` tables exist (migration `20260928084423_add_custom_filters`), a `/filters` API (`FiltersModule`) backs it, and `tesseract.js` is installed and wired into upload.

### Custom Filters (Admin-Configurable Fields) — complete
| Item | Status | Notes |
|---|---|---|
| Admin defines custom filter fields via a settings page | ✅ done | `/admin/filters` — create, rename/retype, delete |
| Maximum 5 active filters at a time | ✅ done | Enforced in `FiltersService.create`; UI disables the add form and shows a capacity banner at 5/5 |
| Each filter has a name and a type (text, date, number) | ✅ done | `FilterType` enum: `TEXT`, `NUMBER`, `DATE` |
| Once created, filters are available to all users | ✅ done | `GET /filters` requires only authentication, not admin |
| Filters appear on upload forms (data entry) | ✅ done | Upload page renders a "Document Details" section with one input per active filter, applied to every file in the batch |
| Filters appear on document list (filtering) | ✅ done | Documents page filter panel renders one field per active filter (text/number input, or a from–to date range) |
| Schema: `FilterDefinition` table + `DocumentFilterValue` table | ✅ done | One `DocumentFilterValue` row per (document, filter) pair; only the column matching the filter's type is populated |

### Search + Filter Together — complete
| Item | Status | Notes |
|---|---|---|
| Users select filters and a search query together | ✅ done | `mainFilter` (filename + extracted text) ANDs with any active custom filters via `customFilters` query param |
| Filter-only and search-only modes both still work | ✅ done | Both are optional; either can be used alone |
| Date filter applies to the value entered for that filter | ✅ done | Not tied to upload date — `DocumentFilterValue.valueDate` |

Known gap: renaming a filter is safe, but changing its **type** discards previously entered values for that filter (they were stored in a type-specific column and can't be reinterpreted) — a deliberate, documented tradeoff, not a bug.

### OCR for Images — complete
- `tesseract.js` (`recognize()`, English model) runs after image upload, populating `DocumentText` so JPEG/PNG uploads participate in full-text search alongside PDFs
- OCR failures (unreadable/corrupt images) are caught and logged; the document still uploads successfully with `PROCESSED` status and no extracted text, rather than failing the whole upload
- Note: `tesseract.js` requires a required `errorHandler` callback to avoid crashing the Node process on certain worker-side failures — this is handled in `ExtractionService`

---

## Phase 4 – Archive & Storage Structure

Status: **complete**

`/admin/archive` is a fully functional admin management page, backed by the `ArchiveModule` on the server.

### Project Archive — complete
| Item | Status | Notes |
|---|---|---|
| Admin can archive a project from project management | ✅ done | `ArchiveProjectModal` wired to `POST /archive/:id` with missing file detection |
| On archive: project files zipped, `archivedAt` stamped | ✅ done | Stored in `archived/{projectId}.zip` with `manifest.json`; in-progress claim prevents race conditions |
| On unarchive: zip extracted, files restored, `archivedAt` cleared | ✅ done | `POST /archive/:id/restore` extracts manifest entries back to `active/{projectId}/` |
| Dedicated archive page lists archived projects | ✅ done | `/admin/archive` displays project, date, actor, size, document count, and client search |
| Admin can download zip without unarchiving | ✅ done | `GET /archive/:id/download` streams archive zip with sanitised filename |
| Admin can delete archived projects | ✅ done | Routes through the 30-day recycle bin (`deleted/{projectId}/archive.zip`); restoring returns project to archive |

### Project-Based Storage Structure — complete
| Item | Status | Notes |
|---|---|---|
| Root folder configurable by environment | ✅ done | `STORAGE_ROOT` in `.env` (defaults to `./data`) |
| Inside root: active, archived, and deleted layout | ✅ done | `active/{projectId}/`, `archived/{projectId}.zip`, `deleted/{projectId}/` |
| One-off storage layout migration script | ✅ done | `npm run storage:migrate` moves legacy files and updates document storage keys |

### File Compression — complete
| Item | Status | Notes |
|---|---|---|
| Large files evaluated for gzip compression before storage | ✅ done | `COMPRESSION_THRESHOLD_BYTES` (5MB default) |
| Compression applied only when saving space meaningfully | ✅ done | `COMPRESSION_MIN_SAVINGS_RATIO` (10% default); key gets `.gz` suffix |
| Transparent read decompression | ✅ done | `BlobStore.readFile` and `createReadStream` decompress automatically |

---

## Phase 5 – Deployment

Status: **not started** — SMTP brought forward into Phase 2

- HTTPS
- OneDrive integration (replaces `LocalBlobStore`)
- ~~SMTP setup for transactional emails (approval, verification)~~ — **done early**: `nodemailer` transport in `EmailService`, configured via `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM`, falls back to console logging when unconfigured
- Structured logging — only Nest's default `Logger` is used today
- Environment-based configuration — partially done via `@nestjs/config` and `.env.example`
- Backup strategy
- Print document button with print preview (if time allows)

---

## Phase 6 – Async Processing

Status: **not started** — UI mock exists

- Queue-based document processing pipeline
- API + worker architecture
- Background text extraction (PDF and OCR)
- Background compression and archive jobs
- Retry failed jobs
- Job status endpoints
- Jobs page becomes real (currently mock data)

The `QUEUED` status already exists in the `DocumentStatus` enum but is never set — extraction still runs synchronously inside `uploadDocument`.

---

## Phase 7 – Future

Status: **not started**

- Native app evaluation (laptop, tablet, phone — single app, all platforms)
- Email attachment ingestion
- Offline-friendly document viewing

---

## Known Technical Notes

- Storage key format is `active/{projectId}/{documentId}.{ext}[.gz]`, and `deleted/{projectId}/{documentId}.{ext}[.gz]` while a document sits in the recycle bin.
- The `/jobs` route is a mock-data preview of Phase 6 functionality. Its banner says so, and its Download, Delete and Retry actions are `TODO(backend)` stubs.
- Frontend `TODO(backend)` hooks: "Retry" on FAILED documents in the Documents table (needs a retry-processing endpoint) and "Generate register PDF" in the Documents export menu (needs a register PDF endpoint). Both controls are visible and do nothing yet.
- `/admin/archive` and `/admin/filters` are both real, fully wired pages (Phases 3 and 4).
- `User` has `language`, `timezone` fields that are unused. Candidates for removal — see backlog.
- Search loads every accessible document with extracted text into memory and filters in JavaScript (`searchDocuments`). Fine at current scale, but it will need a SQL/FTS rewrite before real data volumes.
- `listDocuments` is hard-capped at 50 rows with no pagination, and search at 20.
- `AuthService.refresh` matches the most recent non-revoked token for the user rather than looking up the presented token, so concurrent sessions on multiple devices can invalidate each other.
- `POST /projects` has no membership bootstrap — a newly created project has no members until an admin adds them.
- Deleting a project soft-deletes its documents to the recycle bin for 30-day recovery.
- The purge task runs in-process on a single API instance. If the API is ever scaled out, every instance will run it — the conditional-delete claim makes that safe, but it is wasted work.
- Custom filter values are entered once at upload time; there is no UI to edit a document's filter values afterward. Would be a small, self-contained addition on top of the existing `DocumentFilterValue` schema.
- Discovered during Phase 3 testing, **pre-existing and unrelated to Phase 3**: `pdf-parse@1.1.1` (bundling a very old `pdfjs-dist` build) can throw spurious `bad XRef entry` / `Illegal character` errors on this Node version for some otherwise-valid PDFs, marking the upload `FAILED` even though the file itself is fine. Root cause looks like an old pdf.js incompatibility with newer V8/Buffer internals, not anything in the app's own code. Worth a closer look (or a `pdf-parse` alternative) separately from this feature.
- `tesseract.js`'s `recognize()`/`createWorker()` requires an explicit `errorHandler` option — without one, a worker-side failure (e.g. an unreadable image) throws on the message port and crashes the whole Node process instead of just rejecting the call's promise. `ExtractionService.extractTextFromImageBuffer` passes a no-op handler to keep OCR failures contained to a per-document try/catch.

---

## Immediate Next Steps (to open Phase 5)

1. Set up HTTPS and deployment environment.
2. Implement OneDrive storage provider implementing `BlobStore` (replaces `LocalBlobStore`).
3. Add structured logging across the application.
4. Establish backup strategy for database and blob storage.
5. Backlog carry-over: add an expiry to email verification tokens; add a UI to edit a document's custom filter values after upload.