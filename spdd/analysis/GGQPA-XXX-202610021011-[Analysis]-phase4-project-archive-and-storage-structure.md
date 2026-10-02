# SPDD Analysis: Phase 4 – Project Archive & Storage Structure

## Original Business Requirement

> Source file: `spdd/requirements/phase4-archive.md` (reproduced verbatim below)

# Phase 4 – Archive & Storage Structure

> Consolidated on 2026-10-02 from the existing project documentation. Every "Source" section below is quoted verbatim from the named file. The Acceptance Criteria at the end are derived one-to-one from those quoted statements and introduce no new scope.

---

## Source: `docs/project-plan.md` — Phase 4 – Archive & Storage Structure

Status: **not started** — UI mock exists

The `/admin/archive` page and `ArchiveProjectModal` exist but are presentational only — the modal has no confirm handler and the page renders hard-coded rows. `Project` has no `archivedAt` column.

### Project Archive
- Admin can archive a project from the project management page
- On archive: all project files zipped, `archivedAt` set
- On unarchive: zip extracted, files restored to original structure, `archivedAt` cleared
- Dedicated archive page lists archived projects
- Admin can download zip without unarchiving
- Admin can permanently delete archived projects

### OneDrive Storage Structure
- Root folder configurable by admin
- Inside root:
  - `active/` — folder per project containing live files
  - `archived/` — zip per archived project
  - `deleted/` — folder per project containing soft-deleted files (during 30-day window)

### File Compression
- Large files compressed before storage (threshold to be defined, suggested 5MB+)
- Compression applied where it reduces size meaningfully (PDFs and JPEGs are already compressed, may skip)

---

## Source: `docs/project-plan.md` — Immediate Next Steps (to open Phase 4)

1. Add `archivedAt` to `Project` and design the OneDrive-style `active/` / `archived/` / `deleted/` storage layout.
2. Wire up `ArchiveProjectModal`'s confirm handler and turn `/admin/archive` into a real page (archive, unarchive, download zip, permanent delete).
3. Implement zip-on-archive / extract-on-unarchive against the storage abstraction (`BlobStore`).
4. Add file compression for large files above the chosen threshold.

(Item 5 of that list — backlog carry-over — is out of scope for this requirement.)

---

## Source: `docs/system-design.md` — Archive Flow (Phase 4)

### Archive
1. Admin opens project management page
2. Selects "Archive" on a project
3. All files in the project zipped into `archived/{projectId}.zip`
4. `archivedAt` set on the project
5. Project hidden from main views; appears in archive page

### Unarchive
1. Admin opens archive page
2. Selects "Unarchive" on a project
3. Zip extracted, files restored to `active/{projectId}/`
4. `archivedAt` cleared
5. Project re-appears in main views

### Download (without unarchive)
1. Admin downloads zip directly from archive page
2. Project remains archived

### Permanent delete
1. Admin can permanently delete an archived project
2. Zip removed from storage
3. Database records purged

---

## Source: `docs/architecture.md` — Storage (Phase 4)

### Storage key (Phase 4 — OneDrive)
```
{root}/
  ├── active/{projectId}/{documentId}.{ext}
  ├── archived/{projectId}.zip
  └── deleted/{projectId}/{documentId}.{ext}    (during 30-day window)
```

### Compression (Phase 4)
- Files above threshold (suggested 5MB+) compressed before storage
- Skip compression if file is already compressed (PDF, JPEG)

Authorization — Mutations:
- Project archive: admin only — ⬜ Phase 4

---

## Source: `docs/decisions.md`

### Project Archive with Zip Storage

When a project is archived, all files are zipped. The project becomes inaccessible from main views but the zip is downloadable. Unarchive extracts the zip and restores the original structure.

Rationale: completed projects don't need to clutter the working view. Zipping reduces storage and signals immutability. Reversibility matters because work sometimes resumes on "completed" projects.

### File Compression Above a Threshold

Large files are compressed before storage. Threshold tentatively set at 5MB. PDFs and JPEGs may be skipped as they are already compressed.

Rationale: reduces cloud storage costs. Compressing small files saves negligible space while adding processing overhead — only worth doing above a threshold.

### OneDrive Folder Structure

Storage is organised under a configurable root folder, with subfolders for `active`, `archived`, and `deleted`.

Rationale: gives the admin a coherent view of all files outside the app. Reflects the access model directly: active projects are visible, archived projects are zipped, deleted files wait in a holding area.

### Admin-Controlled Destructive Actions

Project deletion, user role changes, archive, permanent delete from recycle bin, and filter management are admin-only.

---

## Source: `docs/BACKLOG.md`

- Compression threshold (suggested 5MB) — needs concrete number

### Permanent Project Deletion Cascade

