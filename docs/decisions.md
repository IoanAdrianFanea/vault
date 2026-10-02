# Technical Decisions

Key decisions made during development, with rationale.

---

## Project-Scoped Visibility

Non-admin users see only documents from projects they are assigned to. Admins see everything.

Rationale: stakeholder requirement. Initially the system was company-wide visible, but feedback indicated users should not see documents from projects they have no involvement in. Admins retain full visibility for oversight and management.

Note: this reverses the earlier "Shared Company Document Model" decision.

Status: **implemented** in `DocumentsService` and `ExportsService` via `getAccessibleProjectIds()`, which returns `null` for admins (no restriction) and the user's membership project IDs otherwise. Out-of-scope documents return 404 rather than 403 so that scope is not leaked. Still pending explicit stakeholder sign-off.

---

## Project-First Organisation

Projects are the primary organising entity. Documents belong to projects.

Rationale: the business already organises documents by project. Visibility, archive, and storage structure all align around projects.

---

## Role-Based Authorization

Two roles: USER and ADMIN.

- Users can upload, search, download, and export within their assigned projects
- Admins can do all of that anywhere, plus manage projects, users, custom filters, archive, and recycle bin

Rationale: simpler than per-action permissions. The combination of role + project membership covers every access need so far.

---

## Self-Registration with Admin Approval

Users self-register, but accounts are `PENDING` until admin approves. Email verification is also required.

Rationale: an internal company tool can't accept open sign-ups. Admin approval prevents unauthorised access. Email verification prevents typos and confirms the user controls the address.

Status: **implemented**. Approval happens in the `/admin/pending` console queue rather than through a link in the admin email — a link would need a signed, single-use, admin-authenticated token, and the console already provides the review context. The admin email is therefore a notification, not an action.

---

## Email Verification Stored on User, Not a Separate Table

The SHA-256 hash of the emailed token lives in `User.emailVerificationToken`, cleared on use, with `User.emailVerifiedAt` recording the outcome.

Rationale: a single-purpose, single-use token did not justify a separate table. This should be revisited if token expiry, resend, or password-reset tokens are added — at that point the originally planned `EmailVerification` table becomes the better shape.

---

## Argon2 for Refresh Token Hashes

Refresh tokens are hashed with Argon2 before storage; verification tokens use SHA-256.

Rationale: refresh tokens are long-lived credentials and deserve a slow hash. Verification tokens are 32 bytes of cryptographic randomness with no entropy to brute-force, so a fast digest is sufficient and keeps the lookup a simple indexed match.

---

## Temporary Passwords Are Exempt From the Password Policy

`POST /users` and the password field of `PATCH /users/:id` do not enforce the strong-password rules — only a minimum length.

Rationale: these are single-use credentials handed to a user out of band, and `mustChangePassword` forces a policy-compliant password on first login. Requiring an admin to invent a complex throwaway password adds friction with no security benefit.

---

## Admin-Controlled Destructive Actions

Project deletion, user role changes, archive, permanent delete from recycle bin, and filter management are admin-only.

Rationale: these actions affect other users' work. Centralising them under admin oversight reduces the chance of accidental loss.

---

## Soft Delete with 30-Day Recovery

Deleted documents are not removed immediately. They are marked deleted, logged, and moved to a `deleted/` storage location. After 30 days they are permanently removed.

Rationale: deletion mistakes happen. A 30-day window lets admins restore accidentally deleted files without needing backups. Logging provides audit history.

Status: **implemented** (Phase 2 & Phase 4). Deletions move files to `deleted/`, create `DeletionLog` entries, and are recoverable for 30 days.

---

## Project Archive with Zip Storage

When a project is archived, all files are zipped. The project becomes inaccessible from main views (including for admins) and is read-only, but the zip is downloadable. Unarchive extracts the zip and restores the original structure.

Deleting an archived project routes through the 30-day recycle bin rather than immediate purge; restoring an archived project returns it to the archive.

Rationale: completed projects don't need to clutter the working view. Zipping reduces storage and signals immutability. Reversibility matters because work sometimes resumes on "completed" projects. Preserving the 30-day recycle bin window adheres to the core principle that all destructive operations are recoverable.

---

## Custom Filters

Admins define up to 5 custom filter fields. These become metadata fields on documents and search/filter options for users.

Rationale: every construction firm uses different metadata (supplier, order number, material grade, etc.) and auto-extracting from raw PDF text is unreliable. A simple admin-defined schema lets each company configure what matters to them without code changes.

---

## Search and Filter Combined

Search and filters apply together, not separately. Users can pre-filter and then search, or search and then narrow with filters.

Rationale: the use case is "find this exact document" not "browse." Combining the two is essential for that.

---

## OCR Pulled Forward to Phase 3

Images need OCR to be searchable. Originally Phase 5, now in Phase 3 alongside custom filters and search work.

Rationale: site photos and scanned delivery notes are common. Without OCR, image-based documents are effectively invisible to search.

---

## File Compression Above a Threshold

Files larger than 5MB (`COMPRESSION_THRESHOLD_BYTES`) are evaluated for gzip compression before storage. The compressed version is retained only if it saves at least 10% (`COMPRESSION_MIN_SAVINGS_RATIO`). Decompression is transparent to consumers via the `BlobStore` interface, indicated by a `.gz` key suffix.

Rationale: reduces cloud/disk storage costs. Compressing small files saves negligible space while adding processing overhead — only worth doing above a threshold when meaningful compression is achieved.

---

## Storage Folder Structure Configurable via Environment

Storage is organised under `STORAGE_ROOT` (defaults to `./data`), with subfolders for `active/`, `archived/`, and `deleted/`.

Rationale: gives the admin a coherent view of all files outside the app. Reflects the access model directly: active projects are visible, archived projects are zipped, deleted files wait in a holding area. Local structure maps 1:1 onto future OneDrive storage.

---

## Synchronous Processing First, Async Later

Text extraction runs synchronously on upload. No queue or worker yet.

Rationale: simpler to build and debug. A queue-based pipeline is planned for Phase 6 when scale or processing time demands it.

---

## SQLite for Development

SQLite via Prisma for the current phase.

Rationale: zero infrastructure, fast iteration. Prisma abstracts the database layer, so migration to Postgres is straightforward later if needed.

---

## Storage Abstraction

Files stored behind a `BlobStore` interface. Current implementation is `LocalBlobStore`. OneDrive implementation in Phase 5.

Rationale: keeps business logic storage-agnostic. Migrating to cloud storage doesn't touch service code.

---

## Web-First Delivery

The current frontend is a browser web app. Native app for all platforms (single app — laptop, tablet, phone) planned for Phase 7.

Rationale: fastest way to validate workflows. Once web is stable enough, a single cross-platform native app will replace the laptop web + native phone hybrid that was initially considered.

---

## No Tags

Tags were removed during the Phase 0.5 refactor. Projects and custom filters cover the organising and grouping needs.

---

## Two User Creation Methods (create vs createUser)

`UsersService` has two creation methods intentionally:

- `create(email, passwordHash, emailVerificationToken)` — used by auth during self-registration. Auth service hashes the password and generates the verification token before calling this. Resulting account is `PENDING`.
- `createUser(dto)` — used by the admin endpoint. Accepts a plain password and hashes it internally. Resulting account is `ACTIVE` with `mustChangePassword: true`.

They serve different callers with different contracts. Kept separate for clarity.