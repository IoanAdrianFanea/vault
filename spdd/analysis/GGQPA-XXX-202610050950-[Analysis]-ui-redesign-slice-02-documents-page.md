# SPDD Analysis: UI Redesign — Slice 02 Documents Page

## Summary for Review

**1. What this does.** It restyles the Documents page body to match `screen.png`, which means a compact toolbar, removable filter chips, a dense table with teal text actions, a summary bar, a dark floating bulk bar, and rebuilt preview and export modals. It adds client-side CSV export. It also builds the shared components this page is the first to use: Modal, ConfirmDialog, Popover, Chip, Table primitives, EmptyState, SummaryBar, TextAction, FormField and Select.

**2. How it works today.**
- **Toolbar and filters:** Project and sort use native selects. The inline filter panel refetches on every keystroke. Tags read "Main: X", and the count reads "Showing 1-N of N".
- **Table:** It has a PDF icon, outlined Preview/Download buttons, US dates with no time, and a blue selection colour. The selection is never cleared when filters change, and late fetch responses can overwrite newer ones.
- **Native dialogs:** Bulk delete uses `window.confirm` with the wrong "cannot be undone" copy. Partial delete failures, download errors and ZIP errors all use `alert`.
- **Preview link:** Opening a preview goes to `/documents/:id` *without* the query string, so an active `?status=` filter is lost.
- **Preview modal:** It shows the raw status enum, no project, no page count and no extracted text. `GET /documents/:id` doesn't return `projectName` or `uploadedByEmail`; only list rows have them.
- **Processing:** It runs synchronously inside the upload request (Uploaded → Processing → Processed or Failed). Queued is never set.
- **Shared with Search:** `Search.tsx` (slice 03) also uses `BulkActionBar`, `ExportModal` and the UI `Document` type.
- **Export base URL:** `api/exports.ts` (preview, download, ZIP) hard-codes `http://localhost:3000` instead of `API_URL`.

**3. What will change (frontend only).**
- `Documents.tsx`, `DocumentTable`, `BulkActionBar`, `DocumentPreviewModal` and `ExportModal` are rebuilt on `components/ui/` with role-based tokens only.
- The filter panel becomes a popover where edits are a draft until you apply them. Sortable headers stay in sync with the Sort dropdown.
- The summary bar gets real counts and accurate copy when the list is capped (Q2).
- Opening and closing a preview keeps the query string (Q5).
- Rows follow the screenshot's height (Q1).
- A `utils/csv.ts` helper is added, and the UI `Document` type keeps `projectName`, `sizeBytes` and `uploadedAt`.
- Every native dialog in these files is replaced.
- The ten listed components, plus a `Menu` for the export actions (Q3), are added to the `ui/` barrel.
- `AppShell` shares the user it has already loaded through a small context, with no visual change (Q4).
- `api/exports.ts` switches to `API_URL` (Q6).

**4. What will NOT change.** Nothing under `server/` changes, there are no API contract changes and no new npm packages. The shell's appearance doesn't change, and `Search.tsx` and `DocumentDrawer.tsx` aren't edited.

**5. Assumptions (confirmed at review).**
- A1: Shared components keep backward-compatible props, and the new `Document` fields are optional, so `Search.tsx` compiles untouched. As a side effect, Search shows the new bulk bar and export modal.
- A2: "Indexing N documents" counts Uploaded, Queued and Processing documents.
- A3: The Filter badge counts the applied popover fields (project, keyword and each custom filter). The popover's "Clear all" leaves `?status=` alone; the chips row's "Clear all" clears it too.
- A4: The preview shows the full extracted text from the existing `GET /documents/:id/text` endpoint. It lists every defined custom field ("—" when empty), and takes Project and Uploaded by from the list row ("—" for a deep link to a document outside the loaded list).
- A5: CSV dates use local time, like the table. Keyboard tests for Modal and ConfirmDialog are manual, because the client has no test runner.

**6. Top 3 risks.**
1. Ripple into Search through shared components and the `Document` type (mitigated by A1).
2. Several triggers now refetch: the draft/apply popover, clicks on sortable headers, and clearing the selection. Without a guard against stale responses, the table can show results for the wrong filters.
3. Overlay layering and focus: a Dropdown inside a Modal, a ConfirmDialog over a Modal, native date inputs inside the Popover, and Escape order.

**7. Open questions.** All resolved. See Resolved Questions.

## Resolved Questions

Reviewed on 2026-10-05. The reviewer replied "Confirmed: accept all recommended answers and assumptions". Each answer below is a settled requirement for the canvas.

| # | Question | Resolution |
|---|----------|------------|
| Q1 | A "32px row" can't fit a two-line Document cell (name with size beneath). What row height applies? | **Match the screenshot.** Rows have a 32px minimum, so single-line content gives 32px rows. The two-line Document cell (name 13px, size 11–12px beneath, tight leading, small vertical padding) makes rows about 40px, as the screenshot and the exported design render them. The header row stays exactly 28px. |
| Q2 | The list is capped at 50 rows with no pagination, and no endpoint returns a total size. What do "Total: N files", "X MB stored" and the cap message show? | **"Total"** is the true matching count from the status counts fetched with the same filters. With `?status=` active, it's that status's count; otherwise it's the sum. **Size** is the sum of the loaded rows. When the list is capped, the size reads "X MB in the 50 shown" instead of "X MB stored". **The cap message** ("Showing the first 50 documents — narrow with filters") appears only when the true matching count is over 50. If the counts request fails, fall back to the loaded rows: Total = rows shown, and the cap message appears when exactly 50 rows come back. |
| Q3 | `Dropdown` is a value picker (listbox with a selected check). The export menu triggers actions. Which component? | **Add a `Menu` component to `components/ui/`, built on `Popover`.** It provides action items with menu semantics, arrow-key navigation, disabled items and dividers. `Popover` provides anchoring, outside-click and Escape. Its first consumer is the Export menu. `Dropdown` keeps its listbox meaning. |
| Q4 | The admin-only "Manage projects" footer needs the user's role, which the Documents page doesn't know. | **`AppShell` shares the user it already loads through a small React context. The shell looks the same.** The Documents page reads the role from that context. The footer is absent from the DOM until the role is confirmed as ADMIN. This narrowly revises slice 01's "no user context" decision: the shell still owns the single `/auth/me` call, and the context only shares its result. |
| Q5 | Opening a preview goes to `/documents/:id` without the query string, so an active `?status=` filter is lost. Closing it goes to `/documents`. | **Keep the current query string when opening and closing the preview.** Filters (and therefore the selection) survive a preview. This is a deliberate fix to existing behaviour, because the "N failed" link and the "clear selection when filters change" rule depend on it. |
| Q6 | `api/exports.ts` hard-codes `http://localhost:3000` instead of `API_URL`. Preview, single download and ZIP export all go through it. | **Switch it to the shared `API_URL` pattern in this slice.** Only the base URL changes. Paths, methods, headers and response handling stay the same, so the request/response contracts are untouched. |
| A1 | Assumption: shared components stay backward-compatible for `Search.tsx`. | **Confirmed.** `BulkActionBar` gains its new actions as optional props, `ExportModal` keeps its props, and the new UI `Document` fields are optional. `Search.tsx` and `DocumentDrawer.tsx` aren't edited. As a side effect, Search shows the restyled bulk bar (Download ZIP + Delete only) and export modal. Its own `window.confirm`/`alert` calls stay until slice 03. |
| A2 | Assumption: what "Indexing N documents" counts. | **Confirmed: Uploaded + Queued + Processing.** Processing runs synchronously inside the upload request, so this is non-zero only while an upload is in progress, or for a document left mid-pipeline by a server failure. |
| A3 | Assumption: Filter badge count and the two "Clear all" actions. | **Confirmed.** The badge counts the applied popover fields: project, keyword, and each custom filter that has a value. The popover's "Clear all" resets those fields in both the draft and the applied values, and leaves `?status=` alone. The chips row's "Clear all" also clears `?status=`. |
| A4 | Assumption: where the preview modal's data comes from. | **Confirmed.** Extracted text is the full text from the existing `GET /documents/:id/text`, not the 150-character `textPreview`. Every current custom filter definition is listed in `order`, with "—" when it has no value. Project and Uploaded by come from the list row. A deep link to a document outside the loaded list shows "—" for both, because `GET /documents/:id` doesn't return them. |
| A5 | Assumption: CSV time zone and how overlays are tested. | **Confirmed.** CSV dates use the browser's local time, like the table. Modal and ConfirmDialog keyboard behaviour is tested by hand in the browser, because the client has no test runner and adding one would add a dependency. |

## Original Business Requirement