Permanent deletion (after 30-day window or via admin override) cascades:
- All documents permanently removed
- All deletion logs retained
- ProjectMembership rows removed
- DocumentFilterValue rows removed

---

## Source: `client/src/components/admin/ArchiveProjectModal.tsx` (confirmation copy)

> "{projectName}" will be archived and hidden from active views. Members will lose access until the project is restored.

---

## Acceptance Criteria (derived)

| AC# | Criterion | Source |
|-----|-----------|--------|
| 1 | Admin can archive a project from the project management page. | project-plan, system-design |
| 2 | On archive, all of the project's files are zipped into `archived/{projectId}.zip` and `archivedAt` is set on the project. | project-plan, system-design |
| 3 | An archived project is hidden from main views and appears on the archive page; members lose access until the project is restored. | system-design, decisions, ArchiveProjectModal |
| 4 | On unarchive, the zip is extracted, files are restored to their original structure (`active/{projectId}/`), `archivedAt` is cleared, and the project re-appears in main views. | project-plan, system-design |
| 5 | A dedicated archive page lists archived projects. | project-plan |
| 6 | Admin can download an archived project's zip without unarchiving it; the project remains archived. | project-plan, system-design |
| 7 | Admin can permanently delete an archived project: the zip is removed from storage and its database records are purged. | project-plan, system-design, BACKLOG |
| 8 | The storage root folder is configurable by admin. | project-plan, decisions |
| 9 | Inside the root, live files are held in `active/` with one folder per project. | project-plan, architecture |
| 10 | Inside the root, each archived project is held in `archived/` as a single zip. | project-plan, architecture |
| 11 | Inside the root, soft-deleted files are held in `deleted/` with one folder per project during the 30-day window. | project-plan, architecture |
| 12 | Large files (threshold to be defined, suggested 5MB+) are compressed before storage. | project-plan, decisions, BACKLOG |
| 13 | Compression is only applied where it reduces size meaningfully; already-compressed formats (PDF, JPEG) may be skipped. | project-plan, decisions, architecture |

---

## Domain Concept Identification

> Project type: **fullstack** — NestJS 11 + Prisma 7 (SQLite via `better-sqlite3` adapter) API in `server/`, React + Vite admin/user SPA in `client/`. Modular monolith, controller → service → Prisma layering, authorization enforced in services/controllers with inline role checks.

### Existing Concepts (from codebase)

- **Project**: the primary organising entity and the unit being archived. It already has a full *soft-delete* lifecycle in code (`deletedAt`, `deletedById`, `deletedByEmail`, indexed `deletedAt`, migration `20260817160512_add_project_soft_delete`) driven by `ProjectsService.deleteProject`, which sweeps every active document into the recycle bin with a shared timestamp. Archive becomes a **second, parallel lifecycle state** on the same entity. `name` is globally unique, including for soft-deleted rows.
- **ProjectMembership**: the sole source of non-admin visibility and upload rights. Cascades on project delete. Must survive archive untouched so that access returns automatically on unarchive ("Members will lose access until the project is restored").
- **Document**: belongs to exactly one project; carries `storageKey` (opaque per-document pointer to its blob, currently `{userId}/{documentId}.{ext}`), `mimeType`, `sizeBytes`, `status`, `deletedAt`. Every read path (list, search, details, text, status counts, download, export) filters on `Document.deletedAt` only — **none consider the parent project's state**. Admins bypass project scoping entirely (`getAccessibleProjectIds` returns `null`).
- **DocumentText / DocumentFilterValue**: derived text (PDF extraction, OCR) and admin-defined metadata hanging off a document; both cascade with the document. They are the expensive-to-recreate parts of a document and are what make an archived project searchable again on unarchive.
- **DeletionLog**: append-only audit trail; `documentId` is a plain string (survives purge); denormalises project name, filename, actor email and the **original active `storageKey`** used to restore. Directly affected by any storage-key layout change and by permanent deletion of archived projects.
- **Recycle Bin** (`RecycleBinService`, `RecycleBinController`, `PurgeTask`): owns restore/permanent-delete/30-day purge for documents *and* projects. Established patterns: claim-first conditional updates/deletes for concurrency, tolerate missing blobs (log and continue), admin-only. Restore can relocate a document into a different project (`targetProjectId`) and validates the destination only against `deletedAt`.
- **Deletion key convention** (`common/deletion.constants.ts`): derives the soft-deleted key by *prepending* `deleted/` and the active key by stripping it. Used by `DocumentsService.deleteDocument`, `ProjectsService.deleteProject`, and `RecycleBinService` restore/purge — four call sites coupled to today's key shape.
- **BlobStore / LocalBlobStore** (`StorageModule`, `BLOB_STORE` token): the storage abstraction. Root is hard-coded to `./data`; keys are uploader-scoped (`saveFile(userId, documentId, …)`); `getFile` assumes the user-scoped layout and is unused; `getPath` leaks a local filesystem path that `ExportsService` (download + export) and `ExtractionService` (pdf-parse, tesseract) read directly. `moveFile` already handles cross-device moves.
- **Export ZIP** (`ExportsService.exportDocuments`): existing precedent for building ZIPs with `archiver` (streaming, entries named by original filename with no de-duplication, missing files skipped silently, whole files read into memory). There is no zip-*reading* capability in the dependency set.
- **Admin console UI**: `AdminProjects` already opens `ArchiveProjectModal` (no confirm handler, no API call); `AdminArchive` at `/admin/archive` (behind `AdminGuard`, linked from `AdminTabs`) is a static mock showing project name, ID, archived date **and actor**, **file size**, Download / Restore / Delete Permanently actions, a search box, a filter button and pagination. `client/src/api/projects.ts` holds the project fetch helpers; `AdminRecycleBin` is the closest real-page precedent.
- **Scheduled work**: `ScheduleModule` + single in-process `PurgeTask` (03:00 daily) — the only background execution mechanism; no job queue exists (Phase 6).

