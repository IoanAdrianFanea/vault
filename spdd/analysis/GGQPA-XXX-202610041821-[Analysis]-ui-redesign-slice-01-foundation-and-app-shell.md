# SPDD Analysis: UI Redesign — Slice 01 Foundation and App Shell

## Summary for Review

**1. What this does.** It adds the new spreadsheet-style design system (Inter, teal accent, slate neutrals, flat 1px borders) under new role-based token names. It adds the first shared UI components in `client/src/components/ui/`, only the ones this slice uses. It also rebuilds the app shell (64px header and 192px sidebar) on those components. No page content is restyled yet. Slices 02–06 do that, and each slice builds the components it is the first to use.

**2. How it works today.**
- `AppShell` wraps every signed-in route. It calls `/auth/me` once, but only to work out `isAdmin`. It loads `status-counts` with no filters each time the pathname changes.
- The header search sends you to `/search?q=` when you type 2 or more characters. It shows a fake ⌘K hint. The "Account" button opens `ProfileSettingsModal`.
- The sidebar has three links (All Documents, Jobs, and Admin Console for admins only) and five status checkboxes that toggle a single `?status=`. From another page, a status click goes to `/documents?status=X`.
- `tailwind.config.js` has a Material-style palette with blue `primary`, and `darkMode: 'class'`. Nothing ever adds the `dark` class.
- The palette is used about 1,100 times, mostly in admin and auth pages. For example, `primary` ×232 and `on-surface-variant` ×171.
- Font tokens: `font-headline` uses Manrope. `text-body-md` is 15.2px and `text-label-md` is 14px.
- `StatusBadge` lives in `components/common/`. Only `DocumentTable` and `DocumentDrawer` import it.
- `AdminLayout.tsx` and `UploadModal.tsx` are not imported anywhere.

**3. What will change (frontend only).**
- Tailwind tokens are additive.
  - The new colours go under role-based names that don't collide with existing keys (e.g. `accent`, `ink`, `line`, `status-*`), along with the new type scale, radii, overlay shadow and a named z-index scale (R1, R4).
  - Every existing colour key keeps its current value (R1).
  - The legacy font sizes take the new values (Q2), and every font family becomes Inter.
- `index.html`: the title becomes "DocIndex Manager" and the Manrope link is removed. `mark` becomes an amber tint. The `.dark` rules and the unused `sticky-header` rule are removed from `index.css` (R9).
- Ten components are built in `components/ui/` with an `index.ts` barrel (R6, C1): Button, IconButton, Badge, StatusBadge (moved), Avatar, Dropdown, Input, Checkbox, Spinner and InlineAlert. The rest wait for the slice that first uses them.
- `StatusBadge`'s two importers lose their `dark:` classes, and `DocumentDrawer`'s download-failure `alert` becomes an `InlineAlert` (Q4, C1).
- `AppShell` is rebuilt: logo, name and subtitle; search with prefill on `/search`; dark Upload button; avatar user block that re-fetches `/auth/me` when the profile modal closes (Q3); sentence-case nav (Q5); and a collapsible status filter with dots.
- Two dead files are deleted, and a "UI Rules" section is added to `copilot-instructions.md`.

**4. What will NOT change.** No changes under `server/`. No changes to `client/src/api/`, routes, `AdminGuard`, page bodies or modals, apart from the `StatusBadge` import paths and the `DocumentDrawer` alert. Unrestyled pages keep their current colours, including their hard-coded `blue-*` classes (R1, Q6). No new npm packages.

**5. Assumptions (confirmed at review).**
- The status counts in the sidebar stay unfiltered (all documents you can access). That matches today.
- `darkMode: 'class'` stays until slice 07 so the untouched `dark:` classes stay inactive (R3).
- Dropdown and Checkbox are the only components exported without a slice-01 consumer, at the reviewer's request (R6).

**6. Top 3 risks (all resolved, see R1–R9).**
1. Two visual languages sit side by side: the new teal shell next to blue unrestyled pages until slices 02–06 land. This was accepted in exchange for zero contrast regressions (R1).
2. Stitch reuses Material token names with *different meanings*. This is avoided because new code uses only the new role-based names, and the UI Rules forbid copying exported classes or config (R2).
3. Overlays could be clipped or stacked wrongly. The named z-index scale and portals for modals cover this (R4).

**7. Open questions.** All resolved. See Resolved Questions.

## Resolved Questions

Reviewed on 2026-10-04. The reviewer replied "Confirmed: accept all recommended answers". Each answer below is a settled requirement for the canvas.