> Source: the requirement pasted into the `/spdd-analysis` request, reproduced verbatim below. It is followed by the two referenced design files. `DESIGN.md` is reproduced verbatim (fenced) because the `stitch_docindex_construction_document_manager/` folder is deleted in slice 07. `screen.png` is an image and can't be embedded, so the Documents page body elements relevant to slice 02 are described in words. Where `DESIGN.md` or the screenshot conflicts with the requirement text, the requirement text wins (see Risk & Gap Analysis and Resolved Questions).

/spdd-analysis #file:stitch_docindex_construction_document_manager/screen.png #file:stitch_docindex_construction_document_manager/DESIGN.md

# Initiative: UI redesign to the approved spreadsheet-style design

**Current slice: 02** ← implement ONLY this slice. The other slices are listed for context so earlier work fits later work.

## Progress so far

**Slice 01 is done.** Its analysis and canvas are in `spdd/`. Where this section differs from the slice 01 text further down, this section wins.

- **Tokens:** the new design lives under role-based token names in `client/tailwind.config.js` (`accent`, `ink`, `canvas`, `subtle`, `line`, `selected`, `status-*` and so on). Read the config for the exact names. The legacy Material colour tokens were **not** remapped. They are frozen at their old values, which is why unrestyled pages still look blue.
- **In every file this slice touches, use only the role-based tokens.** Remove every legacy class (`primary*`, `on-surface*`, `surface-*`, `outline*`, `error*`, `background-*`, `text-label-md`, `text-body-md`, `text-headline-sm`, `font-headline`, `font-display`, `font-body`, `font-label`), every hard-coded `blue-*`/`gray-*` class and every `dark:` class. Slice 07 deletes the legacy tokens, so nothing restyled may depend on them.
- **z-index scale tokens:** sticky table header 10, app header 20, bulk bar 30, dropdown/popover 40, modal 50, confirm over a modal 60.
- **Already in `components/ui/`:** Button + ButtonLink, IconButton, Badge, StatusBadge, Avatar, Dropdown, Input, Checkbox, Spinner, InlineAlert, plus `buttonStyles.ts`, `statusTones.ts` and the `index.ts` barrel. Reuse these and extend them if needed. Don't duplicate them.
- **The app shell (header and sidebar) is finished.** Don't restyle it again.
- **Moved out of slice 01 because components are built in the slice that first uses them:**
  - **Slice 02 (this slice) builds:** Modal, ConfirmDialog, Popover, Chip, Table primitives, EmptyState, SummaryBar, TextAction, FormField, Select.
  - **Slice 03 builds:** PageHeader.
  - **Slice 04 builds:** Tabs.
- **Rules for Modal and ConfirmDialog:**
  - Render through `createPortal` to `document.body`.
  - On open, focus the first focusable element.
  - Trap Tab and Shift+Tab inside.
  - Close on Escape.
  - Return focus to the trigger on close.
  - Keyboard-test them in this slice.
  - Dropdown already stops its Escape from reaching outer handlers, so a Dropdown inside a Modal closes on its own first.
- **Checkbox has had no consumer yet.** This slice is the first to check its 14px size, its teal checked state and its indeterminate state against the `@tailwindcss/forms` base styles.

## Why

The current frontend looks weak and washed out: pale greys, tiny light-grey headers, faint borders, pastel badges, no hierarchy. The stakeholder wants a simple spreadsheet-style tool. A new design was made in Google Stitch and approved for the Documents screen (`screen.png`). Apply it to every screen, frontend only, without changing the backend.

## Design reference

The design files are in `stitch_docindex_construction_document_manager/` at the repo root (temporary — deleted in slice 07). `screen.png` is the source of truth for look and layout. `DESIGN.md` holds the tokens. If you open Stitch's exported HTML (`stitch_docindex_construction_document_manager/code.html`), do NOT copy:
- the Tailwind CDN script or its inline config (use `client/tailwind.config.js`)
- its `borderRadius` (`full: 0.75rem` breaks dots and avatars)

The screenshot renders in serif only because the export doesn't load Inter. **The font is Inter**, already loaded in `client/index.html`.

**Colour**
- Accent `#0f766e` teal (hover `#115e59`); links `#005c55`
- Dark action buttons (Upload, Apply, bulk bar) `#213145` (hover `#0b1c30`)
- Text `#0f172a` (high) / `#334155` (body) / `#64748b` (secondary, column headers)
- Canvas `#ffffff`; sidebar, table header and sub-surface `#f8fafc`
- Gridlines `#e2e8f0` 1px; stronger borders `#cbd5e1`
- Row hover `#f8fafc`; selected row `#f0fdfa`

**Badges** (20px tall, 3px radius, 1px border, 11px medium text, optional 6px dot)
- Teal: Processed, Active
- Amber (`#fffbeb` / `#b45309` / `#fde68a`): Processing, Uploaded, Queued, Pending, in-progress
- Red (`#fef2f2` / `#b91c1c` / `#fecaca`): Failed, Rejected, expiring
- Slate: neutral

Sidebar status dots: Uploaded slate-300, Queued slate-500, Processing amber, Processed teal, Failed red.

**Type** (Inter only)
- Page title 24/32 semibold; section 18/24; panel 15/20
- Body 13/18; small 12/16
- Column headers and form labels: 11/14 semibold, uppercase, tracking 0.04em
- `tabular-nums` for all numbers, dates, sizes and counts

**Shape and size**
- Radius: sm 2px, DEFAULT 4px, md 6px, lg 8px, xl 12px, full 9999px
- Buttons and inputs 4px; badges 3px; popovers and modals 6px; table cells square
- Header 64px; sidebar 192px; buttons 28px (toolbar) / 32px (global); inputs 28–30px; table header row 28px
- Flat surfaces with 1px borders. Popovers and modals: 1px `#cbd5e1` + a small shadow; overlay `bg-slate-900/40`
- Light theme only: dark mode is never enabled, so remove `dark:` variants in every file touched

## Ground rules (every slice)

1. **Frontend only.** Nothing under `server/` changes. No changes to request/response contracts in `client/src/api/`. No new endpoints.
2. **Keep behaviour** (fetching, state, handlers, routes, URL params, permissions) unless the slice says otherwise. Admin-only UI must stay absent from the DOM for non-admins.
3. **Build screens from shared components** in `client/src/components/ui/` (created in slice 01). No one-off copies of button, input, badge, table or modal styles.
4. **In every file touched:** `window.confirm` → `ConfirmDialog`; `window.alert` → `InlineAlert` or a field error.
5. **No new npm dependencies.**
6. **Features with no backend yet:** render the control and route it to a named handler containing only `// TODO(backend): <what's needed>`. No "coming soon" text, toast or banner.
7. **Copy:** UK English, sentence case. Dates `12 Oct 2026`, date-times `12 Oct 2026 14:22` (en-GB). Copy must describe current behaviour accurately.
8. **Row actions are always visible** (no hover-only `opacity-0`). Icon-only buttons need `aria-label`. Dropdowns, popovers and modals close on Escape.
9. **Width:** works at 1280px and 1440px. Mobile is out of scope.
10. `npm run build:full` from `server/` must pass. The client `tsc` has `noUnusedLocals`/`noUnusedParameters`.

## Backend facts the UI must respect

- `GET /documents` returns **max 50 rows** with no pagination. Search returns **max 20**. Show a message when the limit is hit.
- List rows include `projectName`, `sizeBytes`, `uploadedAt`, `status`, `errorMessage`, `uploadedByEmail`, `mimeType`. They do **not** include custom filter values; those come from `GET /documents/:id`.
- `GET /documents/status-counts` accepts the same filters as the list.
- **Document and project deletes are soft deletes** into the recycle bin (30 days). Archived projects can only be deleted from the archive page (409 otherwise). Deleting an archived project moves it to the recycle bin.
- Admin-created users are ACTIVE with `mustChangePassword: true`.
- **Deleting a user hard-deletes every document they uploaded** (`Document.uploadedBy` `onDelete: Cascade`). The UI must warn about this. Fixing it is a separate backend task.
- One status filter at a time, via the `?status=` URL param.

## Decisions (confirm at the review checkpoint)

| # | Decision |
|---|---|
| D1 | Keep the app name "DocIndex Manager" with subtitle "Site document register" ("SiteVault" in the design is a placeholder). |
| D2 | No storage meter: no storage limits, and no endpoint. |
| D3 | No project codes or "pinned sites": these fields don't exist. |
| D4 | Header user block = full name (or email) + role from `/auth/me`, initials avatar; click opens `ProfileSettingsModal`. |
| D5 | Replace "Last sync" / "Indexed & Synced" with real data: "Updated HH:MM" (last fetch) + an indexing indicator from status counts. |
| D6 | Failed rows get a "Retry" action (not "Retry OCR" — PDF failures come from `pdf-parse`); handler is TODO(backend). |
| D7 | "Generate register PDF" menu item; handler is TODO(backend). |
| D8 | Export CSV is implemented client-side from the loaded rows. |
| D9 | Remove fake UI: Google/GitHub login, "Remember me" (unwired), "Forgot password?" (no reset flow), Documentation/Support links, "© 2024" footer, fake "Logged in devices", 2FA (out of scope), Language & Region, and fake drawer fields (Edit, Share, "OCR Completed", Author, Dimensions, Version). |
| D10 | Keep both searches: the header search goes to the `/search` snippet page; the filter keyword narrows the Documents table. |