### New Concepts Required

- **Archived Project state** (`archivedAt` + archiving actor): a lifecycle state mirroring the existing `deletedAt / deletedById / deletedByEmail` trio so the archive page can show "archived on … by …" as the mock does. `archivedAt` **stays set while an archived project sits in the recycle bin**. That is what lets a recycle-bin restore return it to Archived rather than Active (Q1). This is the only archive audit state: there is no separate history table (Q7).
- **Zip-backed deleted project**: a soft-deleted project whose files are a single zip in its `deleted/` folder, not per-document blobs. The recycle bin has to recognise it for restore (zip goes back to `archived/`), purge (zip removed) and drill-down (per-document restore is not possible).
- **Project Archive artifact**: the single zip per archived project in `archived/`, which becomes the *only* holder of the project's live files while archived. Has a stored size (shown on the archive page) and must be **self-describing** (a manifest linking each entry back to its document) so unarchive can restore the original structure without relying on filenames.
- **Archive operation-in-progress marker**: a persisted indication that an archive, unarchive or archived-project delete is under way, so concurrent actions (upload, document delete, project delete, recycle-bin restore into the project, a second click) are refused and a crash mid-operation is detectable and recoverable.
- **Storage Layout** (root set by an environment variable read at startup, plus `active/{projectId}/`, `archived/{projectId}.zip`, `deleted/{projectId}/`): replaces the uploader-scoped layout on local disk only, mapping 1:1 onto OneDrive in Phase 5 (Q2, Q10). It comes with a **single key-derivation rule** shared by documents, projects, recycle bin and archive (successor to the prefix logic in `deletion.constants`).
- **Storage Layout Migration**: a one-off, idempotent script that converts existing blobs and persisted keys (`Document.storageKey`, open `DeletionLog.storageKey` rows) from `{userId}/…` / `deleted/{userId}/…` to the project layout (Q11).
- **Stored-blob compression marker**: per-document knowledge of whether its stored blob is compressed, and of stored vs original size, so every reader transparently gets the original bytes and `sizeBytes` keeps meaning "original file size". Policy: files above 5MB are compressed losslessly, and the compressed copy is kept only if it saves at least 10%. Both values are configurable (Q3).
- **Archive module** (server) and **archive API client** (client): `docs/architecture.md` already reserves "Archive module ⬜ planned (Phase 4)".

### Key Business Rules