| # | Question | Resolution |
|---|----------|------------|
| Q1 | What should happen to the legacy Material colour tokens (`primary`, `on-surface*`, `surface-container*`, `outline*`, `error*`, …) that are used about 1,100 times in unrestyled pages? | ~~Keep the names and remap each one to the nearest new value by role.~~ **Superseded by R1: do not remap. Every existing colour key keeps its current value.** |
| Q2 | What should the legacy font sizes map to? | **`text-body-md` → body 13/18. `text-label-md` → body 13/18. `text-headline-sm` → page title 24/32.** Unrestyled text gets about 1–2px smaller, which is accepted (reconfirmed in R1). Every `fontFamily` key (`display`, `headline`, `body`, `label`) maps to Inter. |
| Q3 | How should the header user block stay current after a profile save? | **`AppShell` re-fetches `/auth/me` when `ProfileSettingsModal` closes.** The modal's interface is unchanged in slice 01. |
| Q4 | Moving `StatusBadge` edits `DocumentTable` and `DocumentDrawer`. Does that count as "touched", so their `dark:` classes must go? | **Yes. Remove `dark:` classes only and make no other style changes in those two files.** There's no visible change because dark mode is never on. Consequence: ground rule 4 also applies, so `DocumentDrawer`'s download-failure `alert(...)` becomes an `InlineAlert` (found after review; it follows directly from this answer; see C1). |
| Q5 | What casing should the sidebar labels use? | **Sentence case: "All documents", "Jobs", "Admin settings", "Registers", "Status filter".** This follows ground rule 7. The requirement's "All Documents" was copied from the screenshot. |
| Q6 | Hard-coded `blue-*` utilities (×65, e.g. `hover:bg-blue-600`) in unrestyled pages will clash with teal. | **Leave them until their own slice.** With R1 there's no clash at all: unrestyled pages stay fully blue, matching their own legacy `primary`. |
| A1 | Assumption: sidebar status counts stay unfiltered. | Confirmed. |
| A2 | Assumption: `darkMode: 'class'` stays until slice 07. | Confirmed, and restated in R3. |
| A3 | Assumption: shared components may be exported before any page uses them. | **Superseded by R6.** Components are built in the slice that first uses them. Dropdown and Checkbox are the only exceptions. |

### Second review round: technical risk resolutions (2026-10-04)

After reading the full analysis, the reviewer resolved each technical risk. These override any earlier answer they conflict with.

| # | Risk | Resolution |
|---|------|------------|
| R1 | Token remap hurts contrast on unrestyled pages | **Avoid it rather than mitigate it: do NOT remap the legacy colour tokens.** Every existing colour key (`primary`, `primary-container`, `surface-*`, `on-surface*`, `outline*`, `error*`, `background-light`/`background-dark`, etc.) keeps its current value, so unrestyled pages look exactly as they do now. The new design colours go under new role-based names that don't collide, for example `accent`, `accent-hover`, `ink`, `ink-body`, `ink-muted`, `canvas`, `subtle`, `line`, `line-strong`, `selected`, plus `status-*` tones. New code uses only the new names. Font sizes: new tokens may take new values, and `body-md` shrinking to 13px on old pages is acceptable. All fonts → Inter is accepted. Slice 07 deletes the legacy keys. |
| R2 | Stitch name collisions | **Accepted.** The UI Rules must say to never copy classes or the Tailwind config from the exported design HTML, and to use only the new role-based tokens. *Wording note:* the requirement also says the UI Rules must not reference the temporary design folder. So the rule is written generically ("exported design-tool HTML, e.g. Stitch exports") and doesn't name the file path. |
| R3 | Dark mode | **Accepted.** Keep `darkMode: 'class'`. It's inert because nothing adds the class. Slice 07 removes it once the last `dark:` class is gone. Do not switch to `'media'`. |
| R4 | Layering and clipping | **Use one z-index scale as named tokens, and document it in UI Rules:** sticky table header 10, app header 20, bulk bar 30, dropdown/popover 40, modal overlay and modal 50, confirm dialog over a modal 60. `Modal` and `ConfirmDialog` render through `createPortal` to `document.body` (part of `react-dom`, so no new dependency). Dropdowns and popovers stay anchored in place for now, and get a portal only if clipping actually appears. |
| R5 | Focus management | **Accepted, kept minimal.** On open, focus the first focusable element (or the panel). Trap Tab and Shift+Tab inside. Close on Escape. Return focus to the trigger on close. Keyboard-test it in the first slice that renders a modal (slice 02). |
| R6 | Components with no consumers | **Change of approach: build each component in the slice where it is first used, so every interface is exercised when it's written.** Slice 01 builds only what the shell uses plus trivial primitives: Button, IconButton, Badge, StatusBadge, Avatar, Dropdown, Input, Checkbox, Spinner. Modal, ConfirmDialog, Popover, Chip, Table primitives, InlineAlert, EmptyState and SummaryBar move to slice 02. PageHeader and Tabs move to the first slice that uses them. Everything still lives in `components/ui/`. |
| R7 | Build strictness | **Accepted.** `npm run build:full` from `server/` is the gate. |
| R8 | Narrower sidebar | **Accepted.** Check Documents, Upload, Search and every admin tab at 1280px. |
| R9 | Global styles | **Accepted.** Remove the `.dark` rules and the unused `sticky-header` rule. Keep `custom-scrollbar` and `spinner`. |
| C1 | Conflict between R6 and Q4: R6 moves `InlineAlert` to slice 02, but slice 01 touches `DocumentDrawer`, whose download-failure `alert(...)` must become an `InlineAlert` under ground rule 4. | **Build `InlineAlert` in slice 01, because `DocumentDrawer` is its first consumer.** This applies R6's "first use" principle and keeps Q4 as it stands. |

**Resulting slice-01 component set:** Button, IconButton, Badge, StatusBadge (moved), Avatar, Dropdown, Input, Checkbox, Spinner, InlineAlert.

**Exceptions to "build on first use":** the shell doesn't render Dropdown or Checkbox. The header user block opens a modal, not a menu, and the status filter becomes dot toggles, not checkboxes. They stay in slice 01 because the reviewer listed them explicitly. Their first real consumers are in slice 02 (toolbar dropdowns and table selection).

**Deferred to their first-use slice** (the requirement lists them under slice 01, but R6 moves them):

