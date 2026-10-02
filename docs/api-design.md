# API Design

All endpoints require `Authorization: Bearer <accessToken>` unless marked Public.

Swagger/OpenAPI is the source of truth for exact schemas — this document is a human-readable summary.

---

## Auth

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | Public | Create a `PENDING` account. Body: `email`, `password`, optional `fullName`. Returns a message only — **no tokens**. Sends verification email to the user and a notification to every admin |
| GET | `/auth/verify-email?token=` | Public | Consume the email verification token, set `emailVerifiedAt` |
| POST | `/auth/login` | Public | Login, returns access token + `mustChangePassword`, sets refresh cookie. 403 if email unverified or account not `ACTIVE` |
| POST | `/auth/refresh` | Cookie | Rotate refresh token, returns new access token |
| POST | `/auth/logout` | JWT | Revoke refresh tokens, clear cookie |
| GET | `/auth/me` | JWT | Current user (no passwordHash) |
| PATCH | `/auth/me` | JWT | Update `fullName`, `email`, `language`, `timezone`. Changing `email` returns 409 if it is already in use, otherwise clears `emailVerifiedAt` and sends a fresh verification link — the user must verify before signing in again |
| PATCH | `/auth/me/password` | JWT | Change own password. Requires `currentPassword`; revokes all refresh tokens |

### Password Policy

Applies to `POST /auth/register` and `PATCH /auth/me/password`:

- Minimum 10 characters
- At least one uppercase letter, one lowercase letter, one digit, one special character

Admin-set temporary passwords (`POST /users`, `PATCH /users/:id`) are exempt — the user is forced to change them on next login.

---

## Projects

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/projects` | JWT | List projects visible to the caller. Non-admins only see projects they are a member of; admins see all. `?scope=uploadable` is accepted and resolves identically |
| POST | `/projects` | JWT + ADMIN | Create project |
| GET | `/projects/:id` | JWT + ADMIN | Get project details + members |
| PATCH | `/projects/:id` | JWT + ADMIN | Update project name |
| DELETE | `/projects/:id` | JWT + ADMIN | Delete project and all its documents permanently |
| GET | `/projects/:id/members` | JWT + ADMIN | Get project members |
| POST | `/projects/:id/members` | JWT + ADMIN | Add user to project |
| DELETE | `/projects/:id/members/:userId` | JWT + ADMIN | Remove user from project |

### POST /projects — Body

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | ✅ | Project name (must be unique) |

### PATCH /projects/:id — Body

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | ✅ | New project name |

### POST /projects/:id/members — Body

| Field | Type | Required | Description |
|---|---|---|---|
| `userId` | string | ✅ | ID of user to add to project |

### Project Response Object (`GET /projects/:id`)

```json
{
    "id": "...",
    "name": "...",
    "createdAt": "...",
    "members": [
        {
            "userId": "...",
            "email": "...",
            "fullName": "...",
            "role": "USER | ADMIN"
        }
    ]
}
```

### Member Response Object (`GET /projects/:id/members`)

```json
[
    {
        "userId": "...",
        "email": "...",
        "fullName": "...",
        "role": "USER | ADMIN"
    }
]
```

---

## Documents

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/documents/upload` | JWT | Upload file (PDF, JPEG, PNG — no size limit). Body: `multipart/form-data` with `file` + `projectId`. Users must be a member of the project; admins may upload anywhere |
| GET | `/documents` | JWT | List documents with optional filters (see below). Capped at 50 results, no pagination |
| GET | `/documents/status-counts` | JWT | Counts grouped by status, honouring the same filters (except `status`) |
| GET | `/documents/search` | JWT | Full-text search. `?q=query` (min 2 chars, max 20 results) |
| GET | `/documents/:id` | JWT | Document metadata + 150-char text preview |
| GET | `/documents/:id/text` | JWT | Full extracted text (PDFs only — images have no extracted text until OCR is added) |
| GET | `/documents/:id/download` | JWT | Download original file |
| DELETE | `/documents/:id` | JWT | Soft delete: sets `deletedAt`, writes a `DeletionLog` row and moves the file to the `deleted/` area. Admins may delete anywhere; users only in projects they are a member of. Out-of-scope or already-deleted documents return 404 |
| POST | `/documents/bulk-delete` | JWT | Body: `{ documentIds: string[] }`. Same rules as above per document. Returns `{ deleted, failed }` |