---

## Slices

### 01 — Foundation and app shell ✅ done (see "Progress so far" for what changed from this plan)

**Tokens**
- Update `tailwind.config.js` with the tokens above. All `fontFamily` keys → Inter; remove the Manrope link from `index.html`.
- Keep legacy token names still used by unrestyled pages as aliases mapped to the nearest new value (grep first): `text-label-md` ×43, `text-body-md` ×37, `font-headline` ×11, `text-headline-sm` ×6, `font-display` ×4, `bg-background-light` ×4, `bg-background-dark` ×4.
- `index.html` title = app name. Restyle `mark` in `index.css` as an amber tint.

**Components in `components/ui/`** (exported from `index.ts`):
- `Button` (primary / dark / secondary / ghost / danger; sm 28px, md 32px; icon, loading, disabled)
- `IconButton`, `TextAction` (uppercase 11px link button), `Input`, `Select`, `Checkbox` (14px, indeterminate), `FormField`
- `Dropdown` ("Label: Value" trigger, check on selected, dividers, footer, outside-click / Escape, ARIA)
- `Popover`, `Badge`, `StatusBadge` (move from `components/common` and update imports; FAILED shows `errorMessage` as `title`), `Chip` (removable)
- Table primitives (sticky 28px header, sortable header with arrow + `aria-sort`, hover / selected rows)
- `Modal` (Escape, backdrop, focus), `ConfirmDialog`, `InlineAlert`, `EmptyState`, `Spinner`
- `PageHeader`, `Tabs` (underline, NavLink, count badge), `SummaryBar`, `Avatar`

**Header** (64px)
- Logo + name + subtitle
- Global search, placeholder "Search files or document text…". Same behaviour: Enter → `/search?q=` when ≥2 chars. Prefill it on `/search`. Remove the fake ⌘K hint.
- Dark "Upload document" button → `/upload`
- User block (D4). Reuse the existing `/auth/me` call.

**Sidebar** (192px, `#f8fafc`)
- "Registers": All Documents (count = sum of status counts), Jobs (no count), Admin settings (admins only, active on `/admin/*`)
- "Status filter": collapsible (state in `sessionStorage`), dot + label + count, same single-select `?status=` behaviour; click again to clear
- No storage meter

**Also**
- Delete unused `components/admin/AdminLayout.tsx` and `components/documents/UploadModal.tsx`.
- Add a "UI Rules" section to `.github/copilot-instructions.md`, outside the openspdd markers. Write the design rules into it directly (tokens, components, light theme only, Inter, `tabular-nums`, no native dialogs). Do NOT reference `stitch_docindex_construction_document_manager/`: that folder is temporary and is deleted in slice 07.

### 02 — Documents page

Files: `pages/Documents.tsx`, `DocumentTable`, `BulkActionBar`, `DocumentPreviewModal`, `ExportModal`, plus the new components listed under "Progress so far".

**Goal:** when this slice is done, the Documents page body matches `screen.png`. That means the toolbar, chips row, table, row actions and summary bar have the same layout, density and spacing: 32px rows, a 28px header row, 1px gridlines, uppercase 11px column headers and teal uppercase text actions. Restyling only the shell is not enough. Compare the result side by side with the screenshot.

**Toolbar**
- Project `Dropdown`: All Projects + projects, check on selected, footer "Manage projects" → `/admin/projects` (admins only). Keep the `sessionStorage` key `documents:selectedProject`.
- Filter button with an active-count badge.
- Sort `Dropdown`, same 5 `sortBy` values: newest, oldest, name A–Z, name Z–A, status.
- On the right: "Showing N documents" — or "Showing the first 50 documents — narrow with filters" at 50 — then the Export menu.

**Filter popover** (replaces the inline panel)
- Fields: Search keywords (= `mainFilter`); Project; one field per custom filter in `order` (TEXT / NUMBER input, DATE from–to); 2 columns where they fit.
- Footer: "Clear all" + dark "Apply filters".
- **Behaviour change:** edits are a draft until Apply or Enter. Escape or an outside click discards the draft. Clear all resets the draft and applied values.

**Chips row**
- "Project: X", "Keyword: X", "<Filter>: value", date ranges as "01 Oct 2026 – 12 Oct 2026", "Status: X" — each removable.
- Teal uppercase "Clear all" (also clears `?status=`).

**Table**
- Columns: checkbox | Document (name + size beneath, no icon) | Status | Uploaded by | Date uploaded | Actions
- Actions: "PREVIEW / DOWNLOAD". FAILED rows: "RETRY" (danger, D6) + "DOWNLOAD".
- Sortable headers: Document (`name-asc` ↔ `name-desc`), Status (`status`), Date (`upload-newest` ↔ `upload-oldest`); synced with the Sort dropdown.
- Selection: select-all with indeterminate; selected rows highlighted; checkbox clicks don't open the preview; clear the selection when filters or sort change. Row click opens the preview as today.

**Summary bar**
- "Total: N files • X MB stored • Updated HH:MM"
- Right side, from `getStatusCounts(same filters)`: "Indexing N documents" (amber) or "All documents indexed" (teal), plus a red "N failed" link that sets `?status=FAILED`.

**Export menu**
- "Export shown as CSV (N)"
- "Export selected as CSV (n)"
- "Download selected as ZIP (n)" (existing `ExportModal`)
- divider, "Generate register PDF" (D7)

**CSV** (`client/src/utils/csv.ts`)
- Columns: File name, Project, Status, Uploaded by, Date uploaded (`YYYY-MM-DD HH:mm`), Size (KB)
- RFC 4180 escaping; prefix `=` `+` `-` `@` with `'` (formula injection); UTF-8 BOM; CRLF; file name `documents-YYYY-MM-DD.csv`
- **Allowed:** extend the UI `Document` type in `types.ts` and `convertApiDocument` to keep `projectName`, `sizeBytes`, `uploadedAt`.

**Bulk bar** (floating, dark): "N selected" | Download ZIP | Export CSV | Delete | ×
- Delete → `ConfirmDialog`: "They'll move to the recycle bin. An admin can restore them for 30 days." (replaces the wrong "cannot be undone")
- Partial failure → `InlineAlert`

**States**
- Loading skeleton
- Error `InlineAlert` + "Try again"
- Empty: "No documents yet" + Upload button (replace "Upload your first PDF")
- Empty with filters: "No documents match these filters" + Clear filters

**Preview modal**
- Header: name, size, `StatusBadge` (not the raw enum)
- Compact key/value grid: Project, Uploaded by, Date, Pages, custom fields ("—" when empty)
- FAILED → `errorMessage` in an `InlineAlert`
- Preview area and extracted text (scrollable)
- Footer: Download + Close

**Export modal:** rebuilt on `Modal`.

### 03 — Search and Upload

Build `PageHeader` in `components/ui/` in this slice (first use).

**Search** (`pages/Search.tsx`)
- `PageHeader` with `"<query>" — N results`, or the top-20 limit message.
- Table: checkbox | Document (name + 2-line snippet with `<mark>`) | PREVIEW / DOWNLOAD.
- Bulk bar: Download ZIP + Delete (`ConfirmDialog`, recycle-bin copy).
- Empty states: no query / no results ("Browse documents").

**`DocumentDrawer`**
- Docked right, 360px. Name + `StatusBadge`.
- Real metadata only (D9).
- Text excerpt + "Show full preview" (opens the preview modal).
- Download; Delete via `ConfirmDialog`.

**Upload** (`pages/Upload.tsx`)
- `PageHeader` "Upload documents" + back link.
- Two columns: left = Project + "Document details" (custom fields, "Applied to every file in this batch"); right = drop zone ("Drag files here or browse", "PDF, JPG or PNG", teal on drag). **Remove the wrong "Maximum file size 50MB" copy.**
- File queue table: name | size | status badge (Waiting / Uploading / Uploaded / Failed) | remove.
- Footer: Clear list + "Upload N files".
- Inline errors instead of `alert`.
- Keep the sequential upload and redirect on success; don't redirect if any file failed.

### 04 — Auth and account

Build `Tabs` in `components/ui/` in this slice (first use: the profile modal). Slice 05 reuses it.