| Component | Expected first consumer |
|-----------|-------------------------|
| Modal, ConfirmDialog, Popover, Chip, Table primitives, EmptyState, SummaryBar | Slice 02 (Documents page, preview and export modals) |
| TextAction, FormField | Slice 02. TextAction for the row actions and chips "Clear all"; FormField for the filter popover fields. |
| Select | The first slice whose form needs a native select |
| PageHeader | Slice 03 (Search and Upload) |
| Tabs | Slice 04 (profile modal Profile/Security) or slice 05 (admin tabs), whichever comes first |

Slices 02–05 must include these components in their own scope.

## Original Business Requirement

> Source: the requirement pasted into the `/spdd-analysis` request, reproduced verbatim below. It is followed by the two referenced design files. `DESIGN.md` is reproduced verbatim because the `stitch_docindex_construction_document_manager/` folder is deleted in slice 07. `screen.png` is an image and can't be embedded, so the shell elements relevant to slice 01 are described in words. Where `DESIGN.md` or the screenshot conflicts with the requirement text, the requirement text wins (see Risk & Gap Analysis → Requirement Ambiguities).

/spdd-analysis #file:stitch_docindex_construction_document_manager/screen.png #file:stitch_docindex_construction_document_manager/DESIGN.md

# Initiative: UI redesign to the approved spreadsheet-style design

**Current slice: 01** ← implement ONLY this slice. The other slices are listed for context so earlier work fits later work.

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

#
Decision

D1
Keep the app name "DocIndex Manager" with subtitle "Site document register" ("SiteVault" in the design is a placeholder).

D2
No storage meter: no storage limits, and no endpoint.

D3
No project codes or "pinned sites": these fields don't exist.

D4
Header user block = full name (or email) + role from `/auth/me`, initials avatar; click opens `ProfileSettingsModal`.

D5
Replace "Last sync" / "Indexed & Synced" with real data: "Updated HH:MM" (last fetch) + an indexing indicator from status counts.

D6
Failed rows get a "Retry" action (not "Retry OCR" — PDF failures come from `pdf-parse`); handler is TODO(backend).

D7
"Generate register PDF" menu item; handler is TODO(backend).

D8
Export CSV is implemented client-side from the loaded rows.

D9
Remove fake UI: Google/GitHub login, "Remember me" (unwired), "Forgot password?" (no reset flow), Documentation/Support links, "© 2024" footer, fake "Logged in devices", 2FA (out of scope), Language & Region, and fake drawer fields (Edit, Share, "OCR Completed", Author, Dimensions, Version).

D10
Keep both searches: the header search goes to the `/search` snippet page; the filter keyword narrows the Documents table.

---

## Slices

### 01 — Foundation and app shell

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

Files: `pages/Documents.tsx`, `DocumentTable`, `BulkActionBar`, `DocumentPreviewModal`, `ExportModal`.

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

``markdown
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
``

### Referenced file: `stitch_docindex_construction_document_manager/screen.png` (description of slice-01 shell elements)

- **Header** (white, bottom border): a teal rounded-square logo with a white padlock glyph. Next to it are the app name in bold ("SiteVault", a placeholder per D1) and a smaller subtitle underneath ("Site Document Register"). In the centre is a wide search input with a leading magnifier icon and a pale fill. On the right is a dark navy "+ Upload Document" button. At the far right is a two-line organisation/role text block ("Apex Construction" / "General Contractor"), right-aligned, next to a teal circular avatar with a person glyph.
- **Sidebar** (pale slate fill, about 240px in the mock, 192px per the requirement): a small uppercase "REGISTERS" heading. Under it are icon + label nav items. "All Documents" is active, with a tinted background and a right-aligned count pill ("1,420"). "Jobs" has a count pill ("12"), which the requirement removes. "Admin Settings" has a gear icon.
- **Status filter**: a small uppercase "STATUS FILTER" heading with a chevron (collapsible). Below it are five rows, each with a coloured dot, a label and a right-aligned count. The rows are Uploaded (light grey dot), Queued (dark slate), Processing (amber/orange), Processed (teal) and Failed (red).
- **Sidebar footer**: a "Storage 8.4 / 20 GB" meter, which the requirement excludes (D2).
- **Content**: the Documents table, toolbar, chips row and summary bar are slice 02 scope. They are listed here only as the visual target for the shared components (Dropdown, Chip, Table primitives, Badge, TextAction, SummaryBar).

## Domain Concept Identification

### Existing Concepts (from codebase)