All read endpoints are project-scoped: non-admins only see documents from projects they are a member of. Out-of-scope documents return 404, not 403. Soft-deleted documents are excluded from every read path (list, search, details, text, status counts, download and export) — only the recycle bin can see them.

### List Documents — Query Params

| Param | Type | Description |
|---|---|---|
| `projectId` | string | Filter by project |
| `mainFilter` | string | Text search across filename and extracted text |
| `supplier` | string | Text search (no dedicated column yet) |
| `materialType` | string | Text search (no dedicated column yet) |
| `quantity` | string | Text search (no dedicated column yet) |
| `orderNumber` | string | Text search (no dedicated column yet) |
| `deliveryDateFrom` | ISO date string | Applied to `uploadedAt` (no dedicated deliveryDate column yet) |
| `deliveryDateTo` | ISO date string | Applied to `uploadedAt` |
| `sortBy` | enum | `upload-newest` \| `upload-oldest` \| `name-asc` \| `name-desc` \| `status` |

---

## Exports

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/exports` | JWT | Export selected docs as ZIP. Body: `{ documentIds: string[] }`. 404 if any requested document is outside the caller's project scope |

---

## Recycle Bin

Soft-deleted documents inside the 30-day retention window. Admin only — non-admins get 403.

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/recycle-bin` | JWT + ADMIN | List soft-deleted documents with who deleted them, when, which project and days remaining |
| POST | `/recycle-bin/:id/restore` | JWT + ADMIN | Restore: clears `deletedAt`, stamps `restoredAt` on the log and moves the file back. Returns `{ id }` |
| DELETE | `/recycle-bin/:id` | JWT + ADMIN | Permanently delete before the window expires: unlinks the file, deletes the `Document` row, stamps `permanentlyDeletedAt`. The log row is kept. Returns `{ id }` |

Documents that are not soft-deleted return 404.

### Deleted Document Response Object (`GET /recycle-bin`)

```json
[
    {
        "id": "...",
        "originalFilename": "...",
        "mimeType": "application/pdf",
        "sizeBytes": 123456,
        "projectId": "...",
        "projectName": "...",
        "deletedAt": "...",
        "deletedByEmail": "...",
        "deletedByName": "...",
        "daysRemaining": 27,
        "retentionDays": 30
    }
]
```

Documents left in the recycle bin longer than `retentionDays` (30) are permanently deleted by a scheduled task that runs daily at 03:00. The `DeletionLog` row always survives, so the audit trail stays complete.

---