- **`AuthLayout`:** centred 400px card on `#f8fafc`, logo + name above.
- **`PASSWORD_RULES`:** duplicated in Register, ChangePassword and the profile modal → move into `utils/passwordRules.ts` + a `PasswordChecklist` component (same rules: 10+, upper, lower, number, special).
- **Login:** "Sign in"; email; password with show/hide; backend errors shown as-is (pending vs unverified); footer "Request access". Remove D9 items. Add "Password reset flow" to `docs/BACKLOG.md`. Redirect logic unchanged (`mustChangePassword` → `/change-password`).
- **Register:** "Request access"; checklist; success state mentions the verification email and admin approval.
- **ChangePassword** and **VerifyEmail:** restyled in `AuthLayout`.
- **Profile modal:** `Modal` + `Tabs` Profile / Security.
  - Profile: name, email (re-verification hint), role badge, Discard / Save. Remove Language & Region.
  - Security: change password + checklist, "Sign out of this session", "contact an administrator" note. Remove devices and 2FA.

### 05 — Admin shell, Projects, Users, Pending

**Admin layout:** `PageHeader` "Admin settings" + `Tabs` (Projects, Users, Pending approvals with count badge via `getPendingUsers`, Recycle bin, Archive, Filter settings) + toolbar + table. Rebuild `AdminTabs` on `Tabs`.

**Projects**
- Client-side search; "New project"; table Name | Members | Created | Actions (Manage members, Rename, Archive, Delete).
- **Delete copy is wrong today** ("permanently remove"). Fix it to: "The project and its documents will move to the recycle bin… 30 days." Show the archived 409 inline.
- Archive modal: confirm → progress → missing-files result.
- Manage members: "Current members" + "Add members" (search, staged checkboxes, "Already a member"); keep the staging logic.

**Users**
- Search; Role / Status / Sort `Dropdown`s; "Create user".
- Table: checkbox | Name (avatar) | Email | Role badge | Status badge | Joined | Actions. Keep shift-click range selection and the bulk delete bar.
- Create user copy: "They'll be asked to set their own password."
- Change role copy: User = "Can view, upload and delete documents in projects they're assigned to"; Admin = "Full access to all projects, documents, users and settings."
- **Delete user copy must warn:** "Their account and every document they uploaded will be permanently deleted. This can't be undone." (single and bulk)

**Pending**
- Segmented Pending (N) / Rejected (N). Replace the avatar-as-checkbox with `Checkbox`; keep shift-click.
- Pending: Approve / Reject. Rejected: Approve / Delete. Bulk equivalents.
- `ConfirmDialog` for reject and delete. Refresh the tab badge after actions.

### 06 — Recycle bin, Archive, Filters, Jobs

**Recycle bin**
- Refresh button; segmented Documents (N) / Projects (N).
- Documents table: Document | Project | Deleted by | Deleted | Expires ("in N days"; amber ≤7, red ≤2) | RESTORE / DELETE. Restore is disabled when `!restorable`.
- If `requiresProjectChoice`, show a "Restore to which project?" modal.
- Projects table with an "Archived" badge (`isArchived`, keep its tooltip): VIEW (drill-in with back link), RESTORE, DELETE.
- Bulk restore/delete by looping the existing single-item calls. Empty states.

**Archive**
- Search. Table: Project | Archived (date + by) | Documents | Members | Size | DOWNLOAD ZIP / RESTORE / DELETE.
- `operation` → amber "Archiving… / Restoring… / Deleting…" badge, actions disabled.
- Restore result reports `restoredDocuments` + `missingDocuments`.
- Delete copy: "Move to the recycle bin… 30 days".

**Filter settings**
- "N / 5 filters"; max-5 warning disables the add form.
- Table: Name | Type badge | Created | Edit / Delete.
- Inline edit warns when the type changes ("removes values already entered").
- Delete via `ConfirmDialog` (replace `window.confirm`). Add row below the table. No reordering (no API).

**Jobs** (mock)
- Restyle `Jobs`, `JobsTable`, `JobDrawer`.
- One info `InlineAlert`: "Preview — background processing arrives in Phase 6. Sample data." (the current banner wrongly says Phase 3).
- Remove `ComingSoonToast` and the dead toolbar icons.

### 07 — Clean-up

- Remove the legacy token aliases (zero usages, grep first), every remaining `dark:` class, `ComingSoonToast` if unused, unused components and helpers, remaining native dialogs, and hard-coded hex values where a token exists.
- Delete the `stitch_docindex_construction_document_manager/` folder and `stitch_docindex_construction_document_manager.zip` from the repo root. Check that nothing references them.
- Click through every route and modal as an admin and as a user.
- Update `docs/project-plan.md` Known Technical Notes and `copilot-instructions.md` UI Rules.
- Add to `docs/BACKLOG.md`: retry-processing endpoint, register PDF, custom filter values as table columns, document list pagination, password reset, user-delete cascade fix.

### Referenced file: `stitch_docindex_construction_document_manager/DESIGN.md` (verbatim)

````markdown
---
name: StructureGrid
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#3e4947'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#6e7977'
  outline-variant: '#bdc9c6'
  surface-tint: '#006a63'
  primary: '#005c55'
  on-primary: '#ffffff'
  primary-container: '#0f766e'
  on-primary-container: '#a3faef'
  inverse-primary: '#80d5cb'
  secondary: '#565e74'
  on-secondary: '#ffffff'
  secondary-container: '#dae2fd'
  on-secondary-container: '#5c647a'
  tertiary: '#7d4200'
  on-tertiary: '#ffffff'
  tertiary-container: '#a15600'
  on-tertiary-container: '#ffe6d5'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#9cf2e8'
  primary-fixed-dim: '#80d5cb'
  on-primary-fixed: '#00201d'
  on-primary-fixed-variant: '#00504a'
  secondary-fixed: '#dae2fd'
  secondary-fixed-dim: '#bec6e0'
  on-secondary-fixed: '#131b2e'
  on-secondary-fixed-variant: '#3f465c'
  tertiary-fixed: '#ffdcc3'
  tertiary-fixed-dim: '#ffb77d'
  on-tertiary-fixed: '#2f1500'
  on-tertiary-fixed-variant: '#6e3900'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: -0.01em
  body-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: -0.005em
  body-md-medium:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: -0.005em
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0em
  data-mono:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-header:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.04em
  label-badge:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.02em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 0.75rem
  margin: 1rem
  space-xs: 0.25rem
  space-sm: 0.375rem
  space-md: 0.5rem
  space-lg: 0.75rem
  space-xl: 1rem
---

## Brand & Style

This design system targets commercial construction project managers, estimators, structural engineers, and field operations directors. The interface evokes precision, structural integrity, and executive clarity. It balances the density and immediate utility of classic spreadsheet software like Excel and Airtable with the refined typographic craft of modern engineering software.

The design movement is **Precision Functionalism**: pure optical clarity, rigid grid discipline, zero skeuomorphic distraction, and pure white canvases without yellowed or sepia-tinted undertones. Contrast is purposeful, signaling state transitions, numeric variances, and structural dependencies with mathematical fidelity.

## Colors

The palette establishes an ultra-clean, clinical workspace optimized for prolonged analytical work.

- **Primary (`#0f766e` - Deep Emerald Teal):** Signifies precision, completed calculations, primary actions, and confirmed status. It avoids the generic blue of generic enterprise tools while projecting authority and stability.
- **Secondary (`#0f172a` - Slate 900):** Anchors high-priority data points, primary headings, sheet titles, and core numeric readings.
- **Tertiary (`#d97706` - Amber/Ochre):** Reserved strictly for structural warnings, schedule variances, change order flags, and pending approvals.
- **Neutral Surface Palette:**
  - Base canvas: `#ffffff` (pure white, zero tint)
  - Sub-surface / table header fills: `#f8fafc`
  - Subtle gridlines and borders: `#e2e8f0`
  - Secondary text / column headers: `#64748b`
  - Body data and field entries: `#334155`
  - High-emphasis labels: `#0f172a`

Color application is strictly utilitarian: grid lines remain locked to `#e2e8f0` at 1px thickness; status fills use muted pastel tints (e.g., `#f0fdf4` for active, `#fffbeb` for pending review) paired with their corresponding saturated text tokens.

## Typography

The type scale relies entirely on Inter, leveraging its geometric consistency, tall x-height, and open counters to achieve complete legibility at dense 11px–13px data scales.

- **Data Cells & Numeric Formats:** All numeric columns (quantities, linear footage, cost estimations, tolerances) utilize CSS OpenType tabular figures (`font-feature-settings: 'tnum' 1, 'cv05' 1`) to ensure vertical alignment of decimal points across rows.
- **Column Headers:** Configured in `label-header` at 11px uppercase with `letterSpacing: 0.04em` to distinctly separate structural schema metadata from data payload rows.
- **Hierarchy Rules:** Sheet and view titles top out at 24px (`headline-xl`). Scale increases are purposefully compressed to preserve screen estate for grid visibility.

## Layout & Spacing

The layout employs an edge-to-edge functional framework configured around maximum visual density and instant cell navigation:

