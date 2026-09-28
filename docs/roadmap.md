# Roadmap

Development stages for the Construction Document Indexer.

---

## Phase 1 – Core Operational MVP

Status: **complete**

- Authentication (JWT + refresh token rotation)
- USER / ADMIN roles
- Project entity + membership
- Project management endpoints (create, update, delete, members)
- User admin endpoints (list, create, get, set role)
- PDF + image upload (JPEG, PNG) with project association
- PDF text extraction
- Image upload — OCR added in Phase 3, images now extracted like PDFs
- Document status tracking
- Status indicator badges in UI
- Full-text search with snippets
- Document list with filtering and sorting
- Document details and text preview
- Download original file
- Admin-only delete (single + bulk) — widened to project members in Phase 2
- ZIP export
- Storage abstraction (BlobStore interface)

---

## Phase 2 – Access, Admin Console & Auditability

Status: **complete**

Done:
- Admin console: project management page (create, rename, delete, list)
- Admin console: project membership page (add/remove users)
- Admin console: user management page (list, create, edit, change role, delete)
- Admin console: pending registrations queue (approve / reject)
- Admin console: recycle bin page (restore, permanent delete)
- Project-scoped visibility (users see only assigned projects, admins see all) — list, search, details, text, download, export
- `GET /projects` scoped by membership for non-admins
- Self-registration with admin approval (name now captured and stored)
- Email verification on signup (with SMTP transport, console fallback in dev)
- Password policy (10+ chars, upper, lower, digit, special)
- User self-service profile editing — name, email (with re-verification) and password
- Upload size limit removed
- Delete logging with full audit trail (`DeletionLog`, kept after permanent deletion)
- Soft delete with a 30-day restore window, files moved to a `deleted/` storage area
- Non-admin delete within assigned projects (admins anywhere)
- Scheduled 30-day purge task

Deferred to a later phase:
- Expiry on email verification tokens (tokens are single-use but never expire)
- Project delete is still permanent and cascades to its documents (only per-document deletion is recoverable)

---

## Phase 3 – Custom Filters & Search

Status: **complete**

- Admin-configurable custom filter fields (max 5) — `/admin/filters`
- Filter management page (create, rename/retype, delete)
- Search + filter combined for precise lookup (`mainFilter` + `customFilters`)
- OCR for images via `tesseract.js` (pulled forward from Phase 5)
- Filtering applies to the value entered for each filter (e.g. a `DATE` filter's own value), not upload date

---

## Phase 4 – Archive & Storage Structure

Status: **not started** (static UI mock at `/admin/archive`)

- Project archive (zip on archive, restore on unarchive)
- Archive page
- OneDrive folder structure (active / archived / deleted)
- File compression above size threshold

---

## Phase 5 – Deployment

Status: **not started** (SMTP already delivered as part of Phase 2)

- HTTPS
- OneDrive integration (replaces LocalBlobStore)
- ~~SMTP for approval and verification emails~~ — done early
- Structured logging
- Environment configuration (partially done via `@nestjs/config`)
- Backup strategy
- Print document button (if time allows)

---

## Phase 6 – Async Processing

Status: **not started** (static UI mock at `/jobs`)

- Queue-based document processing
- Background text extraction (PDF and OCR)
- Background compression and archive jobs
- Retry on failure
- Job status endpoints
- Real Jobs page

---

## Phase 7 – Future

Status: **not started**

- Native app for all platforms (single app — laptop, tablet, phone)
- Email attachment ingestion
- Offline document access