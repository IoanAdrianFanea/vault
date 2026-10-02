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