- **App Shell Structure:** A fixed 48px global utility toolbar, followed by an adjustable 36px contextual action bar (filters, grouping, view presets, sorting), anchoring directly above a fluid virtualized spreadsheet canvas.
- **Grid Density Rules:**
  - Standard row height: 32px (8px vertical padding, 16px line height).
  - Compact row height (field log / takeoff view): 26px.
  - Column header height: 28px.
  - Inner cell horizontal padding: `space-md` (8px).
- **Responsive Adaptations:**
  - **Desktop (1280px+):** Full multi-pane spreadsheet with pinned columns, frozen header rows, and collapsible right-hand inspection drawer (360px fixed).
  - **Tablet (768px–1279px):** Auto-collapsing sidebars into icon-only rails; grid supports horizontal smooth panning with fixed identifier columns (e.g., Spec Code, Task Name).
  - **Mobile (<768px):** Reflows individual row items into structured card records, locking `margin` to 12px with stacked metric summaries.

## Elevation & Depth

Visual hierarchy does not rely on diffused drop shadows or blurred planes; depth is created using structural lines, boundary clipping, and precise micro-borders.

- **Base Flatness:** The primary grid canvas, pinned column boundaries, and nested sub-rows use zero box-shadow. Visual separation is maintained strictly with 1px borders in `#e2e8f0`.
- **Pinned Columns & Sticky Headers:** Delimited using a 1px solid `#cbd5e1` right-border combined with a micro drop line (`0 1px 2px rgba(15, 23, 42, 0.04)`).
- **Floating Overlays & Popovers:** Dropdowns, formula builders, date pickers, and filter modals employ a crisp outline (`1px solid #cbd5e1`) alongside a controlled, minimal shadow: `0 4px 6px -1px rgba(15, 23, 42, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.04)`.
- **Active / Focused Cell Selection:** Signified by a 2px outline in `#0f766e` with an inset `0 0 0 1px #ffffff` highlight ring, preserving absolute clarity without obscuring bordering data cells.

## Shapes

The design uses tight, technical corners (`roundedness: 1`, 0.25rem / 4px) to preserve data alignment and emulate high-precision CAD and professional engineering tools.

- **Spreadsheet Grid Cells:** 0px radius (sharp corners) to form continuous, uninterrupted grid lines.
- **Buttons, Form Controls, and Search Inputs:** 4px radius (`rounded-sm`).
- **Contextual Badges & Phase Tags:** 3px radius to sit comfortably within 32px and 26px row heights without feeling circular or casual.
- **Drawers & Modals:** 6px radius max on floating panels; 0px along edge-docked inspection drawers.

## Components

- **Spreadsheet Data Table:**
  - Header cells: `#f8fafc` background, 1px border `#e2e8f0`, text in `#64748b` uppercase 11px font with interactive sort/filter icons appearing on hover.
  - Alternating/Hover states: Default row `#ffffff`, hover row `#f8fafc`, multi-row selection `#f0fdfa`.
  - Cell editing: Direct inline edit mode with `#ffffff` fill, 2px `#0f766e` border, and automatic cursor retention.

- **Buttons:**
  - Primary: `#0f766e` fill, white text, 4px corner radius, 28px height (compact tool mode) or 32px height (global actions). Hover state: `#115e59`.
  - Secondary/Outline: `#ffffff` fill, 1px `#e2e8f0` border, `#334155` text. Hover state: `#f8fafc` with border `#cbd5e1`.
  - Destructive: `#ef4444` text with `#fee2e2` hover fill.

- **Status & Phase Chips:**
  - Compact 20px height, 3px border radius.
  - Active / On-Schedule: `#f0fdf4` surface, `#15803d` text, 1px border `#bbf7d0`.
  - Delay / RFI Pending: `#fffbeb` surface, `#b45309` text, 1px border `#fde68a`.
  - Critical / Structural Issue: `#fef2f2` surface, `#b91c1c` text, 1px border `#fecaca`.

- **Form Fields & Inputs:**
  - Background `#ffffff`, border 1px `#e2e8f0`, text `#0f172a`. Height 30px.
  - Focus state: Border color `#0f766e`, subtle ring `0 0 0 1px #0f766e`.

- **Checkboxes:**
  - Square 14px size, 2px radius, 1px border `#cbd5e1`. Active checked state: `#0f766e` background with pure white SVG checkmark.

- **Formula & Takeoff Summary Bar:**
  - Fixed horizontal strip pinned above the table footer. `#f8fafc` background with 1px top border `#e2e8f0`. Displays instant calculations: Total Volume, Linear Run, Man-Hours, and Net Budget formatted in tabular monospace digits.
````

### Referenced file: `stitch_docindex_construction_document_manager/screen.png` (description of the slice-02 Documents page body)

- **Toolbar** (one row of compact white controls with 1px borders):
  - **Left:** "Project: All Projects ▾" (muted key, dark value). Then "Filter" with a tune icon and a small count pill ("2"). Then "Sort: Date Uploaded (Newest) ▾".
  - **Right:** muted "Showing 12 documents", then an "Export CSV ▾" button with a download icon. The requirement relabels it as the Export menu.
- **Chips row:** rectangular chips with a pale fill. Each has a muted key, a dark value and a small "×": "Project: Riverside Housing ×" and "Supplier: Northfield Aggregates ×". They're followed by a teal uppercase "CLEAR ALL" text button.
- **Table** (a white card with a 1px border, square cells, horizontal gridlines only):
  - **Header row:** pale fill, with a checkbox column first. The labels are uppercase muted 11px: "DOCUMENT", "STATUS", "UPLOADED BY", "DATE UPLOADED ↓" and a right-aligned "ACTIONS". The teal down arrow marks the active sort.
  - **Row cells:** a checkbox, then the file name (dark, medium weight) with the size underneath (small, muted, e.g. "412.4 KB"). Next is a status badge with a leading dot (teal "Processed", amber "Processing", red "Failed (OCR Error)"), then the uploader email, then a muted date-time ("12 Oct 2026 14:22").
  - **Actions:** right-aligned. A teal "PREVIEW" and a muted "DOWNLOAD" are separated by a light "/". The failed row shows only a red "RETRY OCR". Per D6, the requirement makes this "RETRY" + "DOWNLOAD".
  - **Height:** rows render at about 40px because of the two-line Document cell (see Q1). The card ends after the last row, with white space below.
- **Summary bar:** a separate pale strip directly below the table.
  - **Left:** "Total: **12 files** • **15.4 MB** stored • ● Last sync 2m ago", with a teal dot and teal text on the last part.
  - **Right:** "☁ Indexed & Synced", muted.
  - Per D5 and Q2, the requirement replaces these with "Updated HH:MM" and the real indexing indicator and failed link.
- **Not shown in the screenshot:** the bulk bar, filter popover, export menu, preview modal and export modal. They follow `DESIGN.md` (overlays: 1px `#cbd5e1` border, small shadow, 6px radius) and the requirement text.

## Domain Concept Identification

### Existing Concepts (from codebase)

