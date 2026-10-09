# Project plan

A multi-user document indexing and retrieval tool for construction teams. For setup and the API, see the [README](../README.md).

## Current position

Phases 1 to 4.5 and the UI redesign are complete. **Phase 5 is next.** Phases 6 and 7 are not started, and the Jobs section is hidden until Phase 6.

## Goal and product rules

Replace manual document lookup with a shared, searchable, project-based store, for procurement, managers and quantity surveyors.

- Documents belong to projects. Non-admins only see documents from projects they are members of, and admins see everything.
- Every document deletion is logged and recoverable for 30 days.
- Self-registration needs email verification and admin approval.
- `uploadedByEmail` and `uploadedByName` are stored on each document for traceability, and survive the uploader's account being deleted.

Project-scoped visibility replaced an earlier company-wide model. It is implemented, but the stakeholder hasn't formally signed it off (also in the [backlog](BACKLOG.md)).

## Completed phases

**Phase 1: core MVP.** JWT authentication with rotating refresh tokens, USER and ADMIN roles, projects with memberships, PDF and image upload with PDF text extraction, status tracking, filtered and sorted document list, full-text search with snippets, download, ZIP export, and the `BlobStore` storage abstraction.

**Phase 2: access, admin console and auditability.** The admin console (projects, members, users, pending requests, recycle bin), project-scoped visibility on every read path, the registration lifecycle (email verification plus admin approval, password policy), self-service profile and password changes, soft delete with a deletion log, a 30-day recycle bin and a nightly purge. Project members can delete in their own projects.

**Phase 3: custom filters and search.** Up to five admin-defined filter fields (text, number or date) entered at upload and usable on the document list, combined with keyword search. Images are OCR'd with `tesseract.js`, so they are searchable like PDFs.

**Phase 4: project archive and storage structure.** Admins archive a project into a verified zip with a manifest, download it, restore it, or delete it through the recycle bin. Storage uses a per-project layout (`active/`, `archived/`, `deleted/`), large files are gzipped when it saves enough space, and `npm run storage:migrate` moved legacy files to the new layout.

**UI redesign.** A spreadsheet-style design system: role-based Tailwind tokens, a shared component library in `client/src/components/ui/`, a new app shell, and restyled documents, search, upload, jobs, sign-in and admin screens. The rules are in `.github/copilot-instructions.md`.

**Phase 4.5: pilot readiness.**

- Accounts: deleting a user keeps their documents. Non-active accounts are refused on every request and refresh. Admins can't delete, demote or deactivate themselves, or remove the last active admin. Admin-created users count as verified. Emails are matched case-insensitively. Refresh tokens are looked up by session id (`jti`), and a password change keeps the current browser signed in.
- Hardening: validated configuration, security headers with a content security policy, production-only CORS, rate limits, a configurable upload limit with a file content check, and safe download filenames.
- Operations: `start:render` restores a requested backup then migrates and starts, nightly and start-up database backups, and the [deployment guide](deploy.md).
- Client: silent session refresh, admin route guards, and saving downloads to a chosen folder.

## Phase 5: deployment

Status: **not started.** SMTP, environment validation and nightly database backups were delivered earlier.

| Item | Notes |
|---|---|
| OneDrive storage | Add a `BlobStore` implementation to replace `LocalBlobStore`. The interface has `saveFile`, `readFile`, `createReadStream`, `writeStream`, `withLocalFile`, `exists`, `getSize`, `moveFile` and `deleteFile`. The `active/`, `archived/` and `deleted/` key layout should carry over unchanged. |
| Automatic offsite backups | Backups currently stay on the persistent disk, and copying them off is manual ([deploy guide](deploy.md)). Copy them to separate storage automatically. |
| Structured logging | Only Nest's default `Logger` is used today. |
| HTTPS | Confirm and document HTTPS for the production domain. |
| Print button | Optional: print a document with a preview, if time allows. |

Carry-over from the [backlog](BACKLOG.md) worth doing alongside: expire and resend email verification links.

## Phase 6: async processing

Status: **not started.** Queue-based extraction (PDF and OCR), compression and archive jobs, retries, job status endpoints, and a real Jobs page. The `QUEUED` status exists but is never set, because extraction runs inside the upload request.

## Phase 7: future

Status: **not started.** Native app evaluation, email attachment ingestion, offline viewing.

## Known technical notes

- **Visibility and 404s:** out-of-scope documents return 404, not 403, so their existence isn't revealed. Access is resolved by `getAccessibleProjectIds` in the documents and exports services, which returns `null` for admins.
- **Admin checks:** controllers repeat an inline `role !== 'ADMIN'` check rather than using a shared guard.
- **Temporary passwords:** `POST /users` has no password policy and `PATCH /users/:id` only needs 8 characters. This is deliberate, because the user must change it at first sign-in.
- **Email verification:** the emailed link says it is valid for 24 hours, but no expiry is stored and there is no resend. The hashed token lives on `User`.
- **Approval:** admins approve in `/admin/pending`. The admin email is only a notification.
- **Search:** `searchDocuments` loads every accessible document with text into memory and filters in JavaScript, and returns at most 20 results. `GET /documents` returns at most 50 rows with no pagination.
- **Custom filters:** changing a filter's type discards values already entered for it. There is no way to edit a document's filter values after upload.
- **Unused fields:** `User.language` and `User.timezone` are writable through `PATCH /auth/me` but never read.
- **New projects** have no members until an admin adds some.
- **Jobs:** the sidebar link shows a toast, and `/jobs` redirects to the documents list. The sample-data page and its components stay in `client/src/pages/Jobs.tsx` and `client/src/components/jobs/` for Phase 6.
- **Live status:** upload processing (PDF text and OCR) runs inside the upload request, so a document is `PROCESSED` or `FAILED` when the upload returns. The Documents page still polls every 5 seconds while any listed document is in progress, for example one uploaded by someone else or left behind by a restart, and stops after 10 minutes.
- **Deleted projects:** the recycle bin's Documents tab lists every deleted document, with a "Project deleted" badge on those removed with their project. Documents of a deleted archived project live only in the archive zip, so they appear only when you open that project.
- **Single instance:** rate limits are in memory and the purge and backup jobs run in-process, so the API must run as one instance.
- **Placeholders waiting for the backend:** Retry on failed documents, Generate register PDF in the export menu, and Download, Delete and Retry in the unrouted Jobs page. Each is a `TODO(backend)` handler that does nothing.
- **PDF parsing:** `pdf-parse` 1.1.1 can throw spurious errors on some valid PDFs, which marks the upload `FAILED`. Consider a replacement.
- **OCR:** `tesseract.js` needs an explicit `errorHandler`, otherwise a worker failure can crash the Node process. `ExtractionService` passes a no-op handler and treats OCR failures per document. The English language data is downloaded on first use.
- **Archive recovery:** on start-up `ArchiveService` finishes any archive, restore or delete operation interrupted by a restart, using `Project.archiveOperation`.
- **Database copies don't include files:** a restored database won't list files uploaded after the backup, though they remain on disk.