- **Signed-in user** (`GET /auth/me`): email, full name (nullable), role, created date. Today `AppShell` uses only the role. `AdminGuard` and `ProfileSettingsModal` each make their own call. This concept drives the header user block and whether the Admin settings link exists.
- **Role** (`USER` / `ADMIN`): controls whether admin-only navigation is present. Route protection is enforced separately by `AdminGuard`, and on the server.
- **Document status** (`UPLOADED`, `QUEUED`, `PROCESSING`, `PROCESSED`, `FAILED`): it appears as a badge on rows, a dot plus label in the sidebar filter, and as keys in the status counts. It is defined twice, in `types.ts` and `api/documents.ts`.
- **Status counts** (`GET /documents/status-counts`): a count per status. It accepts the same filters as the list. The shell calls it with no filters each time the route pathname changes. It is the source for the per-status sidebar counts and, from this slice, the "All documents" total.
- **Status filter** (`?status=` URL parameter): single-select and owned by the URL. The shell writes it and the Documents page reads it. Unknown values are ignored. Clicking a status on any non-documents route navigates to `/documents?status=X`.
- **Global search query** (`/search?q=`): the header input submits it when the trimmed text is 2 or more characters, and the Search page reads `q`. There is also a `/search/:id` variant.
- **App shell** (`AppShell`): the frame for every signed-in route. Each route element renders its own `<AppShell>`. React keeps the same instance when navigating between non-admin routes (same element type at the same position), but remounts it when moving into or out of admin routes, because those wrap it in `AdminGuard`. Shell state and preferences must therefore work whether or not the shell remounts.
- **Profile settings** (`ProfileSettingsModal`): opened from the header. It lets you edit full name and email (an email change requires re-verification), and sign out. Its interface is open/close only, with no "saved" signal.
- **Design tokens** (`tailwind.config.js`): a Material-style colour palette (blue `primary`), legacy font sizes and families, radii, `darkMode: 'class'`, and the `@tailwindcss/forms` plugin. Unrestyled pages use them heavily: about 1,100 palette usages and 152 legacy type-token usages.
- **Global styles** (`index.css`): the Material Symbols icon settings, the `mark` highlight used by search snippets, `custom-scrollbar` (used in 5 places), `spinner`, and an unused `sticky-header` rule with dark variants.
- **StatusBadge** (`components/common/`): turns a status into a label and pill. For FAILED it shows `errorMessage` as a tooltip. `DocumentTable` and `DocumentDrawer` use it. `AdminUsers` has an unrelated local component with the same name for account status.
- **Dead UI**: `components/admin/AdminLayout.tsx` (an old shell with a non-functional search) and `components/documents/UploadModal.tsx` (a mock). Neither is imported.
- **Project instructions** (`.github/copilot-instructions.md`): its Frontend Rules currently say "Tailwind only, using the existing design tokens".

### New Concepts Required

- **Design token set**: role-named tokens that never collide with an existing key (R1). The colour roles are accent and accent hover, link, dark action ("ink") and its hover, high/body/muted text, canvas, sub-surface, gridline, strong border, row hover and row selected, plus `status-*` tones (teal, amber, red, slate). It also includes the type scale (page title, section, panel, body, small, label), the radius scale, the overlay shadow and scrim, and a named z-index scale (R4). It becomes the only vocabulary for new and restyled code.
- **Frozen legacy tokens**: every existing colour key keeps its current value, so unrestyled pages look exactly as they do today (R1). The legacy font-size keys take the new values (Q2), and the legacy font-family keys point to Inter. They're temporary: unrestyled pages use them until slices 02–06 restyle them, and slice 07 deletes them once nothing uses them.
- **Shared UI component library** (`components/ui/`): the single owner of control, overlay, table and layout styling and behaviour. Pages compose these components instead of writing their own class strings. It grows slice by slice: each component is built in the slice that first uses it (R6). Slice 01 builds Button, IconButton, Badge, StatusBadge (moved), Avatar, Dropdown, Input, Checkbox, Spinner and InlineAlert (C1).
- **Status tone mapping**: one shared mapping from document status to badge tone and sidebar dot colour, so the badges and dots always agree. Processed is teal. Uploaded, Queued and Processing are amber for badges. The sidebar dots use slate-300, slate-500, amber, teal and red.
- **User identity display**: the full name, or the email when there's no name, plus a sentence-case role label and an initials avatar. It is derived from the signed-in user and opens the profile settings.
- **Shell preferences**: whether the status filter section is collapsed, kept for the browser session alongside the existing `documents:selectedProject` key.
- **UI Rules**: written design rules for future slices and contributors in the project instructions. They cover the role-based tokens, the z-index scale, portals for modals, focus behaviour, light theme only, Inter, `tabular-nums`, and no native dialogs. They forbid copying classes or config from exported design-tool HTML (R2). They don't reference the temporary design folder.

### Key Business Rules

- **Admin-only UI is absent for non-admins** (Role, Shell): the Admin settings link is rendered only once the role is confirmed as ADMIN. While the role is loading, or if the call fails, the link isn't rendered at all, not just hidden.
- **Status filter is single-select and lives in the URL** (Status filter): clicking a different status replaces it, and clicking the active status clears it. On a non-documents route, a click navigates to the Documents page with that status.
- **Global search needs at least 2 characters** (Global search query): shorter input does nothing. On `/search` (and `/search/:id`) the input shows the current `q`.
- **"All documents" count is the sum of the five status counts** (Status counts): it covers every document the user can access, with no filters (A1). Jobs has no count.
- **Light theme only** (Design tokens): `dark:` variants are removed from every file touched in this slice. Dark mode must stay class-based so the untouched `dark:` classes stay inactive (A2, R3).
- **Legacy colours don't change** (Design tokens): no existing colour key changes value, and new code never uses a legacy key (R1).
- **Inter only, with tabular figures for numbers** (Design tokens): this includes the sidebar counts.
- **Accessible controls** (Shared UI library): icon-only buttons have an `aria-label`. Dropdowns close on Escape and on an outside click, and return focus to their trigger. Popovers, modals and sortable headers follow the same rules in the slice that builds them (R5, R6).
- **No native dialogs in touched files** (Shared UI library): `InlineAlert` replaces `window.alert` in slice 01 (C1), and `ConfirmDialog` replaces `window.confirm` from slice 02. `AppShell` has no native dialogs today.
- **Copy is UK English and sentence case** (all shell text): the app name is "DocIndex Manager" with the subtitle "Site document register" (D1). The nav labels follow Q5.
- **No fake features** (Shell): no storage meter (D2), no project codes or pinned sites (D3), and no ⌘K hint.
- **Frontend only** (all): no changes to API contracts and no new npm packages. `npm run build:full` must pass.
- **Implicit: the header identity must not mislead.** While `/auth/me` loads or after it fails, the user block shows a neutral state rather than a wrong name or role.
- **Implicit: the profile modal stays reachable.** Even if `/auth/me` fails, clicking the user block still opens `ProfileSettingsModal`, so the user can sign out.