- **Document list row** (`GET /documents`): id, project id and name, original file name, MIME type, size in bytes, upload time, status, error message and uploader email. Results are capped at 50, ordered by one of five sort keys, with no pagination. Soft-deleted documents and documents in non-live projects are excluded server-side. Rows carry no custom filter values, page count or text.
- **Document detail** (`GET /documents/:id`): adds page count, a 150-character text preview and custom filter values. Only values that were entered are returned, each with the definition's name and type. DATE values come back as ISO strings. It does **not** return the project name or uploader email (A4).
- **Extracted text** (`GET /documents/:id/text`): the full text. It returns 404 ("No extracted text available") when none exists, for example a failed PDF or an image whose OCR found nothing or failed (A4).
- **UI document** (`types.ts` plus `convertApiDocument` in `Documents.tsx`): a display model with pre-formatted strings. Size reads like "412.4 KB". The date is US-formatted with no time ("Oct 12, 2026"), which breaks the en-GB date-time rule. It drops `projectName`, `sizeBytes` and `uploadedAt`. `Search.tsx` builds its own instances by hand (A1).
- **Document status and the processing pipeline:** five statuses, with labels, badge tones and dots shared through `statusTones.ts` (slice 01). The upload request runs Uploaded → Processing → Processed or Failed synchronously. Queued is never set. A failed image OCR is logged and the document still ends up Processed. Failed documents carry a `pdf-parse` or storage error message, and a failed storage write can leave no file to preview or download (A2, D6).
- **Status counts** (`GET /documents/status-counts`): a count per status for the same project, keyword and custom filters as the list. Status and sort are ignored, and the counts aren't capped at 50. The shell already calls it unfiltered for the sidebar, refreshing only when the pathname changes. This slice adds a second, filtered call for the summary bar (Q2, A2).
- **Status filter** (`?status=`): single-select, owned by the URL. The sidebar writes it and the Documents page reads it. Unknown values are ignored. Today, opening or closing a preview drops it (Q5).
- **Project scope** (`GET /projects`): projects the caller can see. The server ignores the `scope` parameter, so admins see every live project and users see their memberships. The selection persists in `sessionStorage` under `documents:selectedProject`, where a legacy stored label "All Projects" means all projects.
- **Keyword filter** (`mainFilter`): a contains-match on the file name or extracted text, applied server-side.
- **Custom filter definitions** (`GET /filters`): up to 5 (`MAX_ACTIVE_FILTERS`), each with a name, a type (TEXT, NUMBER or DATE) and an `order`. TEXT and NUMBER filters send a single value; DATE filters send from/to bounds.
- **Sort key** (`sortBy`): `upload-newest`, `upload-oldest`, `name-asc`, `name-desc` and `status`. `status` has one direction only: alphabetical by the stored enum name (Failed, Processed, Processing, Queued, Uploaded), then newest first.
- **Soft delete and the recycle bin:** deleting sets `deletedAt`, moves the file to the deleted area and writes a deletion log. Admins can restore for 30 days (`DELETION_RETENTION_DAYS`). Bulk delete loops over single deletes and returns the deleted count plus the failed ids. A delete fails for documents outside the caller's scope, or in a project that is being archived (not writable).
- **Single download and blob preview** (`api/exports.ts`): fetches the file with the auth header and the file name from `Content-Disposition`. It hard-codes the base URL (Q6).
- **ZIP export** (`POST /exports`, `ExportModal`): packages the given ids, and needs at least one.
- **Signed-in user:** loaded once by `AppShell` from `/auth/me` and used for the header and the admin link. Pages can't see it today (Q4). `AdminGuard` and `ProfileSettingsModal` each make their own call.
- **Shared UI primitives** (slice 01, `components/ui/`): Button and ButtonLink, IconButton, Badge, StatusBadge, Avatar, Dropdown, Input, Checkbox, Spinner and InlineAlert, plus the `buttonStyles` and `statusTones` helpers.
  - Dropdown is a listbox with a "Label: Value" trigger, a check on the selected option, dividers and a footer. It closes on an outside click and on Escape (stopping propagation), and its list has no maximum height.
  - Checkbox is 14px with an indeterminate state, and nothing uses it yet.
- **Design tokens and UI Rules:** role-based colour, type, radius, shadow and z-index tokens in `tailwind.config.js`. The written rules in `.github/copilot-instructions.md` cover portals, focus, Escape, native dialogs, copy and dates.
- **Search page** (slice 03 scope): uses `BulkActionBar` (count, export, delete, clear), `ExportModal` (open state, close, ids) and the UI `Document` type (A1).

### New Concepts Required

- **Applied filter set and draft filter set:**
  - The page owns the *applied* values: project, keyword and custom filter values. These drive fetching.
  - The filter popover edits a *draft* copy. Apply or Enter commits it, and Escape or an outside click discards it.
  - "Clear all" resets both the draft and the applied values (A3).
  - The toolbar's Project dropdown changes the applied project directly.
- **Active filter chips:** a derived, removable view of the applied filters plus the URL status.
  - Labels use the new wording: "Keyword: X", "<Filter>: value", en-GB date ranges and "Status: X".
  - The chips row's "Clear all" also clears `?status=` (A3).
- **Applied filter count:** the number of applied popover fields, shown on the Filter button (A3).
- **Column sort view:** the table header's view of the single sort key. Document toggles between name ascending and descending, Date toggles between newest and oldest, and Status has one direction. It shares one source of truth with the Sort dropdown and shows `aria-sort` and an arrow.
- **Row selection:** a set of ids from the loaded rows, with select-all and an indeterminate state. It's cleared whenever the applied filters or sort change and after a delete. It survives opening a preview (Q5).
- **List snapshot:** the result of one fetch cycle.
  - It includes the rows, the filtered status counts, the time of the last successful fetch ("Updated HH:MM"), the true matching total, the loaded size total and whether the list is capped (Q2).
  - The rows and counts always describe the same applied filters.
- **Indexing indicator:** derived from the filtered counts. It shows either "Indexing N documents" (amber; Uploaded + Queued + Processing, A2) or "All documents indexed" (teal), plus a red "N failed" link that sets `?status=FAILED`.
- **CSV register export:** client-side serialisation of the shown or selected rows (D8).
  - The column set is fixed and uses RFC 4180 escaping.
  - It neutralises formula injection and adds a UTF-8 BOM.
  - Lines end in CRLF, and the file name is dated.
- **Actions waiting on the backend:** "Retry" on failed rows (D6) and "Generate register PDF" (D7). Each is a named handler whose body is only a `TODO(backend)` comment.
- **Shared current user** (Q4): the shell-owned identity, shared with pages through context. The role is "unknown" while it loads.
- **Preview record** (A4): one view assembled from four sources.
  - The list row supplies the project and uploader.
  - The detail supplies pages and custom values.
  - The text endpoint supplies the full extracted text.
  - The file blob supplies the visual preview.
  - The filter definitions supply the complete custom-field list.
- **Slice-02 shared components:** Modal, ConfirmDialog, Popover, Menu (Q3), Chip, Table primitives, EmptyState, SummaryBar, TextAction, FormField and Select. Each is built in `components/ui/` because this page is its first consumer.
- **Shared date formatting:** one en-GB formatter for "12 Oct 2026" and "12 Oct 2026 14:22", reused by later slices.

### Key Business Rules

- **Visibility is server-enforced** (list, counts, detail, text): the UI never implies access beyond what the server returns. Non-admins see only their projects' documents, and soft-deleted documents never appear.
- **The 50-row cap is stated honestly** (list snapshot): the cap message shows only when the true matching count is over 50. When capped, the size is labelled as covering the rows shown (Q2).
- **Status is single-select and lives in the URL** (status filter): the "N failed" link sets it, the status chip and the chips row's "Clear all" clear it, and previews preserve it (Q5).
- **Draft edits don't fetch** (filter sets): only Apply, Enter, chip removal, "Clear all", the Project dropdown, sort changes and URL status changes start a fetch.
- **Selection resets when the result set changes** (row selection): any change to applied filters, status or sort clears it, as does a delete. Opening or closing a preview doesn't.
- **Deletion copy matches what happens** (soft delete): selected documents go to the recycle bin, and an admin can restore them for 30 days. Partial failures are reported inline with counts, and only rows that were actually deleted leave the list.
- **Admin-only UI is absent for non-admins** (shared current user): the "Manage projects" footer is rendered only once the role is confirmed as ADMIN. It's absent while the role loads and if loading fails.
- **No native dialogs** (all touched files): `ConfirmDialog` replaces `window.confirm`. `InlineAlert` replaces `window.alert`, for download, ZIP export and partial delete failures.
- **Copy and format** (all text): UK English and sentence case, en-GB dates and date-times, and `tabular-nums` for every number, size, date and count.
- **CSV is safe to open in a spreadsheet** (CSV export): any value starting with `=`, `+`, `-` or `@` gets a leading `'`. Values are escaped per RFC 4180.
- **Backend-less features are wired but inert** (Retry, register PDF): the control is visible and calls a named handler. There's no "coming soon" copy.
- **Implicit: a stale project choice falls back to all projects** (project scope): if the stored project id isn't among the projects the user can see (membership removed, project archived or deleted), the page uses "All projects". Otherwise a chip would mislabel an empty result.
- **Implicit: the counts and the list must agree** (list snapshot): both requests use the same applied filters, and a response for superseded filters is never shown.
- **Implicit: after a delete, the list is re-read rather than trimmed locally** (list snapshot): when the list was capped, documents beyond the first 50 should move up. The counts and total must also change.
- **Implicit: Search keeps working** (shared components): `Search.tsx` compiles and behaves as before, with only the visual change from the shared components (A1).

## Strategic Approach

### Solution Direction

- **Components first, on first use.** Build the slice-02 component set in `components/ui/`, export it from the barrel, and have each component own its styling and accessibility.
  - `Modal` and `ConfirmDialog` portal to `document.body`. They focus the first focusable element, trap Tab and Shift+Tab, close on Escape and return focus to the trigger. They sit at z-index 50 and 60.
  - `Popover` stays anchored to its trigger at z-index 40 and closes on an outside click or Escape. `Menu` builds on it (Q3).
  - The table primitives cover the bordered scroll container, a sticky 28px header (z-index 10), sortable header cells with an arrow and `aria-sort`, and rows with hover and selected states.
  - `Select` is a styled native select, used for the Project field inside the popover.
  - The remaining primitives are FormField, Chip, TextAction (teal, muted and danger tones), EmptyState and SummaryBar.
  - Extend `Dropdown` with a scrollable list height for long project lists, rather than duplicating it.