- **Admin-only operations**: archive, unarchive, list archived, download the archive zip, and delete an archived project (to the recycle bin). Governs Project, Project Archive.
- **Project lifecycle** *(implicit, set by Q1)*: a project is in one of four states: Active, Archived, Deleted-from-Active, or Deleted-from-Archived. Archive is allowed only from Active, and unarchive only from Archived (never while it is in the recycle bin). Deleting an Active project keeps today's behaviour: its documents are swept into `deleted/{projectId}/`. Deleting an Archived project moves its zip into `deleted/{projectId}/` and puts the project in the recycle bin. Restoring it within 30 days returns it to **Archived**: the zip goes back to `archived/` and the project stays hidden. Purge (after 30 days, or a recycle-bin permanent delete) removes the zip and the DB rows. Governs Project, Project Archive, Recycle Bin.
- **Archived means invisible in every main view, for everyone including admins** *(explicit "hidden from main views"; confirmed for admins by Q4)*: archived projects are left out of the project list (all scopes), document list, search, details, text, status counts, download, export, upload targets, membership pickers, and recycle-bin restore destinations. They appear only on the archive page. Governs Project, Document, ProjectMembership.
- **Archived projects are read-only** *(Q6)*: no rename, membership changes, uploads or document deletes. The only actions allowed are unarchive, zip download, and delete (to the recycle bin). Governs Project, ProjectMembership, Document.
- **Lossless round trip** *(explicit "restored to original structure")*: unarchive restores every archived document's file byte-identically into `active/{projectId}/`, with Document, DocumentText, DocumentFilterValue and ProjectMembership rows unchanged — no re-extraction, no re-entry of filter values — governs Project Archive, Document.
- **No data loss on failure** *(implicit)*: originals are removed only after the zip is complete and verified; the zip is removed only after extraction is complete and verified — governs Project Archive, Storage Layout.
- **Archive scope = live documents only** *(implicit)*: documents already in the recycle bin keep their own 30-day clock and stay in `deleted/{projectId}/`. They are not zipped, and cannot be restored back into the project while it is archived. Governs Document, Recycle Bin.
- **Missing files don't block archive** *(Q5)*: if a document's blob is missing at archive time, the archive still goes ahead. The gap is recorded in the zip manifest and the admin sees a warning. On unarchive the same document stays without a file, exactly as before. Governs Project Archive, Document.
- **Deleting an archived project is recoverable and audited** *(Q1 + BACKLOG "All deletion logs retained")*: deletion goes through the recycle bin with the standard 30-day window. Each of its documents gets a `DeletionLog` row sharing the project's deletion timestamp, the same as when an active project is deleted. At purge, the zip, any separately recycled blobs, and the Document / DocumentText / DocumentFilterValue / ProjectMembership rows are removed, while logs are kept with `permanentlyDeletedAt` set. Governs Project, DeletionLog, Recycle Bin.
- **Memberships persist through archive** *(explicit modal copy)*: access is suspended, not revoked. Governs ProjectMembership.
- **Archive auditing is current state + server log** *(Q7)*: the project records when and by whom it was archived. Archive, unarchive and zip download each write a server log line; there is no persistent history table. Governs Project.
- **No member notifications** *(Q9)*: members simply stop or start seeing the project. Governs ProjectMembership.
- **Name stays reserved** *(implicit, existing unique constraint)*: an archived project's name cannot be reused by a new project — governs Project.
- **Storage folders are keyed by project id** *(architecture.md)*: stable across rename — governs Storage Layout.
- **Compression is transparent and lossless** *(implicit from audit/record-keeping purpose; thresholds from Q3)*: users always receive the exact original file, and compression never alters document content. It applies only to files above 5MB, and the compressed copy is kept only when it is at least 10% smaller. Both values are configurable. Governs Document, BlobStore.
- **Recovery semantics unchanged** *(implicit)*: the 30-day window, restore and purge behave exactly as today after the layout change — governs Recycle Bin, Storage Layout.

---

## Strategic Approach

### Solution Direction

- **New Archive capability, built on existing conventions.** Add an admin-only Archive module (controller → service → Prisma) for archive, unarchive, list archived, download archive, and delete-to-recycle-bin. Use `ProjectsService.deleteProject` and `RecycleBinService` as the reference patterns: capture the actor, claim state with conditional updates before touching files, tolerate missing blobs, and keep DB rows as the source of truth for *which* files belong to a project (never a folder listing).
- **Data flow — archive**: the admin clicks Archive on the Projects page → the project is claimed (Active → in progress) → each live document's blob is streamed into a zip in the archived area, with a manifest that also lists any missing files → the zip is verified → the project is marked Archived (timestamp, actor, archive size, document count), the admin is warned about any missing files, and a server log line is written → the project's active blobs are removed. **Unarchive** is the mirror: claim → extract per manifest into `active/{projectId}/` → verify → clear the archived state → remove the zip. **Download** streams the stored zip unchanged and writes a server log line.
- **Data flow — delete an archived project (Q1)**: on the archive page, delete claims the project, moves the zip into `deleted/{projectId}/`, and soft-deletes the project and its documents with a shared timestamp and `DeletionLog` rows. This is the same contract `ProjectsService.deleteProject` uses, but with `archivedAt` left set. `RecycleBinService` then has to handle a **zip-backed deleted project**: restore puts the zip back in `archived/` and the project returns to Archived; purge and recycle-bin permanent delete remove the zip; drill-down lists its documents but offers no per-document restore.
- **One "project is live" rule, applied everywhere.** Centralise the predicate "project not soft-deleted and not archived" and apply it to every path that currently checks only `Document.deletedAt`, including the admin bypass (Q4). That covers `DocumentsService`, `ExportsService`, `ProjectsService` (list, rename, members, delete), upload validation, and recycle-bin restore-destination validation. Rename and membership changes on archived projects are refused (Q6).
- **Restructure storage behind `BlobStore`, local disk only (Q10).** The root comes from an environment variable read at startup (Q2); `@nestjs/config` is already wired. Use the project-based `active/` / `archived/` / `deleted/` layout, with one shared key-derivation rule replacing the prepend/strip convention. Extend the abstraction toward stream-based reads and writes so zip creation, extraction and compression never depend on local paths, which is also what Phase 5 (OneDrive) needs.
- **Migrate existing data once (Q11).** An idempotent, resumable migration script moves existing blobs and rewrites persisted keys to the new layout before archive is enabled. Readers keep treating `storageKey` as opaque, so a partially migrated store never breaks reads.
- **Compression as a storage-layer concern (Q3).** Lossless compression is applied at write time to files above 5MB, and the compressed copy is kept only if it saves at least 10%. Both values are configurable. Extraction and OCR run on the original upload bytes, and every reader gets the original bytes back through `BlobStore`.
- **Frontend.** Wire `ArchiveProjectModal`'s confirm button to the API and remove archived projects from `AdminProjects`. Replace the `AdminArchive` mock with real data (Q8): name, archived date and actor, zip size, document count, and a client-side search by name, with no Filter button or pagination. Actions are Download, Restore (= unarchive) and Delete, which moves the project to the recycle bin and so should no longer be labelled "Delete Permanently". Surface the missing-file warning after archive (Q5). Update `AdminRecycleBin` so a zip-backed deleted project restores as a whole and its documents have no per-document restore. Follow the `api/*.ts` fetch helpers and `AdminRecycleBin` page patterns.
- **Docs.** Update `architecture.md`, `system-design.md`, `api-design.md`, `decisions.md` and `project-plan.md` alongside the code — several are already stale relative to the project soft-delete implementation.