## Strategic Approach

### Solution Direction

- **Tokens first, additive only.** Add the new token set under role-based names that collide with nothing (R1). Leave every existing colour key at its current value. Point the legacy font-size keys at the new values (Q2) and every font family at Inter. Keep `darkMode: 'class'` (A2, R3). Add the named z-index scale (R4). The radius scale already matches Tailwind's defaults at sm, DEFAULT, md, lg and xl, so it changes no current usage.
- **Component library second, on first use.** Build only the slice-01 set in `components/ui/` (R6, C1), as presentational React components with no dependencies. Each component owns its styling and its accessibility behaviour (Escape, outside click, focus return, ARIA). The relocated `StatusBadge` and the sidebar dots share one status tone mapping. Overlay components (Modal, ConfirmDialog, Popover) and their focus trap and portal rules are built in slice 02, following R4 and R5.
- **Shell rebuild third.** `AppShell` keeps all its current data responsibilities: the signed-in user, status counts, search navigation, status toggling, and opening the profile modal. Only its markup is replaced with the new components. The existing `/auth/me` call is extended to keep the user's name, email and role instead of just a boolean. It re-runs when the profile modal closes (Q3).
- **Data flow is unchanged.** Shell → existing auth and documents services → local state → render. The URL stays the source of truth for the status filter and the search query.
- **Clean-up and documentation last.** Delete the two dead files. Move `StatusBadge` and update its two importers, removing their `dark:` classes and replacing `DocumentDrawer`'s download-failure `alert` with an `InlineAlert` (Q4, C1). Remove the `.dark` rules and the unused `sticky-header` rule from the global styles, keeping `custom-scrollbar` and `spinner` (R9). Add the "UI Rules" section to the project instructions, and update the existing Frontend Rules line about "existing design tokens" so the two sections agree (new code uses only the role-based tokens).

### Key Design Decisions

- **Legacy colour tokens**: remapping them by role would give one look straight away, but it risks contrast regressions in tint/accent pairings and opacity modifiers on about 1,100 usages. Freezing them keeps two visual languages until each slice lands. → **Freeze them at their current values (R1, superseding Q1).** Unrestyled pages don't regress at all. The mixed look is temporary and shrinks with each slice.
- **New token names vs reusing legacy names**: reusing `primary` and similar names for the new roles would blur what each name means and make the slice-07 "zero usages, then delete" check impossible. → **New code uses distinct role-based names only (R1).** A new name must also not match any class that is already written in the code but currently does nothing, because defining it would switch that class on (the same mechanism as `darkMode`). `scrim` (×13) is therefore off-limits. `accent` would switch on one hover colour in `JobsTable` (see Edge Cases).
- **Tailwind palette vs custom hex**: most required values already exist in Tailwind's default slate, teal, amber and red scales. Only the link teal (`#005c55`) and the dark action navy (`#213145`, hover `#0b1c30`) don't. → **Define role tokens for every colour in the requirement, using the matching default-scale value where one exists.** Components use the role tokens, so a future colour tweak happens in one place, and slice 07's "hard-coded hex where a token exists" check has a clear target.
- **Overlay mechanics without new packages**: `Modal` and `ConfirmDialog` must escape the shell's `overflow-hidden` frame and any scroll containers. → **One named z-index scale: sticky table header 10, app header 20, bulk bar 30, dropdown/popover 40, modal overlay and modal 50, confirm over a modal 60 (R4). `Modal` and `ConfirmDialog` portal to `document.body` (slice 02). Dropdowns and popovers stay anchored in place and get a portal only if clipping actually appears.** In slice 01 only the scale and the anchored `Dropdown` are built.
- **Sharing the signed-in user**: a user context or provider would remove the duplicate `/auth/me` calls (`AdminGuard`, `AppShell`, the profile modal), but that's a cross-cutting refactor beyond this slice. → **Extend the existing shell call only, as the requirement says ("reuse the existing `/auth/me` call").**
- **Remembering the collapsed state**: whether the shell remounts depends on the route (see App shell), so in-memory state may or may not survive navigation. → **Keep it in `sessionStorage` under a namespaced key, following the existing `documents:selectedProject` convention, and fall back to "expanded" if storage can't be read.**
- **Status filter interaction**: today's filter is a `<label>` wrapping a read-only checkbox and suppressing the default action, which isn't keyboard-operable. → **Make each status row a real toggle button that exposes its pressed state.** The `?status=` behaviour stays the same.
- **When to build each component**: building all of them in slice 01 means designing interfaces with no consumer. → **Build each component in the slice that first uses it (R6).** Slice 01 builds Button, IconButton, Badge, StatusBadge, Avatar, Dropdown, Input, Checkbox, Spinner and InlineAlert (C1). Dropdown and Checkbox are explicit exceptions with no slice-01 consumer. Everything else moves to its first-use slice (see Resolved Questions).

### Alternatives Considered