## Users

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/users` | JWT + ADMIN | List all users |
| GET | `/users/search?q=` | JWT + ADMIN | Search by name or email (max 50) |
| GET | `/users/pending` | JWT + ADMIN | Registrations awaiting approval |
| GET | `/users/rejected` | JWT + ADMIN | Rejected registrations |
| GET | `/users/:id` | JWT | Fetch single user. Admins can fetch anyone; users can only fetch their own (403 otherwise) |
| POST | `/users` | JWT + ADMIN | Create user with temporary password. Account is `ACTIVE` immediately with `mustChangePassword: true` |
| PATCH | `/users/:id` | JWT + ADMIN | Edit `fullName`, `email`, and/or set a new temporary password |
| PATCH | `/users/:id/status` | JWT + ADMIN | Approve or reject a registration |
| POST | `/users/:id/role` | JWT + ADMIN | Set user role |
| DELETE | `/users/:id` | JWT + ADMIN | Delete user (204). Cascades to memberships, refresh tokens and uploaded documents |

### POST /users — Body

| Field | Type | Required | Description |
|---|---|---|---|
| `email` | string | ✅ | User email address |
| `password` | string | ✅ | Temporary password, user must change on first login |
| `fullName` | string | ✅ | Display name |
| `role` | `USER` \| `ADMIN` | ✅ | Assigned role |

### PATCH /users/:id — Body

| Field | Type | Required | Description |
|---|---|---|---|
| `fullName` | string | — | New display name |
| `email` | string | — | New email (409 if already in use) |
| `password` | string | — | New temporary password, min 8 chars, sets `mustChangePassword` |

### PATCH /users/:id/status — Body

| Field | Type | Required | Description |
|---|---|---|---|
| `status` | `PENDING` \| `ACTIVE` \| `REJECTED` | ✅ | New account status |

### POST /users/:id/role — Body

| Field | Type | Required | Description |
|---|---|---|---|
| `role` | `USER` \| `ADMIN` | ✅ | New role to assign |

### User Response Object

All endpoints return the same user shape (no passwordHash):

| Field | Type |
|---|---|
| `id` | string |
| `email` | string |
| `fullName` | string |
| `role` | `USER` \| `ADMIN` |
| `accountStatus` | `PENDING` \| `ACTIVE` \| `REJECTED` |
| `createdAt` | ISO date string |

---

## Archive Endpoints (Phase 4 — Admin Only)

### `GET /archive`
Lists all archived projects.
- **Response `200`**: `ArchivedProjectSummary[]`
  - `id`: string
  - `name`: string
  - `archivedAt`: ISO date string
  - `archivedByEmail`: string | null
  - `archivedByName`: string | null
  - `archiveSizeBytes`: number
  - `documentCount`: number
  - `memberCount`: number
  - `operation`: `'ARCHIVING' | 'UNARCHIVING' | 'DELETING' | null`

### `POST /archive/:id`
Archives an active project into a zip file.
- **Response `200`**: `ArchiveProjectResult`
  - `id`: string
  - `name`: string
  - `archivedAt`: ISO date string
  - `archiveSizeBytes`: number
  - `documentCount`: number
  - `missingDocuments`: `Array<{ id: string, originalFilename: string }>`
- **Errors**: `403` (Forbidden), `404` (Project not found), `409` (Already archived / in-progress / conflict)

### `POST /archive/:id/restore`
Extracts and restores an archived project back to active status.
- **Response `200`**: `UnarchiveProjectResult`
  - `id`: string
  - `restoredDocuments`: number
  - `missingDocuments`: `Array<{ id: string, originalFilename: string }>`
- **Errors**: `403` (Forbidden), `404` (Not found), `409` (Conflict)

### `GET /archive/:id/download`
Streams the raw archive zip file without unarchiving.
- **Response `200`**: `application/zip` stream with `Content-Disposition: attachment; filename="<name>-archive.zip"` and `Content-Length`.
- **Errors**: `403` (Forbidden), `404` (Not found), `409` (Conflict)

### `DELETE /archive/:id`
Moves an archived project and its documents into the recycle bin (30-day recovery window).
- **Response `200`**: `{ id: string }`
- **Errors**: `403` (Forbidden), `404` (Not found), `409` (Conflict)

---

## Recycle Bin Field Extensions (Phase 4)

- `GET /recycle-bin/projects`: response objects include `isArchived: boolean`.
- `GET /recycle-bin` & `GET /recycle-bin/projects/:id/documents`: document objects include `restorable: boolean` (false for zip-backed documents) and `requiresProjectChoice: boolean`.
- `POST /recycle-bin/projects/:id/restore`: response includes `restoredTo: 'ACTIVE' | 'ARCHIVE'`.

---

## Not Yet Implemented

- `GET /jobs/:id` — job status (Phase 6)