### Key Design Decisions

- **Archive state model** — `archivedAt` alone is simplest but cannot represent "half-archived" after a crash or block concurrent actions; a full status enum is more invasive across existing `deletedAt`-based queries. → **Recommend `archivedAt` + archiving actor as the source of truth, plus a persisted in-progress marker**, mirroring the claim-first pattern already used by the recycle bin and making the Phase 6 move to jobs a drop-in.
- **Zip contents and naming** — entries named by `documentId` make unarchive trivial but make the admin download useless to humans; entries by original filename are readable but collide (the existing export already has this flaw). → **Recommend human-readable, de-duplicated entry names plus an embedded manifest** mapping each entry to its document id, mime type and original size. Unarchive is driven by the manifest; the download is meaningful outside the app.
- **Database rows while archived** — dropping Document/Text/FilterValue rows would shrink the DB but make unarchive lossy (re-extraction, lost filter values) and complicate audit. → **Recommend keeping all rows; only blobs move into the zip.** Unarchive is fast and exact; the zip is the storage form, not a data export.
- **Visibility enforcement** — adding `archivedAt` checks to each query is quick, but a check is easy to miss (admins have no project filter at all today). → **Recommend a single shared "live project" predicate** reused by every service, consolidating the duplicated `getAccessibleProjectIds` logic in `DocumentsService` and `ExportsService`. Admins are included (Q4).
- **Execution model** — background in-process execution avoids HTTP timeouts but needs polling UI and has no durability without a queue; synchronous requests are consistent with the "Synchronous Processing First, Async Later" decision. → **Recommend synchronous execution for Phase 4** with streaming I/O (no whole-file buffering), the persisted in-progress marker (so the archive page can show "Archiving…" and a disconnected client doesn't corrupt state), and an explicit hand-off to Phase 6 jobs for very large projects.
- **Deleting an archived project** — ✅ *Resolved (Q1)*: it goes **through the recycle bin** with the standard 30-day window, not straight to permanent deletion. A restore within the window returns the project to **Archived**. → **Recommend keeping `archivedAt` set alongside `deletedAt`** so "deleted while archived" needs no extra state and a restore falls back to Archived naturally. The zip moves to `deleted/{projectId}/` and back, which keeps the on-disk tree consistent with the documented layout.
- **Per-document restore from a zip-backed deleted project** — options: extract the single file from the zip into another project, or allow only whole-project restore. → **Recommend whole-project restore only** for Phase 4. Extracting a single document from a deleted zip adds a partial-zip-rewrite path for a rare need. The drill-down still lists the documents for context.
- **Storage root configuration** — ✅ *Resolved (Q2)*: an environment variable read at startup. "Configurable by admin" means the system administrator. A runtime console setting is out of scope.
- **Layout migration** — ✅ *Resolved (Q11)*: a one-off idempotent migration of blobs, `Document.storageKey` and open `DeletionLog.storageKey` values, run before archive is enabled. Readers stay tolerant of legacy keys as a safety net.
- **Folder/file naming on disk** — human names are browsable but change on rename and collide; ids are stable. → **Recommend ids (`{projectId}/{documentId}.{ext}`) as `architecture.md` specifies**; human readability is provided by the zip manifest and the app itself.
- **Compression approach** — ✅ *Resolved (Q3)*: build it now as **transparent, lossless** compression in the storage layer. The threshold is 5MB, and the compressed copy is kept only if it is at least 10% smaller. Both are configurable. Format-aware re-encoding is rejected on record-integrity grounds.
- **`BlobStore` evolution** — keeping `getPath` is zero-churn but breaks the moment a blob is compressed or remote. → **Recommend stream/buffer-based read and write on `BlobStore`** and migrating the `getPath` readers (download, export, extraction/OCR). This touches Phase 1–3 paths, so it must land with tests.
- **Recycled documents of an archived project** — options: zip them too, block archive while any exist, or leave them. → **Recommend leaving them in `deleted/{projectId}/` on their own 30-day clock**, blocking restore *into* the archived project (admin chooses another project, as already happens for deleted projects), and cleaning them up when the archived project is eventually purged.
- **Missing blobs at archive time** — ✅ *Resolved (Q5)*: the archive goes ahead, the gap is recorded in the manifest, and the admin is warned.
- **Archive page scope** — ✅ *Resolved (Q8)*: name, archived date and actor, zip size, document count, and a client-side search by name. The mock's Filter button and pagination are dropped for now.

### Alternatives Considered

- **Model archive as a soft-delete variant (recycle bin with infinite retention)**: rejected — conflates recoverable deletion with dormant storage, forces special cases into the recycle-bin listing and purge, and doesn't satisfy the zip requirement.
- **Flag-only archive (files stay in `active/`)**: rejected — contradicts the explicit zip requirement and the "reduces storage, signals immutability" rationale.
- **Export DB metadata into the zip and drop rows**: rejected — larger change, lossy for search text and filter values, complicates unarchive; DB size is not a concern at SQLite scale.
- **Lazy key migration only**: rejected — leaves a permanently mixed layout and two key conventions in code.
- **Admin UI for the storage root in Phase 4**: rejected by the stakeholder (Q2). It needs bulk relocation logic that belongs with the Phase 5 OneDrive work.
- **Immediate permanent delete of archived projects**: rejected by the stakeholder (Q1) in favour of recycle-bin recovery.
- **Restoring a deleted archived project to Active**: rejected by the stakeholder (Q1 follow-up). A restore returns the project to Archived.
- **Persistent archive history table**: rejected by the stakeholder (Q7). Current state plus server log lines is enough.
- **Deferring compression**: rejected by the stakeholder (Q3). It ships now, with a savings guard.
- **Real OneDrive integration in Phase 4**: rejected by the stakeholder (Q10). It stays in Phase 5.
- **Email notifications to members on archive/unarchive**: rejected by the stakeholder (Q9).
- **Rely on zip compression alone (no at-rest compression)**: rejected as the sole approach because the requirement says "before storage", though archived projects do benefit from it.
- **Introduce a job queue now**: rejected — that is Phase 6 scope; the in-progress marker keeps the door open.

---

## Risk & Gap Analysis

### Requirement Ambiguities

All open questions were settled with the stakeholder on 2026-10-02:

- **"Root folder configurable by admin"** — ✅ Q2: an environment variable read at startup. No runtime console setting.
- **"OneDrive Storage Structure" in Phase 4 vs "OneDrive integration" in Phase 5** — ✅ Q10: local disk only in Phase 4, laid out to map 1:1 onto OneDrive later.
- **"Permanently delete archived projects"** — ✅ Q1: goes through the recycle bin (30 days). A restore returns the project to Archived. This keeps the principle "All destructive actions logged and recoverable". The archive page action should therefore not be labelled "Delete Permanently".
- **"Restored to original structure"** — interpreted as the new `active/{projectId}/` layout (per system-design). Legacy `{userId}/` keys are removed by the Q11 migration, so the two cannot conflict.
- **Compression threshold and "meaningfully"** — ✅ Q3: 5MB threshold and at least 10% saving, both configurable, lossless.
- **Admin visibility of archived documents** — ✅ Q4: hidden from admins too; archived projects appear only on the archive page.
- **Non-admin experience / notifications** — ✅ Q9: no notifications; members simply stop or start seeing the project.
- **What is editable while archived** — ✅ Q6: nothing. The project is read-only until unarchived.
- **Archive history/audit** — ✅ Q7: `archivedAt` and the archiving actor on the project, plus server log lines for archive, unarchive and download.
- **Archive page features** — ✅ Q8: client-side search by name; no Filter button or pagination.
- **Archive page metrics** — ✅ Q8: zip size and document count.
- **Missing blobs at archive time** — ✅ Q5: the archive proceeds, the gap is recorded in the manifest, and the admin is warned.
- **Existing data** — ✅ Q11: a one-off idempotent migration script.

### Edge Cases

- **Empty project** (no documents): must still produce a valid, unarchivable archive.
- **Documents with `FAILED` status or empty `storageKey`** (upload failed before `saveFile`): nothing to zip; must not abort the archive, and must round-trip unchanged.
- **Duplicate original filenames** within a project: zip entry collisions (the existing export silently has this).
- **Hostile/odd filenames** (path separators, `..`, unicode, very long names): extraction must never write outside the target folder (zip-slip), and names must survive the round trip.
- **Upload racing an archive**: a document created mid-archive would land in `active/` after the zip is built, becoming orphaned and invisible — upload must check project state and respect the in-progress marker.
- **Concurrent operations**: double-click archive; archive vs project soft-delete; unarchive vs delete; archive vs recycle-bin restore into the same project; recycle-bin restore of a deleted archived project vs `PurgeTask`.
- **Crash mid-operation**: partially written zip, or some originals already removed; partially extracted unarchive — needs a defined recovery path.
- **Disk space**: archive/unarchive temporarily need roughly twice the project's size; running out must not lose originals.
- **Recycled documents in an archived project**: purge continues normally; a restore must target another live project; when the archived project is eventually purged, these blobs must also be removed and their logs closed.
- **Recycle-bin drill-down into a zip-backed deleted project**: the existing UI offers per-document restore with a target-project picker, which must be unavailable here because the files are inside the zip.
- **Restoring a deleted archived project whose zip is missing** from `deleted/{projectId}/` (manually removed, failed move): the restore must not leave an Archived project with no archive. It should fail clearly or flag the project.
- **Recycle-bin permanent delete vs scheduled purge of a zip-backed project**: both paths must remove the zip (not per-document blobs) and close every open `DeletionLog` row.
- **Deleting an archived project that also has separately recycled documents**: those keep their own `deletedAt` and stay deleted when the project is restored. This matches today's shared-timestamp rule.
- **Missing-file warning**: should still show if the admin navigates away mid-request; the manifest is the durable record.
- **Archive-page delete label**: the mock says "Delete Permanently", which is now inaccurate (Q1) and would mislead admins.
- **Documents restored from the recycle bin into a different project** (`targetProjectId`): under a project-keyed layout the blob must move to the new project's folder; today restore reuses the original key, which would leave it under the wrong project.
- **Legacy `DeletionLog.storageKey` values** (`{userId}/…`) used by restore after migration.
- **Name reuse**: creating a project with an archived project's name hits the unique constraint (`createProject` has no friendly conflict handling today).
- **Rename while archived**: storage is id-keyed so safe; zip download filename should reflect the current name.
- **Deep links / stale UI**: a user with an open document or cached project list after archive must get a clean 404, not a 500 from a missing blob.
- **Very large files and projects**: the mock shows GB-scale archives; anything that buffers whole files (as `ExportsService` does) won't scale.
- **Compression interplay**: zips must contain original bytes (not compressed-at-rest bytes) so the admin download is usable; export ZIPs and single downloads must return originals; `sizeBytes` must keep meaning original size.

### Technical Risks

- **Visibility leakage across many read paths**: each `DocumentsService`/`ExportsService` path filters only `Document.deletedAt`, and admins have no project restriction at all. Missing one path exposes archived content or yields 500s on missing blobs. *Mitigation*: one shared predicate plus a test per read path.
- **Key-convention ripple into Phase 2 code**: the `deleted/` prepend/strip rule is embedded in four call sites across documents, projects and recycle bin; changing the layout risks regressing soft delete, restore and purge. *Mitigation*: a single key-derivation module with focused tests before archive work starts.
- **No automated test safety net**: `server/src` has no `*.spec.ts` files (only the default e2e scaffold), yet this change is cross-cutting. *Mitigation*: introduce service-level tests for the key helper, the visibility predicate and the archive state machine as part of the phase.
- **`getPath` leaks local paths**: download, export and extraction/OCR read files directly from disk, which breaks under compression and under OneDrive. *Mitigation*: stream-based `BlobStore` reads; migrate those callers.
- **Non-atomic DB + filesystem operations**: SQLite transactions can't cover file moves. *Mitigation*: strict ordering (write new → verify → flip DB → remove old), claim-first conditional updates, idempotent re-runs, in-progress marker.
- **Long-running synchronous requests**: GB-scale projects risk proxy/HTTP timeouts and event-loop pressure (the export uses deflate level 9). *Mitigation*: streaming, sensible compression level (store already-compressed entries), in-progress state surfaced in the UI, Phase 6 hand-off.
- **New dependency for reading zips**: `archiver` only writes. *Mitigation*: choose a maintained streaming unzip library; enforce entry-path sanitisation even though zips are self-produced.
- **Data migration of existing storage**: a partial run leaves a mixed layout; there is no backup strategy yet (Phase 5). *Mitigation*: idempotent/resumable migration, dry-run mode, take a backup of `server/data` and `dev.db` before running.
- **Recycle bin assumes per-document blobs**: `RecycleBinService` restore, purge and drill-down all treat a deleted project's files as per-document blobs in `deleted/`, derived from each document's key. Zip-backed deleted projects (Q1) break that assumption in four places: project restore, document restore, project purge, and the project document listing. The `AdminRecycleBin` UI needs the matching change. *Mitigation*: branch on "deleted project is archived" in a single place, and test restore, purge and permanent delete for both kinds of project.
- **Compression ROI**: with only PDF/JPEG/PNG accepted, lossless compression will rarely save 10%, so the feature adds read-path complexity for little storage gain. The stakeholder accepted this (Q3) to future-proof for compressible types. *Mitigation*: the savings guard keeps cost bounded (one compression attempt per file over 5MB); log the actual savings so the threshold can be tuned.
- **Single-instance scheduling**: `PurgeTask` runs in-process; purging a zip-backed deleted project must follow the same claim-first discipline so the scheduled purge and admin actions never double-delete.
- **Documentation drift**: `project-plan.md` ("Deleting a project still hard-deletes its documents by cascade"), `decisions.md` ("Soft Delete … Status: not implemented") and `system-design.md` (project delete "is permanent") contradict the code, which has project soft delete with recycle-bin restore. The REASONS Canvas must treat code as the source of truth, and Phase 4 should correct these docs.
- **Inconsistent admin error responses**: `ProjectsController` returns 400 for non-admins while `RecycleBinController` returns 403. The new module should pick one (403) to avoid spreading the inconsistency.

### Acceptance Criteria Coverage

| AC# | Description | Addressable? | Gaps/Notes |
|-----|-------------|--------------|------------|
| 1 | Admin can archive a project from the project management page | Yes | `AdminProjects` + `ArchiveProjectModal` exist; needs confirm handler, API call, missing-file warning (Q5), and removal of the row on success |
| 2 | On archive, all project files zipped into `archived/{projectId}.zip`, `archivedAt` set | Yes | "All files" = live (non-recycled) documents; missing blobs recorded in the manifest (Q5); failed uploads with no blob round-trip unchanged |
| 3 | Archived project hidden from main views, appears on archive page; members lose access until restored | Yes | Requires the shared live-project predicate across every read/write path, including for admins (Q4); memberships retained; project read-only (Q6) |
| 4 | On unarchive, zip extracted to `active/{projectId}/`, `archivedAt` cleared, project re-appears | Yes | Driven by the manifest; "original structure" = new layout, and legacy keys are removed by the migration (Q11) |
| 5 | Dedicated archive page lists archived projects | Yes | Replace the `AdminArchive` mock: name, archived date and actor, zip size, document count, client-side name search; no Filter or pagination (Q8) |
| 6 | Admin can download zip without unarchiving; project stays archived | Yes | Must stream; human-readable entries plus manifest; server log line (Q7) |
| 7 | Admin can permanently delete an archived project; zip removed, DB records purged | Yes (as clarified) | Q1: delete goes through the recycle bin, so the zip and DB records are removed at purge (30 days) or on recycle-bin permanent delete. A restore returns the project to Archived. Requires `RecycleBinService` and `AdminRecycleBin` to support zip-backed projects |
| 8 | Storage root folder configurable by admin | Yes (as clarified) | Q2: an environment variable read at startup |
| 9 | Live files in `active/` with one folder per project | Yes | Requires `BlobStore` key restructure and the one-off migration (Q11) |
| 10 | Each archived project stored as a single zip in `archived/` | Yes | Delivered by the archive flow; the zip moves to `deleted/{projectId}/` when the project is deleted and back on restore |
| 11 | Soft-deleted files in `deleted/` with one folder per project during 30-day window | Yes | Replaces the prepend convention in `deletion.constants`; cross-project restore must relocate blobs; legacy `DeletionLog` keys are migrated (Q11) |
| 12 | Large files compressed before storage (threshold TBD, suggested 5MB+) | Yes (as clarified) | Q3: 5MB, configurable; requires stream-based reads so all readers get original bytes |
| 13 | Compression only where it meaningfully reduces size; PDF/JPEG may be skipped | Yes (as clarified) | Q3: compressed copy kept only if at least 10% smaller, configurable; real-world savings on PDF/JPEG/PNG expected to be small (accepted) |
