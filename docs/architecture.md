# Architecture Overview

Modular monolith. Controller → service → persistence separation throughout.

---

## High-Level Structure

```
Client (React + Vite)
        │
        ▼
NestJS API  (port 3000)
        │
        ├── Auth module          ✅ built
        ├── Projects module      ✅ built
        ├── Documents module     ✅ built
        ├── Exports module       ✅ built
        ├── Users module         ✅ built
        ├── Storage module       ✅ built
        ├── Email module         ✅ built (Phase 2)
        ├── Recycle Bin module   ✅ built (Phase 2 — delete logging, restore, 30-day purge)
        ├── Filters module       ✅ built (Phase 3)
        └── Archive module       ✅ built (Phase 4)
        │
        ▼
Prisma ORM
        │
        ▼
SQLite (dev.db)
        +
Local file storage (server/data/) — replaced by OneDrive in Phase 5
```

---

## Domain Model

```
User
  └── ProjectMembership → Project → Document → DocumentText
                                  └── DocumentFilterValue → FilterDefinition (Phase 3)
  └── DeletionLog (audit trail — soft-linked to Document by id, not a foreign key)
  └── RefreshToken
  └── EmailVerification (Phase 2)
```

Rules:
- Documents belong to a project
- Non-admin users can only see documents from projects they are members of
- Admins see and manage everything
- `uploadedById` stored on every document for traceability
- All deletions logged with actor, project, and timestamp — ✅ implemented (`DeletionLog`)

---

## Entities

Legend: ✅ present in `schema.prisma` today · ⬜ planned

### User ✅
- `id`, `email`, `passwordHash`, `role` (USER | ADMIN)
- `fullName`, `language`, `timezone` (last two unused — see backlog)
- `accountStatus` (PENDING | ACTIVE | REJECTED)
- `mustChangePassword`
- `emailVerifiedAt`, `emailVerificationToken` (SHA-256 hash of the emailed token)
- `createdAt`, `updatedAt`

### Project ✅
- `id`, `name` (unique)
- `createdAt`, `updatedAt`
- `deletedAt`, `deletedById`, `deletedByEmail` (soft delete for recycle bin)
- `archivedAt`, `archivedById`, `archivedByEmail`, `archiveSizeBytes` (nullable — set on archive, cleared on unarchive — Phase 4)
- `archiveOperation`, `archiveOperationStartedAt` (in-progress marker)

### ProjectMembership ✅
- Composite key: `userId + projectId`
- Determines visibility and upload permission for non-admin users

### Document ✅
- `id`, `projectId`, `uploadedById`
- `originalFilename`, `mimeType`, `sizeBytes`, `storageKey`
- `status` (UPLOADED | QUEUED | PROCESSING | PROCESSED | FAILED — `QUEUED` unused until Phase 6)
- `errorMessage`, `uploadedAt`
- `deletedAt` (nullable, indexed — soft delete; excluded from every read path)

### DocumentText ✅
- One-to-one with Document
- `extractedText`, `pageCount`, `extractedAt`
- Created for PDFs and (from Phase 3) for images via OCR

### RefreshToken ✅
- `tokenHash` (Argon2 hash — never stored in plaintext)
- `expiresAt`, `revokedAt`

### FilterDefinition ⬜ (Phase 3)
- `id`, `name`, `type` (TEXT | NUMBER | DATE), `createdAt`
- Maximum 5 active per company

### DocumentFilterValue ⬜ (Phase 3)
- Composite key: `documentId + filterDefinitionId`
- `value` (string — typed on read based on definition type)

### DeletionLog ✅
- `id`, `documentId`, `projectId`, `actorId` (nullable, `SetNull` on user delete)
- `deletedAt`, `restoredAt`, `permanentlyDeletedAt`
- Denormalised context so the row stays readable after the document is purged:
  `projectName`, `originalFilename`, `storageKey` (the original active key, used to restore), `actorEmail`
- `documentId` is deliberately **not** a foreign key — the log outlives the document

### EmailVerification ⬜ (superseded)
Originally planned as a separate table. Implemented instead as two columns on `User`
(`emailVerificationToken`, `emailVerifiedAt`). A dedicated table is only needed if
tokens gain expiry, reissue, or a second purpose such as password reset — both of
which are currently missing.

---

## Document Processing Flow