- **Remap the legacy palette by role to the nearest new value**: accepted at first review (Q1), then rejected in the second round (R1). It risked contrast regressions on about 1,100 usages, while freezing the palette risks nothing.
- **Build every listed component in slice 01**: rejected (R6). Interfaces with no consumer can't be exercised when they're written.
- **Copy Stitch's exported tokens or HTML classes**: rejected by the requirement. Its token names collide with ours but mean different things (Stitch `primary-container` is dark teal, ours is a light tint), and its CDN config and `borderRadius.full` are wrong for this app.
- **Use a headless UI library for overlays and menus**: rejected by the ground rule against new npm packages.
- **Add a user context or provider**: rejected for this slice. It's a broader refactor, and the requirement asks to reuse the existing call.
- **Remove `darkMode` from the config now**: rejected (A2, R3). Tailwind 3 would fall back to `media` and switch on about 500 dormant `dark:` classes for users whose OS is in dark mode.
- **Re-export `StatusBadge` from `components/common/` to avoid editing its importers**: rejected. The requirement says to move it and update the imports, and a re-export would leave a stale path for slice 07 to find.
- **Give the header a `ProfileSettingsModal` "saved" callback**: deferred to slice 04, when the modal is rebuilt. Re-fetching when the modal closes (Q3) needs no change to the modal.

## Risk & Gap Analysis

### Requirement Ambiguities

- **`DESIGN.md` and the screenshot vs the requirement**: they conflict in several places. `DESIGN.md` makes the "Active" chip green (`#f0fdf4` / `#15803d` / `#bbf7d0`), but the requirement makes it teal. `DESIGN.md` has a 48px shell toolbar, but the requirement has a 64px header. `DESIGN.md` uses `#ef4444` for destructive text, but the requirement's red tone is `#b91c1c`. The mock's sidebar is about 240px, but the requirement says 192px. → The requirement text wins in every case. `DESIGN.md` is used only for values the requirement leaves out, such as the exact overlay shadow (`0 4px 6px -1px rgba(15,23,42,0.08), 0 2px 4px -2px rgba(15,23,42,0.04)`) and the focus ring (`#0f766e` border + 1px ring).
- **Teal and slate badge values aren't specified**: the requirement gives hex values for amber and red only. → The canvas uses the nearest Tailwind-scale equivalents in the same pattern (teal-50 background, teal-700 text, teal-200 border; slate-50, slate-700, slate-200).
- **Header role label and avatar fallback**: the requirement says "full name (or email) + role" and "initials avatar". → Show the role in sentence case ("Admin", "User"). Take the initials from the full name, or from the first letter of the email when there's no name.
- **Status filter collapsed while a status is active**: the requirement doesn't say what a collapsed section shows. If nothing, an active filter becomes invisible. → The canvas should keep the active status visible in the collapsed heading, or always keep it reachable.
- **Status counts that fail to load**: today the shell logs the error and shows zeros, so "All documents 0" would be misleading. → Show no count rather than "0" when counts couldn't be loaded.
- **Undefined legacy tokens already in use**: `bg-scrim/40` (×13, in admin modals and pages), `border-border-subtle` (×11, in jobs and admin), `text-text-muted` and `hover:text-accent` (in `JobsTable`) are referenced but were never defined, so today they do nothing. The admin modals have blur but no darkening. → Leave them undefined in slice 01, and pick new token names that don't switch them on (R1, see Technical Risks). Slice 07's grep should catch any that are left.
- **Legacy tokens not listed in the requirement**: `font-body` (×20) and `font-label` (×31) aren't in the legacy list, but "All `fontFamily` keys → Inter" covers them. The `display` font-size key has zero usages and can be dropped.
- **Slice 07 file reference**: the requirement says to delete `stitch_docindex_construction_document_manager.zip`, but no such file exists in the repo. The design folder is untracked in git. This doesn't affect slice 01. Note it for slice 07.
- **R2 wording vs the "no folder reference" rule**: R2 asks the UI Rules to forbid copying from `code.html`, while the requirement forbids referencing the temporary design folder. → Resolved by wording: the rule forbids copying classes or Tailwind config from "exported design-tool HTML (e.g. Stitch exports)" without naming the path.
- **Upload button is a navigation link**: the header's "Upload document" goes to `/upload`, but `Button` is a button. → The canvas decides how `Button` styling applies to a router link (a link form of `Button`, or a shared style used by a `Link`) without a one-off copy of the button styles (ground rule 3).

### Edge Cases