- **Then the page.** `Documents.tsx` keeps orchestration only: applied filters, URL status, sort, selection, the list snapshot, and error and retry. Rendering is delegated to the toolbar, filter popover, chips row, `DocumentTable`, summary bar, `BulkActionBar`, `DocumentPreviewModal` and `ExportModal`, all built on the shared components.
- **Data flow.** A change to applied filters, URL status or sort triggers one fetch cycle. The list and filtered status counts are requested in parallel with the same inputs, and the cycle ignores responses from superseded cycles. The result is one consistent snapshot, which feeds the table, toolbar count, summary bar and indexing indicator. CSV export reads the snapshot rows. Deletes start a fresh cycle.
- **Compatibility seam with Search** (A1): `BulkActionBar` and `ExportModal` keep their existing props, and new actions are optional. The new UI `Document` fields are optional. `Search.tsx` isn't edited.
- **Small, non-visual changes outside the page:**
  - The shell shares its loaded user through context (Q4).
  - `api/exports.ts` takes the shared base URL (Q6).
  - The UI `Document` type gains optional raw fields.
  - A shared date formatter and `utils/csv.ts` are added.
- **Documentation.** Add short notes on the new components to the UI Rules section of `.github/copilot-instructions.md`:
  - `Dropdown` is for picking a value and `Menu` is for actions.
  - Tables use the table primitives.
  - Empty and loading states use `EmptyState` and skeleton rows.

  Backlog entries for the TODO(backend) items stay in slice 07's scope.

### Key Design Decisions

- **Row height (Q1):** a strict 32px fits only one line, but the screenshot shows two. → **Use 32px as a minimum and let the two-line Document cell set the height (about 40px). The header row stays 28px.** The screenshot is the source of truth for layout.
- **Totals when capped (Q2):** counting the loaded rows is simple but understates the total once the list is capped. → **Take the total from the filtered status counts, and label the size as covering the loaded rows when capped.** The copy stays accurate, at the cost of one extra request per fetch cycle.
- **Action menu (Q3):** overloading `Dropdown` would mix listbox and menu semantics, and hand-rolling the menu in the page would break ground rule 3. → **Add `Menu` on top of `Popover`.** It's reusable for later action menus.
- **Role awareness (Q4):** the page could call `/auth/me` itself, but that's a third duplicate call that could disagree with the shell. → **Share the shell's user through context.** One source of truth, and no change to the shell's appearance.
- **Preview URL (Q5):** preserving the query string changes existing navigation, but it's what makes the status filter, the "N failed" link and the selection-reset rule behave correctly. → **Preserve it on open and close.**
- **Export base URL (Q6):** leaving it would ship a redesigned page whose preview, download and ZIP export break outside localhost. → **Fix the base URL only.** The contracts are unchanged.
- **Draft/apply model:** keeping the draft in the popover and the applied values in the page gives fewer requests and clean discard semantics. The cost is that the two sets must not drift: opening the popover always starts the draft from the applied values. → **The page owns the applied values and the popover owns a disposable draft.**
- **Single sort source:** the header cells and the Sort dropdown read and write the same sort key, so they can't disagree. Status shows a single ascending state because the backend has one direction.
- **Stale-response guard:** without it, fast header clicks or chip removals can leave the table showing results for older filters. → **Every fetch cycle discards responses from superseded cycles.**
- **Loading presentation:** a skeleton on every refetch flickers, and a spinner hides the data. → **Show the skeleton when there are no rows to show yet (first load, or after an error). During later refetches, keep the current rows visible with a busy state.** This is to be confirmed in the canvas (see Requirement Ambiguities).
- **Layout of the table area:** the table card sizes to its content, as in the screenshot, until it reaches the available height. Then rows scroll under the sticky header, and the summary bar stays directly below the card. While the floating bulk bar is visible, space is reserved at the bottom so it never covers the last row or the summary bar.
- **Two count sources on screen:** the sidebar shows unfiltered counts (shell, slice 01) and the summary bar shows filtered counts (this slice). This is intentional. The sidebar isn't refreshed after a delete, because the shell refreshes on navigation only. That existing behaviour is left as it is.

### Alternatives Considered

- **Show "Total" and size from the loaded rows only:** rejected (Q2), because the copy would be inaccurate when the list is capped.
- **A menu mode on `Dropdown`, or a page-local export menu:** rejected (Q3), because of mixed semantics and rule 3.
- **Documents calls `/auth/me` itself, or infers admin from the project list:** rejected (Q4). The first adds a duplicate request, and the second is unreliable because users can belong to every project.
- **Required new `Document` fields, with `Search.tsx` updated:** rejected (A1). Editing Search would make it a touched file, which would pull slice 03's native-dialog and token rules into this slice.
- **Keep filtering live on every keystroke:** rejected by the requirement's draft/apply behaviour change.
- **Put the filter state in the URL:** out of scope. The current behaviour (project in `sessionStorage`, other filters in page state, only status in the URL) is kept.
- **Use `textPreview` for the extracted-text area:** rejected (A4), because it's only 150 characters.
- **Server-side CSV:** rejected. The slice is frontend only (D8).
- **Virtualise the table:** unnecessary with 50 rows or fewer.
- **Leave `exports.ts` for later:** rejected (Q6), because the slice's own features depend on it.

## Risk & Gap Analysis

### Requirement Ambiguities

All the questions raised at review are settled (see Resolved Questions). These smaller points remain for the canvas. Each has a recommended reading.

- **Loading state on refetch:** "Loading skeleton" doesn't say when. → Use the skeleton only when there are no rows yet. Later refetches keep the rows with a busy state.
- **Status header direction:** the backend's `status` sort has one direction, alphabetical by enum name (Failed, Processed, Processing, Queued, Uploaded), not lifecycle order. → The header shows a single ascending state and doesn't toggle. The Sort dropdown label stays "Status".
- **Export menu trigger label:** the screenshot says "Export CSV", but the menu also holds ZIP and PDF actions. → Label it "Export".
- **Open-ended DATE chips:** the requirement shows only a full range. → Use "From 01 Oct 2026" and "Until 12 Oct 2026" for one-sided ranges.
- **Bulk bar "Export CSV":** → It exports the selected rows, the same as the menu's "Export selected as CSV".
- **Preview for failed documents:** → Show the error in an `InlineAlert`, and still attempt the file preview. If the file is missing, the preview area shows its own error state.
- **Dates in custom fields:** DATE values are ISO strings. → Show them as en-GB dates in the preview and in chips.
- **Duplicate counts under the cap:** "Showing N documents" and "Total: N files" both appear, as in the screenshot. → Accept the duplication.

### Edge Cases

- **Exactly 50 matching documents:** no cap message, because the true count isn't over 50 (Q2). If the counts request fails, the fallback can't tell whether the list is capped, so it shows the cap message when exactly 50 rows come back.
- **Status filter active:** the counts ignore status, so Total uses that status's count (Q2). The indexing indicator still reflects every status under the other filters.
- **Stored project no longer visible:** fall back to "All projects", so no mislabelled chip appears.
- **Project list fails to load:** the Dropdown offers only "All projects". The page still works, and the error is logged as it is today.
- **Filter definition deleted or retyped while applied:** chips and the applied count include only definitions that still exist. A DATE value left over from a retyped TEXT filter must not render as a broken chip.
- **Deep link to a document outside the list or out of scope:** if it exists, the preview opens with "—" for Project and Uploaded by (A4). If the server returns 404, today's behaviour is kept: no modal opens.
- **Partial bulk delete:** documents in a project that is being archived, or no longer in scope, fail. The `InlineAlert` reports the deleted and failed counts, and the list and counts are re-read.
- **Deleting rows when the list was capped:** re-reading the list brings in the next documents, so the table never shows fewer rows than are available.
- **Failed document with no stored file:** download and preview fail cleanly with an inline error.
- **Image or failed document with no extracted text:** the 404 becomes a neutral "No extracted text" state, not an error.
- **Very long extracted text:** it sits in its own scroll area, so the modal footer stays reachable.
- **CSV values starting with a tab or carriage return:** the requirement lists only `=`, `+`, `-` and `@`. OWASP also lists tab and CR. Prefixing those too is a cheap safety margin for the canvas to decide on. File names starting with `-` will show a leading `'` in spreadsheets, which is the accepted trade-off.
- **Non-ASCII file names in CSV:** the UTF-8 BOM keeps Excel from garbling them.
- **Escape inside the popover while a native date picker or select is open:** the browser closes its own picker first. A second Escape closes the popover and discards the draft.
- **Dropdown inside a Modal, or ConfirmDialog over a Modal:** the innermost overlay closes first. Dropdown already stops Escape from propagating. ConfirmDialog sits at z-index 60 and returns focus inside the modal.
- **Many projects:** the Dropdown list needs a maximum height with scrolling so it stays within the viewport.
- **Bulk bar overlap:** reserve bottom space while the bar is visible.
- **Invalid `?status=` value:** ignored, so it produces no chip and no filter, as today.
- **Selection then sort:** sorting clears the selection, per the rule.
- **Search page:** the restyled bulk bar shows only Download ZIP and Delete there. Search's own confirm and alert calls remain until slice 03 (A1).
- **Sidebar counts after a delete:** they stay stale until the next navigation, which is existing behaviour. The summary bar updates straight away.