```
Upload request
    → validate auth + project visibility
    → check membership (or admin)
    → create Document record (status: UPLOADED)
    → save file via BlobStore
    → update storageKey
    → set status: PROCESSING
    → if PDF: extract text (pdf-parse), save DocumentText
    → if image and OCR enabled (Phase 3): OCR, save DocumentText
    → if image and OCR not enabled: skip extraction
    → set status: PROCESSED

On any failure:
    → set status: FAILED, store errorMessage
```

---

## Storage

Files stored via `BlobStore` interface (`saveFile`, `readFile`, `createReadStream`, `writeStream`, `withLocalFile`, `exists`, `getSize`, `moveFile`, `deleteFile`).

Current implementation: `LocalBlobStore` configured via `STORAGE_ROOT` (defaults to `./data`).

### Storage key (Phase 4 layout)
```
{STORAGE_ROOT}/
  ├── active/{projectId}/{documentId}.{ext}[.gz]
  ├── archived/{projectId}.zip
  └── deleted/{projectId}/{documentId}.{ext}[.gz]    (during 30-day window)
```

Soft-deleted project archive zips reside temporarily in `deleted/{projectId}/archive.zip`.

### Compression (Phase 4)
- Files above `COMPRESSION_THRESHOLD_BYTES` (default 5MB) are evaluated for gzip compression before storage
- Compressed copy is retained only if it saves at least `COMPRESSION_MIN_SAVINGS_RATIO` (default 10%)
- The `.gz` key suffix denotes a compressed file; decompression is transparent on read

---

## Scheduled Work & Startup Recovery

`ScheduleModule` (`@nestjs/schedule`) is registered in `AppModule`.

| Task | Schedule | Behaviour |
|---|---|---|
| `PurgeTask` (recycle bin) | Daily at 03:00 | Permanently deletes documents soft-deleted more than `DELETION_RETENTION_DAYS` (30) days ago: unlinks the file, deletes the `Document` row, stamps `permanentlyDeletedAt` on the `DeletionLog`. Idempotent, guarded against overlapping runs, tolerant of missing files |
| `ArchiveService.onApplicationBootstrap` | Server startup | Recovers interrupted archive, unarchive, or delete operations that were interrupted mid-flight by inspecting `Project.archiveOperation` |

---

## Authentication & Account Lifecycle (Phase 2)

### Registration flow
1. User submits registration form
2. User created with `accountStatus: PENDING`, `emailVerifiedAt: null`
3. Notification email sent to every admin, linking to `/admin/pending`
4. Verification email sent to the user with a single-use link
5. User clicks link → `emailVerifiedAt` set, token cleared
6. Admin approves in the pending queue → `accountStatus: ACTIVE`
7. User can now log in (both must complete)

Note: approval is done in the admin console, not via a link in the email. Verification tokens currently have no stored expiry.

### Tokens
- Access token: short-lived JWT (15m), returned in response body
- Refresh token: longer-lived JWT (7d), HttpOnly cookie
- Refresh token rotation: each use issues a new pair and invalidates the previous
- Logout revokes all refresh tokens for the user
- Passwords hashed with Argon2

---

## Authorization

Enforced in the service layer, not the controller layer.

### Visibility ✅ implemented
- Document list, search, details, text, status counts, download, export: scoped to projects the user is a member of, and soft-deleted documents are excluded everywhere
- Project list (`GET /projects`): scoped to projects the user is a member of
- Admin sees everything
- Implemented as `getAccessibleProjectIds()` in `DocumentsService` and `ExportsService`, which returns `null` for admins (no restriction)

### Mutations
- Upload: admins anywhere; users only to assigned projects — ✅ implemented
- Delete: admins anywhere; users only on documents in their assigned projects — ✅ implemented (soft delete + `DeletionLog`)
- Project management (create, update, delete): admin only — ✅ implemented
- Project archive: admin only — ✅ implemented (Phase 4)
- User management (list, edit, approve, change role): admin only — ✅ implemented
- Filter management (create, edit, delete): admin only — ✅ implemented (Phase 3)
- Restore / permanent delete from recycle bin: admin only — ✅ implemented

Admin checks are currently repeated inline in each controller/service rather than via a shared `RolesGuard`. Worth consolidating.

---

## Principles

- Project-first organisation
- Project-scoped visibility (non-admins) with admin oversight
- All destructive actions logged and recoverable
- Custom fields configurable by admins
- Storage abstraction for cloud migration
- Synchronous processing now, async queue in Phase 6