- **`/auth/me` is slow or fails**: the user block must not jump around or show a wrong identity, and the Admin settings link must stay out of the DOM. Clicking the user block must still open the profile modal (for sign-out).
- **Long names or emails**: the header's right-hand block must truncate so the search and Upload button stay usable at 1280px.
- **Profile edited**: after a name change, the header updates when the modal closes (Q3). After an email change on an account with no name, the header shows the new email. The modal already warns that it must be verified.
- **Sign out from the profile modal**: navigates to `/login` and the shell unmounts. The close-triggered re-fetch must not fail loudly when the token has been removed.
- **Global status counts vs a project-filtered Documents page**: the sidebar's "Processed 10" may show fewer rows when a project is selected. This is today's behaviour (A1). Slice 02's summary bar uses filtered counts.
- **Invalid `?status=` value**: ignored, as today. No sidebar row is active.
- **Search input across routes**: on `/search` the input mirrors `q`, even when `q` changes without a remount. On other routes it keeps whatever the user typed: empty on first mount, and possibly the previous text if the shell instance was kept. Submitting fewer than 2 characters does nothing, as today.
- **`sessionStorage` unavailable**: reading or writing the collapsed state must fail silently and default to expanded.
- **Active nav state**: "All documents" is active on `/documents` and `/documents/:id`. "Jobs" is active on `/jobs` and `/jobs/:id`. "Admin settings" is active on any `/admin/*` route. Nothing is active on `/search` or `/upload`.
- **Escape with nested overlays**: an open Dropdown inside a Modal must close on its own first, without closing the Modal. The Dropdown built in slice 01 must stop its Escape from reaching outer handlers, so the slice-02 Modal can rely on that.
- **Checkbox indeterminate state**: it's a DOM property, not an HTML attribute, so the component has to set it explicitly. The `@tailwindcss/forms` base styles must not override the 14px size or the teal checked state. Checkbox has no slice-01 consumer (R6 exception), so this is first checked visually in slice 02.
- **Defining `accent` switches on a dormant hover**: `JobsTable` has `hover:text-accent`, which currently does nothing. Once an `accent` token exists, its "View" link turns teal on hover. → Accept it: it's hover-only, matches the new design, and Jobs is restyled in slice 06. If the canvas wants zero change to unrestyled pages, it can pick a different name.

### Technical Risks

Each technical risk below was resolved by the reviewer in the second round (R1–R9). Each entry gives the risk and its settled resolution.

- **Token remap hurts contrast on unrestyled pages** → **Avoided (R1).** No legacy colour key changes value. New colours use new role-based names. The only visual changes on unrestyled pages are the smaller legacy font sizes (accepted, Q2), Inter replacing Manrope in headings, and the one `JobsTable` hover (Edge Cases).
- **New names switching on dormant classes**: a new token whose name matches a class already in the code but never defined would silently change unrestyled pages. → The canvas must grep each new token name before adopting it. `scrim` is excluded (×13 in admin modals). `accent` is accepted with its one hover change.
- **Stitch name collisions** → **Accepted (R2).** New code uses only the new role names. The UI Rules forbid copying classes or config from exported design-tool HTML.
- **Dark-mode activation** → **Accepted (R3).** Keep `darkMode: 'class'`. It's inert. Slice 07 removes it after the last `dark:` class, and it must never switch to `'media'`.
- **Overlay layering and clipping** → **Resolved (R4).** One named z-index scale (10 / 20 / 30 / 40 / 50 / 60), documented in UI Rules. `Modal` and `ConfirmDialog` portal to `document.body` from slice 02. Anchored dropdowns and popovers get a portal only if clipping appears.
- **Focus management written in-house** → **Accepted, minimal (R5).** Focus the first focusable element (or the panel) on open, trap Tab and Shift+Tab, close on Escape, return focus to the trigger. It's built and keyboard-tested in slice 02 with the first modal.
- **Components with no consumers** → **Avoided (R6, C1).** Components are built on first use. Dropdown and Checkbox are the explicit exceptions.
- **Build strictness** → **Accepted (R7).** `noUnusedLocals` and `noUnusedParameters` flag unused imports and parameters inside components. `npm run build:full` from `server/` is the gate.
- **Narrower sidebar (256px → 192px)** → **Accepted (R8).** Check Documents, Upload, Search and every admin tab at 1280px.
- **Global style clean-up** → **Accepted (R9).** Remove the `.dark` rules and the unused `sticky-header` rule. Keep `custom-scrollbar` and `spinner`.

### Acceptance Criteria Coverage

The requirement has no numbered ACs, so the ACs below are taken one-to-one from the slice 01 section and the ground rules that apply to it. Rows marked R1 or R6 have been changed by the reviewer's second-round resolutions. "Deferred" means the item moves to the slice that first uses it, and that slice must include it.

