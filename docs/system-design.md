# System Design

Runtime behaviour of the system.

---

## Access Model

1. User registers (or is created by an admin)
2. Self-registered users wait for admin approval and verify their email
3. Once active, user can log in
4. User sees only documents from projects they are assigned to
5. Admins see all projects and all documents
6. Role and project membership together determine all access

`uploadedBy` is stored for traceability.

---

## Document Status Flow

```
UPLOADED → PROCESSING → PROCESSED
                      → FAILED
```

Later (Phase 6):

```
UPLOADED → QUEUED → PROCESSING → PROCESSED
                              → FAILED
```

---

## Upload Flow

1. User selects a project and file (PDF, JPEG, or PNG)
2. API validates JWT and user is active
3. API checks project membership (admin bypasses)
4. Document record created (`status: UPLOADED`)
5. File saved to `BlobStore`
6. `storageKey` written back to document record
7. `status` set to `PROCESSING`
8. If PDF: `pdf-parse` extracts text, `DocumentText` record created
9. If image and OCR enabled (Phase 3): OCR runs, `DocumentText` created
10. If image and OCR not enabled: extraction skipped
11. `status` set to `PROCESSED`

On any failure: `status` set to `FAILED`, `errorMessage` stored.

---

## Registration Flow (Phase 2) — implemented

1. User submits their name, email and password
2. Password checked against policy (10+ chars, upper, lower, digit, special)
3. User created with `accountStatus: PENDING` and the submitted name
4. Verification email sent to user
5. Notification email sent to every admin
6. User clicks verification link → `emailVerifiedAt` set, token cleared (single use)
7. Admin approves in `/admin/pending` → `accountStatus: ACTIVE`
8. User can log in once both have happened
9. Login is rejected with a clear message if either step is incomplete

If SMTP is not configured, emails are written to the server log instead of being sent, so the flow remains testable in development.

---

## Search and Filter Flow (Phase 3) — NOT YET IMPLEMENTED

Target behaviour:

1. User selects filters (custom fields) and types a search query
2. Filters and query apply together
3. API loads documents the user can see (project-scoped)
4. Filters narrow the set
5. Search query narrows further (filename + extracted text + OCR text)
6. Up to 20 results returned with snippets

Both filter-only and search-only requests still work.

Current behaviour: `GET /documents/search` loads every project-scoped document that has extracted text, filters case-insensitively in memory on filename and text, and returns up to 20 `<mark>`-highlighted snippets. `GET /documents` supports a separate set of ad-hoc text filters (`supplier`, `materialType`, `quantity`, `orderNumber`) that are all matched against filename and extracted text because no dedicated columns exist yet. The two paths are not yet combined.

---

## Project Browse Flow

1. User opens Documents page
2. Sees only projects they are members of (admins see all)
3. Selects a project or views all visible projects
4. Applies filters and/or search
5. Opens document drawer or downloads

---

## Delete Flow (Phase 2) — implemented

1. User selects document(s) and confirms deletion
2. API verifies: admin (any project), or user with membership of the document's project — anything else is 404, the same as any other out-of-scope document
3. Document marked with `deletedAt` (soft delete) and its `storageKey` re-pointed at the deleted area
4. `DeletionLog` row written: actor id + email, project id + name, document id, original filename, timestamp
5. File moved (not unlinked) to `deleted/{userId}/{documentId}.{ext}` in storage
6. The document immediately disappears from list, search, details, text, status counts, download and export
7. Admin can restore from the recycle bin (`/admin/recycle-bin`) within the 30-day window: `deletedAt` cleared, `restoredAt` stamped on the log, file moved back
8. Admin can also delete permanently before the window expires
9. After 30 days a scheduled task (daily, 03:00) permanently deletes the file and the `Document` row, and stamps `permanentlyDeletedAt` on the log

The `DeletionLog` row is never removed: `documentId` is a plain string rather than a foreign key, and the filename, project name and actor email are denormalised, so the audit trail stays readable after the document — or the actor's account — is gone. The retention window lives in one place (`DELETION_RETENTION_DAYS` in `server/src/common/deletion.constants.ts`).

The purge is safe to run repeatedly and concurrently: each document is claimed with a conditional delete, and a missing file is logged rather than thrown.

---

## Archive Flow (Phase 4)

### Archive
1. Admin opens project management page and clicks "Archive" on an active project
2. Operation claimed (`archiveOperation: ARCHIVING`); prevents concurrent modifications
3. Live documents are streamed into `archived/{projectId}.zip.partial` alongside `manifest.json`
4. If any document files are missing on disk, they are flagged as `missing: true` in the manifest and surfaced as a warning to the admin
5. Zip file is verified with `yauzl` against the manifest and moved to `archived/{projectId}.zip`
6. `archivedAt`, `archivedById`, `archivedByEmail`, and `archiveSizeBytes` are set in an interactive transaction verifying no document additions occurred
7. Active blobs for archived documents are deleted from `active/{projectId}/`
8. In-progress claim is released; project is hidden from all main views and displayed on `/admin/archive`

### Unarchive
1. Admin opens archive page and clicks "Restore"
2. Operation claimed (`archiveOperation: UNARCHIVING`)
3. Manifest verified; files extracted and saved through `BlobStore` back to `active/{projectId}/`
4. Document storage keys updated, `archivedAt` cleared in a single transaction
5. Archive zip `archived/{projectId}.zip` is deleted; claim released; project re-appears in main views

### Download (without unarchive)
1. Admin downloads zip directly from `/admin/archive` via `GET /archive/:id/download`
2. Downloaded zip contains files under `files/` along with `manifest.json`
3. Project remains archived

### Delete Archived Project (via Recycle Bin)
1. Admin clicks "Delete" on an archived project in `/admin/archive`
2. Operation claimed (`archiveOperation: DELETING`)
3. Archive zip is moved to `deleted/{projectId}/archive.zip`
4. Project and its documents are soft-deleted with shared `deletedAt` and audit logs written to `DeletionLog`
5. Restoring from the recycle bin within 30 days moves the zip back to `archived/` and returns the project to **Archived** status
6. Purge after 30 days (or permanent delete from the recycle bin) removes the zip and purges database records

---

## Export Flow

1. User selects one or more documents (within their visible scope)
2. `POST /exports` with `documentIds`
3. API verifies user can see all requested documents
4. API streams a ZIP archive containing the selected files
5. Browser downloads the archive

---

## Project Management Flow

1. Admin creates a project via the project management page (name only)
2. Admin adds users via the membership modal
3. Assigned users see the project and can upload to it
4. Admin can rename or delete (deleting soft-deletes the project and its active documents to the recycle bin for 30-day recovery)
5. Admin can archive active projects when work is complete, managing archived projects on `/admin/archive`

Note: a newly created project has no members. Even the creating admin must add members explicitly before non-admins can use it.

---

## User Management Flow

1. Pending registrations appear in the admin queue at `/admin/pending`
2. Admin reviews and approves or rejects
3. Admin can change user role at any time
4. Admin can edit user details (name, email, temporary password)
5. Users can change their own name, email and password. Changing an email address clears verification and sends a new verification link — the user must verify the new address before signing in again