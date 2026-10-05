# Backlog

Potential additions and improvements for future consideration.

---

## To Confirm With Stakeholder

- Project-scoped visibility (non-admins see only assigned projects) — **implemented in code**, still needs explicit sign-off
- ~~Custom filters: available to all users vs creator-only~~ — **decided and implemented**: available to all users once created (`GET /filters` requires only authentication); only admins can create/edit/delete
- ~~Compression threshold (suggested 5MB)~~ — **decided and implemented**: 5MB threshold (`COMPRESSION_THRESHOLD_BYTES`) and 10% minimum savings ratio (`COMPRESSION_MIN_SAVINGS_RATIO`), both configurable via environment
- ~~Password policy specifics~~ — **decided and implemented**: min 10 chars, one uppercase, one lowercase, one digit, one special character
- Upload size limit: Phase 2 calls for removing the 50MB cap entirely — confirm there should be no ceiling at all before removing it
- Storage usage indicator in the sidebar — only if the stakeholder asks for it

---

## Resolved

### Force Password Reset on First Login — done
`mustChangePassword` exists on `User`, is set by `POST /users` and by an admin-set password via `PATCH /users/:id`, is returned from `POST /auth/login`, and the client routes to `/change-password`. Cleared on successful password change.

### Language and Timezone Fields — still open
Remove `language` and `timezone` from the `User` schema. Stakeholder confirmed a single language is needed — these fields remain writable via `PATCH /auth/me` but are never read anywhere.

---

## Email Verification Token Expiry

The verification email states the link is valid for 24 hours, but no expiry is stored or checked — `emailVerificationToken` is a bare hash column on `User`. Either add an `emailVerificationExpiresAt` column, or promote this to the originally planned `EmailVerification` table if password-reset tokens are also needed.

---

## Full Name on Self-Registration

The Register page renders a full-name input, but `handleSubmit` only sends email and password and `UsersService.create` hard-codes `fullName: ''`. Either send it through `RegisterDto` or remove the field from the form.

---

## Consolidate Admin Role Checks

Every admin-only handler repeats an inline `req.user?.role !== 'ADMIN'` check, and `UsersController` throws `BadRequestException` in some places and `ForbiddenException` in others for the same condition. A shared `@Roles('ADMIN')` decorator plus `RolesGuard` would remove the duplication and make the responses consistent.

---

## Search Scalability

`searchDocuments` loads every accessible document with extracted text into memory before filtering in JavaScript. `listDocuments` is capped at 50 rows with no pagination. Both need a SQL-side rewrite (SQLite FTS5, or Postgres full-text if the database moves) before real data volumes.

---

## Refresh Token Lookup

`AuthService.refresh` finds the most recent non-revoked token for the user and verifies the presented token against it, rather than looking up the presented token directly. Signing in on a second device therefore invalidates the first device's refresh token. Store a lookup-friendly hash and match on it.

---

## Print Document Button

Add a print button in the document actions section, with a preview. Low priority — included in Phase 5 if time allows, otherwise moves here.

---

## GET /projects/:id

Implemented in `ProjectsService.getProject`. Kept in the backlog only as a note that the admin console currently uses `GET /projects` plus `GET /projects/:id/members` instead.

---

## Project Creator Auto-Membership

`POST /projects` creates a project with zero members. Consider auto-adding the creating admin, or making it explicit in the UI that members must be added before the project is usable.

---

## Restrict Self-Registration

`POST /auth/register` is public, but accounts now land in `PENDING` and require both email verification and admin approval, so the exposure is limited. Optionally disable the endpoint entirely for closed-deployment customers.

---

## Email Attachment Ingestion

Forward an email with attachments to a project-specific address; attachments uploaded automatically. Phase 7.

---

## Offline-Friendly Viewing

Cache recently viewed documents for offline access. Phase 7.

---

## Native App for All Platforms

Single app for laptop, tablet, and phone. To be evaluated after web is stable. Phase 7.

---

## Storage Limits per User or Project

Originally considered but removed — stakeholder confirmed no upload quotas. Could be reintroduced if cloud costs become a concern.

---

## Permanent Project Deletion Cascade

Permanent deletion (after 30-day window or via admin override) cascades:
- All documents permanently removed
- All deletion logs retained
- ProjectMembership rows removed
- DocumentFilterValue rows removed

---

## Retry Processing Endpoint

An endpoint to re-run text extraction for a FAILED document. The Documents table's "Retry" action is wired to a `TODO(backend)` handler.

---

## Register PDF Export

An endpoint that renders the filtered document register as a PDF. "Generate register PDF" in the Documents export menu is a `TODO(backend)` handler.

---

## Custom Filter Values as Table Columns

Show custom filter values as optional columns in the Documents table.

---

## Document List Pagination

`GET /documents` is capped at 50 rows. The page says "Showing the first 50 documents — narrow with filters". Add pagination or infinite scroll.

---

## Password Reset Flow

There's no "forgot password" flow. The link was removed from the sign-in page because it did nothing.

---

## User Deletion Cascades to Uploaded Documents

`Document.uploadedBy` uses `onDelete: Cascade`, so deleting a user permanently deletes every document they uploaded, with no recycle bin and no deletion log. The UI warns about it. Likely fix: make `uploadedById` nullable with `onDelete: SetNull`, or deactivate users instead of deleting them.

---

## Project and Uploader on GET /documents/:id

The endpoint returns neither `projectName` nor `uploadedByEmail`, so the Search drawer can't show them (they're only on list rows).

---

## Escape Search Snippets Server-Side

`searchDocuments` wraps unescaped file names and text in `<mark>` tags. The client now renders them safely, but the API should HTML-escape the text around the tags.

---

## Protect Admin Accounts From Deletion

`DELETE /users/:id` lets an admin delete their own account or the last admin. Reject both.