| AC# | Description | Addressable? | Gaps/Notes |
|-----|-------------|--------------|------------|
| 1 | `tailwind.config.js` holds the new colour, badge, type, radius, size and overlay tokens | Yes (modified by R1, R4) | Added under non-colliding role-based names (R1), plus the named z-index scale (R4). Teal and slate badge values inferred (see Ambiguities). Overlay shadow taken from `DESIGN.md`. |
| 2 | All `fontFamily` keys → Inter; Manrope link removed from `index.html` | Yes | Covers `display`, `headline`, `body` and `label`. Only one Manrope reference exists in config and one in HTML. |
| 3 | Legacy tokens still in use are kept as aliases mapped to the nearest new value (grep first) | Yes (modified by R1) | Counts verified: `text-label-md` ×43, `text-body-md` ×37, `font-headline` ×11, `text-headline-sm` ×6, `font-display` ×4, `bg-background-light` ×4, `bg-background-dark` ×4. Font sizes and families map to the new values and Inter (Q2). **Every legacy colour key, including `background-light`/`-dark`, keeps its current value (R1).** Undefined `scrim` and `border-subtle` stay undefined. |
| 4 | `index.html` title = app name | Yes | "DocIndex Manager" (D1). Today it's "PDF Manager". |
| 5 | `mark` in `index.css` restyled as an amber tint | Yes | The `.dark mark` rule is removed (R9). Used by Search snippets. |
| 6 | `Button`: primary / dark / secondary / ghost / danger; sm 28px, md 32px; icon, loading, disabled | Yes | Slice 01. First use: the header Upload button (dark, md), which needs a link form (see Ambiguities). Its loading state uses `Spinner`. |
| 7 | `IconButton`, `TextAction`, `Input`, `Select`, `Checkbox` (14px, indeterminate), `FormField` | Partial (R6) | **Slice 01:** `IconButton` (e.g. the status filter collapse toggle), `Input` (header search), `Checkbox` (R6 exception, no slice-01 consumer). **Deferred to first use:** `TextAction` and `FormField` (slice 02), `Select` (first form that needs one). |
| 8 | `Dropdown`: "Label: Value" trigger, check on selected, dividers, footer, outside click and Escape, ARIA | Yes (R6 exception) | Slice 01 per the reviewer's list, but no slice-01 consumer. First used in the slice-02 toolbar. Anchored in place at z-40 (R4). Escape must not leak to outer handlers. |
| 9 | `Popover`, `Badge`, `StatusBadge` (moved, imports updated, FAILED → `errorMessage` title), `Chip` (removable) | Partial (R6) | **Slice 01:** `Badge`, `StatusBadge` (two importers updated, `dark:` removed, Q4). The local `StatusBadge` in `AdminUsers` is unrelated and stays. **Deferred to slice 02:** `Popover`, `Chip`. |
| 10 | Table primitives: sticky 28px header, sortable header with arrow + `aria-sort`, hover and selected rows | Deferred (R6) | Built in slice 02 with the Documents table. |
| 11 | `Modal` (Escape, backdrop, focus), `ConfirmDialog`, `InlineAlert`, `EmptyState`, `Spinner` | Partial (R6, C1) | **Slice 01:** `InlineAlert` (first used in `DocumentDrawer`, C1), `Spinner`. **Deferred to slice 02:** `Modal`, `ConfirmDialog` (portal + focus rules per R4/R5), `EmptyState`. |
| 12 | `PageHeader`, `Tabs` (underline, NavLink, count badge), `SummaryBar`, `Avatar` | Partial (R6) | **Slice 01:** `Avatar` (header user block). **Deferred:** `SummaryBar` (slice 02), `PageHeader` (slice 03), `Tabs` (slice 04 or 05, whichever first). |
| 13 | All components exported from `components/ui/index.ts` | Yes | The barrel exports the slice-01 set. Later slices add theirs. |
| 14 | Header 64px: logo + name + subtitle | Yes | "DocIndex Manager" / "Site document register". |
| 15 | Global search: placeholder "Search files or document text…", Enter → `/search?q=` at 2+ characters, prefilled on `/search`, ⌘K removed | Yes | Prefill also on `/search/:id`, and mirrors `q` changes without a remount. |
| 16 | Dark "Upload document" button → `/upload` | Yes | Uses the dark action token (`#213145` / hover `#0b1c30`). |
| 17 | User block: name (or email) + role + initials avatar from the existing `/auth/me` call; click opens `ProfileSettingsModal` | Yes | Re-fetches when the modal closes (Q3). Loading and failure states are neutral. |
| 18 | Sidebar 192px `#f8fafc`; "Registers": All documents (sum of status counts), Jobs (no count), Admin settings (admins only, active on `/admin/*`) | Yes | Sentence-case labels (Q5). Admin link absent from the DOM until ADMIN is confirmed. Count hidden when counts fail to load. |
| 19 | "Status filter": collapsible (in `sessionStorage`), dot + label + count, single-select `?status=`, click again to clear; dot colours as specified | Partial | Need to decide how an active filter shows while collapsed. Rows become keyboard-operable toggles. |
| 20 | No storage meter | Yes | D2. |
| 21 | Delete `components/admin/AdminLayout.tsx` and `components/documents/UploadModal.tsx` | Yes | Verified: nothing imports them. |
| 22 | "UI Rules" section in `.github/copilot-instructions.md`, outside the openspdd markers, written directly with no reference to the design folder | Yes | Contents: role-based tokens only, legacy keys frozen and to be removed in slice 07, the z-index scale, modal portals and focus rules, `darkMode` stays `'class'`, Inter, `tabular-nums`, light theme only, no native dialogs, build components on first use, never copy exported design-tool HTML or config (R1–R6). Also bring the existing Frontend Rules line ("existing design tokens") into line. |
| 23 | Frontend only: no `server/` changes, no API contract changes, no new npm packages | Yes | `types.ts` changes are slice 02 only. `createPortal` is part of `react-dom` (R4). |
| 24 | In every touched file: `dark:` variants removed; no `window.confirm` / `window.alert` | Yes | Touched files: `AppShell`, `StatusBadge`, `DocumentTable`, `DocumentDrawer`, `index.css`. `DocumentDrawer` calls `alert(...)` when a download fails. Because the file is touched (Q4), this becomes an `InlineAlert` inside the drawer (C1). No other native dialogs exist in the touched files. |
| 25 | Icon-only buttons have `aria-label`; dropdowns, popovers and modals close on Escape; row actions always visible | Yes | `IconButton` requires a label, and `Dropdown` closes on Escape in slice 01. Popover and modal behaviour comes in slice 02 (R5, R6). Row actions are a consumer concern from slice 02. |
| 26 | UK English, sentence case; dates in en-GB format | Yes | The shell has no dates. The rule is recorded in UI Rules for later slices. |
| 27 | Works at 1280px and 1440px | Yes | Check the header truncation, and check Documents, Upload, Search and every admin tab with the 192px sidebar at 1280px (R8). |
| 28 | `npm run build:full` from `server/` passes | Yes | This is the final gate for the slice. |