### Technical Risks

- **Ripple into Search through shared components** (A1): changing a prop on `BulkActionBar`, `ExportModal` or `Document` breaks the Search build. → Keep the props backward-compatible. Let `npm run build:full` catch drift, and check the Search bulk bar and export modal by hand.
- **Out-of-order responses and list/count mismatch:** more triggers now refetch. → Use one fetch cycle per change and discard superseded responses.
- **Focus trap and portal correctness with no test runner** (A5): the Tab wrap, focus return, Escape order and focus inside a portal are easy to get subtly wrong. → Write a manual keyboard script for Modal, ConfirmDialog, Popover and Menu, and run it in the browser. Browser automation in the dev environment can repeat it.
- **Sticky header with collapsed borders:** a sticky `th` with `border-collapse` can lose its bottom border while scrolling. → Draw the header divider in a way that survives sticky positioning, and check it while scrolling.
- **`@tailwindcss/forms` and the 14px Checkbox:** this is the first time its checked, indeterminate and focus-ring styles are seen at this size. → Check them visually in the table header and rows.
- **Fitting the layout at 1280px:**
  - The content width is about 1088px. The toolbar holds the project trigger, Filter, Sort, the cap message and Export, and can wrap. Long project names and emails can stretch columns.
  - → Truncate long project names in the trigger, and long file names and emails in cells (with `title`). Let the toolbar's right group wrap neatly. Check at 1280px and 1440px.
- **en-GB date formatting** (verified with ICU 78): the built-in en-GB format gives "12 Sept 2026" and "12 Sept 2026, 14:22". That's a four-letter September and a comma before the time, so it breaks the required "12 Oct 2026" and "12 Oct 2026 14:22" patterns. → The shared date formatter must assemble the parts itself, with fixed three-letter months and no comma, and every later slice must reuse it.
- **Context added to a remounting shell** (Q4): the shell remounts between admin and non-admin routes, so the shared user is briefly unknown after each remount. → The page treats unknown as non-admin, so the footer is absent.
- **CSV correctness without unit tests:** the escaping and injection rules are easy to get wrong. → Keep the CSV helper pure and dependency-free, and check it by hand with tricky names: commas, quotes, newlines, leading `=`/`-`, and non-ASCII.
- **`exports.ts` change** (Q6): if production builds don't set `VITE_API_URL`, the default stays `http://localhost:3000`, so behaviour is the same as today. If they do set it, preview, download and ZIP start working there. The contracts are unchanged.
- **Popover height:** with 5 custom filters in 2 columns, the popover is about 350px tall, which fits under the toolbar at common laptop heights. It must not be clipped by the page's `overflow-hidden` frame. → Check at 1280×720.

### Acceptance Criteria Coverage

The requirement has no numbered ACs. The rows below are drawn from the slice 02 specification, the "Progress so far" section, the ground rules and the decisions.

| AC# | Description | Addressable? | Gaps/Notes |
|-----|-------------|--------------|------------|
| 1 | Page body matches `screen.png`: toolbar, chips, table, row actions, summary bar; 28px header, 1px gridlines, uppercase 11px headers, teal uppercase text actions | Yes | Row height follows Q1 (32px minimum, about 40px with two lines). |
| 2 | Project `Dropdown`: All projects plus projects, check on selected, admin-only "Manage projects" footer → `/admin/projects`, `documents:selectedProject` kept | Yes | Role from the shell context (Q4). Stale stored project falls back to all projects. Dropdown needs a scrollable list. |
| 3 | Filter button with active-count badge | Yes | Counts the applied popover fields (A3). |
| 4 | Sort `Dropdown` with the same 5 `sortBy` values | Yes | Sentence-case labels. |
| 5 | "Showing N documents", or the cap message at 50, then the Export menu | Yes | Cap message only when the true count is over 50 (Q2). `Menu` component (Q3). |
| 6 | Filter popover: keyword, project, one field per custom filter in `order` (TEXT/NUMBER input, DATE from–to), 2 columns, "Clear all" + dark "Apply filters" | Yes | Project field uses `Select`, and fields use `FormField`. |
| 7 | Draft until Apply or Enter; Escape or outside click discards; Clear all resets draft and applied | Yes | Leaves `?status=` alone (A3). |
| 8 | Chips: Project, Keyword, custom values, en-GB date ranges, Status; each removable; teal "Clear all" also clears `?status=` | Yes | One-sided date ranges use the recommended wording (Ambiguities). |
| 9 | Table columns: checkbox, Document (name + size, no icon), Status, Uploaded by, Date uploaded, Actions | Yes | Date uploaded as an en-GB date-time with fixed three-letter months. |
| 10 | Row actions PREVIEW / DOWNLOAD; failed rows RETRY (danger, TODO(backend)) + DOWNLOAD | Yes | Always visible. Retry is a named handler with a TODO only (D6). |
| 11 | Sortable headers for Document, Status and Date, in sync with the Sort dropdown | Partial | Status has one direction only, because of the backend's single `status` sort. |
| 12 | Selection: select-all with indeterminate, selected highlight, checkbox clicks don't open the preview, cleared on filter or sort change; row click opens the preview | Yes | Survives previews because of Q5. Checkbox is checked for the first time. |
| 13 | Summary bar: "Total: N files • X MB stored • Updated HH:MM" | Partial | When capped, the size covers the loaded rows and is labelled that way (Q2). No endpoint gives a total size. |
| 14 | Indexing indicator ("Indexing N documents" amber / "All documents indexed" teal) + red "N failed" link setting `?status=FAILED`, from the filtered status counts | Yes | Uploaded + Queued + Processing (A2). In practice it's non-zero only during uploads or after a server failure. |
| 15 | Export menu: shown as CSV (N), selected as CSV (n), selected as ZIP (n) via `ExportModal`, divider, "Generate register PDF" (TODO(backend)) | Yes | Selected items are disabled when n = 0. |
| 16 | CSV: fixed columns, `YYYY-MM-DD HH:mm`, Size (KB), RFC 4180, formula-injection prefix, UTF-8 BOM, CRLF, `documents-YYYY-MM-DD.csv` | Yes | Local time (A5). Tab/CR prefixing is open for the canvas. |
| 17 | UI `Document` type and `convertApiDocument` keep `projectName`, `sizeBytes`, `uploadedAt` | Yes | The fields are optional (A1). |
| 18 | Floating dark bulk bar: "N selected", Download ZIP, Export CSV, Delete, ×; Delete via `ConfirmDialog` with recycle-bin copy; partial failure via `InlineAlert` | Yes | List and counts are re-read after a delete. |
| 19 | States: loading skeleton; error `InlineAlert` + "Try again"; empty "No documents yet" + Upload; empty with filters "No documents match these filters" + Clear filters | Yes | When the skeleton shows on refetch is open (Ambiguities). |
| 20 | Preview modal: name, size, `StatusBadge`; key/value grid (Project, Uploaded by, Date, Pages, custom fields with "—"); failed → `errorMessage` `InlineAlert`; preview + scrollable extracted text; Download + Close | Partial | Deep links outside the loaded list show "—" for Project and Uploaded by, because the backend detail lacks them (A4). |
| 21 | Export modal rebuilt on `Modal` | Yes | Same props, so Search benefits too (A1). |
| 22 | Build Modal, ConfirmDialog, Popover, Chip, Table primitives, EmptyState, SummaryBar, TextAction, FormField and Select in `components/ui/` | Yes | Plus `Menu` (Q3). All exported from the barrel. |
| 23 | Modal and ConfirmDialog: portal, focus first element, trap Tab and Shift+Tab, Escape, return focus; keyboard-tested in this slice | Yes | Tested by hand (A5). |
| 24 | Checkbox verified against `@tailwindcss/forms` (14px, teal checked, indeterminate) | Yes | Visual check in the table. |
| 25 | Touched files use only role-based tokens; no legacy classes, hard-coded `blue-*`/`gray-*`/`slate-*` or `dark:` | Yes | `AppShell` and `api/exports.ts` are touched but already compliant (no styling in `exports.ts`). |
| 26 | No `window.confirm`/`window.alert` in touched files | Yes | Covers delete, download, ZIP export and preview download. |
| 27 | Frontend only, no API contract changes, no new npm dependencies | Yes | `exports.ts` changes its base URL only (Q6). |
| 28 | Works at 1280px and 1440px | Yes | Check that the toolbar wraps neatly and long text truncates. |
| 29 | Copy is UK English, sentence case and en-GB dates; `tabular-nums` for numbers | Yes | Shared date formatter with fixed three-letter months. |
| 30 | `npm run build:full` passes (`noUnusedLocals` and `noUnusedParameters`) | Yes | — |
