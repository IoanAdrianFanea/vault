# SPDD Analysis: UI Redesign — Slices 03–07 Remaining Screens

## Summary for Review

**1. What this does.** It brings every screen that still has the old blue look into the approved spreadsheet design, using the Documents page as the pattern: Search, Upload, the four sign-in pages, the profile modal, all six admin tabs and their modals, and Jobs. It first builds the shared pieces these screens need, and finishes by deleting the old colour tokens, dead code and the design folder. It's frontend only, delivered in six groups (A–F) that each pass `npm run build:full`.

**2. How it works today.**
- **Search:** results are file name + highlighted snippet only (max 20). Every row shows a PDF icon. Deletes use `confirm`/`alert` with the wrong "cannot be undone" copy. The drawer shows fake fields (Edit, Share, Author "You", Dimensions, Version). `GET /documents/:id` returns no project name or uploader, and only a 150-character text preview.
- **Upload:** says "Maximum file size 50MB" (there's no limit). It uses `alert` for bad file types and a missing project, and redirects after 1.5s even if files failed. Failed files can't be removed or retried.
- **Sign-in pages and profile modal:** Google/GitHub, Remember me, Forgot password, Support links and the footer are all unwired. The password rules are copied identically in three files. There's no show/hide on any password field. Language & Region really is saved through `PATCH /auth/me`; devices and 2FA are fake.
- **Admin:** each page draws its own tabs. There's no shared layout and no pending count. All nine admin modals are hand-built overlays that ignore Escape. Five pages hide row actions until hover. Project delete wrongly says "permanently remove", and user delete doesn't say their documents are destroyed.
- **Recycle bin, Archive, Filters:** Filters deletes with `confirm`/`alert`. Nothing warns that changing a filter's type wipes its values, although the server does wipe them. A document needs a project choice when its project is deleted **or archived**. It can't be restored on its own only when it was swept up with a deleted archived project.
- **Jobs:** mock data, a wrong "Phase 3" banner plus a pop-up toast, three dead toolbar icons, and `confirm`/`alert` in the drawer.
- **Leftovers:** 12 native dialog calls (Search 5, Upload 3, Filters 2, Jobs drawer 2), `dark:` classes in 14 files, old tokens in 28 files, and `darkMode: 'class'` still set.

**3. What will change (frontend only).** Group A adds PageHeader, Tabs, SegmentedControl, Drawer, AuthLayout, PasswordChecklist with one shared rules module, and a password show/hide input. It also makes the bulk bar take any set of actions. Groups B–E rebuild every listed screen and modal on `components/ui/` with corrected copy. The admin pages share one layout route with the pending-count badge (Q2). The Search and Jobs drawers push the content aside instead of covering it (Q5). Group F deletes the old tokens, `darkMode`, the toast and unused code, updates the docs and backlog, and removes the design folder.

**4. What will NOT change.** Nothing under `server/`, no API contracts, no new packages and no route URLs change. The header, sidebar and Documents page look as they do now, and Jobs keeps its sample data.

**5. Assumptions (confirmed at review).**
- A1: The bulk bar becomes a generic `components/ui` bar (count, actions, clear). `BulkActionBar` wraps it, so `Documents.tsx` doesn't change.
- A2: Search's PREVIEW loads the document first, because results don't include its type or status. The drawer's ~600-character text comes from the existing full-text endpoint.
- A3: `Modal` gets a ~640px size for the profile modal, rather than a one-off width.
- A4: Every password field gets show/hide, including Register and Edit user, for consistency.
- A5: Profile "Discard" reverts unsaved edits and doesn't close the modal. Language and timezone are no longer sent.
- A6: Deleting a rejected user on Pending shows the same "their documents are permanently deleted" warning. The pending badge also refreshes after user deletes.
- A7: The Jobs drawer's Download and Delete, and the table's Retry, become `TODO(backend)` handlers. Delete still asks for confirmation first.
- A8: The tooltip on a disabled Restore reads "Restore the whole project from the Projects tab". The expiry column shows "Today" when 0 days remain.

**6. Top 3 risks.**
1. **Lost behaviour:** about 30 files are rewritten. Shift-click selection, staged members, the archive steps, the restore project choice and the sign-in redirects are easy to drop.
2. **Clean-up gates:** old tokens can only be deleted after A–E. The "zero `dark:`" grep falsely matches the `dark` button variant in `buttonStyles.ts`, so the check must look for class usage.
3. **Overlay stacking:** Drawer + preview modal + confirm dialog, and admin modals over the bulk bar. Each Escape must close only the top layer.

**7. Open questions.** All resolved. See Resolved Questions.

## Resolved Questions

Reviewed on 2026-10-05. The reviewer replied "Confirmed: accept all recommended answers and assumptions". Each answer below is a settled requirement for the canvas.

| # | Question | Resolution |
|---|----------|------------|
| Q1 | B2 asks the drawer to show Project and Uploaded by "using only real data from `GET /documents/:id`". That endpoint doesn't return either field, and search results don't carry them. Today's drawer hard-codes the uploader as "You". | **Drop both rows from the drawer.** It shows Date uploaded, Size, Pages (when present) and every custom field ("—" when empty). Group F adds a backlog item: "Return `projectName` and `uploadedByEmail` from `GET /documents/:id`". "Only real data" wins over showing a placeholder, and backend changes are out of scope. |
| Q2 | "Fetched once when the admin layout mounts" needs a layout that survives switching admin tabs. Today every admin page draws `AdminTabs` itself, and each admin route wraps its own `AdminGuard` + `AppShell`. | **A nested `/admin` layout route.** It renders `AdminGuard`, then `AppShell`, then the admin layout (PageHeader "Admin settings" + routed Tabs with the pending-count badge), with the tab pages in its outlet. Every URL stays the same, including the `/admin` → `/admin/projects` redirect. The layout owns the pending count and gives pages a way to refresh it. |
| Q3 | E1.1 puts a "Refresh" action in the PageHeader, but under Q2 the PageHeader ("Admin settings") is shared and identical on every admin tab. | **Refresh sits at the right of the recycle bin's own section toolbar** (secondary, `refresh` icon). D1 already puts each section's actions in that toolbar. |
| Q4 | B3.6 keeps failed uploads on the page "so the user can retry or remove them", but B3 defines no retry control. | **"Upload N files" counts waiting and failed files.** Clicking it uploads both, setting failed files back to waiting first. Uploaded files are never re-sent. The remove `IconButton` appears on waiting and failed rows. No extra column or control is added. |
| Q5 | The 360px Drawer "keeps the page behind it usable". If it overlays the table, it hides the right-hand Actions column. | **The drawer pushes the content aside.** It docks inside the page area to the right of the content, which narrows by 360px. There's no backdrop. At 1280px with the 192px sidebar, about 728px is left for the table. |
| Q6 | E1.4's restore copy "The original project was deleted." is wrong when the project was archived: the server sets `requiresProjectChoice` for deleted **or** archived projects and doesn't say which. | **Use "The original project has been deleted or archived."** Ground rule 7 requires accurate copy. |
| A1 | Assumption: the bulk bar is generalised. | **Confirmed.** Group A adds a generic floating bulk bar to `components/ui/` (count, a list of actions, clear), keeping the slice-02 look. `BulkActionBar` becomes a thin wrapper over it with the same props, so `Documents.tsx` doesn't change. Search, Users, Pending and Recycle bin use the generic bar. |
| A2 | Assumption: how Search loads data for the preview and the drawer text. | **Confirmed.** Search results lack MIME type and status, which `DocumentPreviewModal` needs. PREVIEW loads `GET /documents/:id` first, shows a loading state on that row's action, then opens the modal. Filter definitions (`GET /filters`) load once with the page. The drawer's ~600-character text comes from the existing `GET /documents/:id/text`, cut down in the browser, because the detail endpoint's preview is only 150 characters. It's fetched only for PROCESSED documents. |
| A3 | Assumption: profile modal width. | **Confirmed.** `Modal` gains a size of about 640px. No one-off width class. |
| A4 | Assumption: show/hide coverage. | **Confirmed.** Every password field uses the show/hide input: Login, Register, Change password (both fields), Create user, Edit user and the profile modal (both fields). |
| A5 | Assumption: profile "Discard" and Language & Region. | **Confirmed.** Discard resets the Profile fields to the last loaded values and doesn't close the modal. The header close button closes it. With Language & Region removed, `PATCH /auth/me` sends only changed name and email. |
| A6 | Assumption: deleting rejected users, and refreshing the badge. | **Confirmed.** Deleting on the Pending page's Rejected tab (single and bulk) shows the same warning as D4: the account and every document they uploaded are permanently deleted. The pending badge refreshes after every action on Pending, and after single and bulk deletes on Users. |
| A7 | Assumption: unbacked Jobs actions. | **Confirmed.** The Jobs drawer's Download ZIP and Delete, and the table's Retry on failed jobs, are always visible. Each calls a named handler whose body is only a `TODO(backend)` comment. Delete opens a `ConfirmDialog` first, and confirming calls the stub and closes the dialog. |
| A8 | Assumption: restore tooltip and expiry wording. | **Confirmed.** A disabled document Restore (`restorable` false) has the tooltip "Restore the whole project from the Projects tab". Expires reads "in N days", "in 1 day", or "Today" when 0 days remain. Tones: amber at 7 days or fewer, red at 2 or fewer. |
| Q7 | Raised after generation (5 Oct 2026): switching admin tabs briefly flashes a skeleton table, although admin data loads almost instantly. | **No skeleton rows on admin pages for now; this overrides D2.7's "Loading shows skeleton rows" for `/admin/*`.** During the first load the content area renders nothing; the table or empty state appears when the data arrives. A reload with data already shown keeps the table and dims it (`busy`). Documents and Search keep their skeletons. The reviewer may add loading states back later. |

## Original Business Requirement

> Source: the requirement pasted into the `/spdd-analysis` request, reproduced verbatim below. It is followed by the two referenced design files. `DESIGN.md` is reproduced verbatim (fenced) because the `stitch_docindex_construction_document_manager/` folder is deleted in group F. `screen.png` is an image and can't be embedded, so the patterns this run reuses from it are described in words. Where `DESIGN.md` or the screenshot conflicts with the requirement text, the requirement text wins (see Risk & Gap Analysis and Resolved Questions).

/spdd-analysis #file:stitch_docindex_construction_document_manager/screen.png #file:stitch_docindex_construction_document_manager/DESIGN.md

# Initiative: UI redesign to the approved spreadsheet-style design — remaining screens

**Current scope: slices 03–07 together, in one analysis and one canvas.** That covers Search and Upload, Auth and account, the whole admin console, Jobs, and the final clean-up. Slices 01 and 02 are done.

## Why

The stakeholder approved a spreadsheet-style design. The app shell (slice 01) and the Documents page (slice 02) are rebuilt and approved. **Every other screen still uses the old blue Material look**, so the app currently has two visual languages. This run brings every remaining screen into the new design. It is frontend only and makes no backend changes.

## How this run is organised

The scope is large, so the canvas must group its Operations into the **ordered groups A–F** below. Each group must leave `npm run build:full` passing on its own, because `/spdd-generate` is run one group at a time with a build check between groups. Operations inside a group may depend on earlier groups, never on later ones.

Group
Contents

A
New shared components (see "Components to build")

B
Search, `DocumentDrawer`, Upload (old slice 03)

C
Auth pages and the profile settings modal (old slice 04)

D
Admin layout and tabs, Projects, Users, Pending approvals, plus all their modals (old slice 05)

E
Recycle bin, Archive, Filter settings, Jobs (old slice 06)

F
Clean-up (old slice 07). It runs last, only after A–E are in.

## Progress so far (this is the current state of the code)

**Slices 01 and 02 are done.** Their analyses and canvases are in `spdd/`.

- **The Documents page is now the reference implementation.** Every screen in this run must look like it belongs next to it: the same toolbar, table, row-action, badge, empty-state and bulk-bar patterns, and the same density and spacing. When in doubt, copy the pattern from `pages/Documents.tsx` and its components, not from the old pages.
- **Tokens:**

- The new design lives under role-based token names in `client/tailwind.config.js`. Read the config for the exact names.
- The z-index scale is: sticky table header 10, app header 20, bulk bar 30, dropdown/popover 40, modal 50, confirm over a modal 60.
- The legacy Material colour tokens are frozen at their old values, which is why unrestyled pages still look blue. They are deleted in group F.
- **`components/ui/`** already has:

- From slice 01: Button + ButtonLink, IconButton, Badge, StatusBadge, Avatar, Dropdown, Input, Checkbox, Spinner, InlineAlert.
- From slice 02: Modal, ConfirmDialog, Popover, Chip, Table primitives, EmptyState, SummaryBar, TextAction, FormField, Select.
- Read `components/ui/index.ts` for the exact list and APIs. Reuse these components and extend them if needed. Never duplicate them.
- Also reuse the slice-02 bulk bar, table loading skeleton and `DocumentPreviewModal`.
- **The app shell (header and sidebar) is finished.** Don't restyle it.
- **In every file this run touches:**

- Use only the role-based tokens. Remove every legacy class (`primary*`, `on-surface*`, `surface-*`, `outline*`, `error*`, `background-*`, `scrim`, `border-subtle`, `text-label-md`, `text-body-md`, `text-headline-sm`, `font-headline`, `font-display`, `font-body`, `font-label`), every hard-coded `blue-*`/`gray-*` class and every `dark:` class.
- Remove hover-only row actions (`opacity-0 group-hover:opacity-100`).
- Replace native dialogs (`window.confirm`/`window.alert`).

## Design reference

- `screen.png` is the source of truth for look and layout. `DESIGN.md` holds the original tokens.
- Do NOT copy anything from Stitch's exported `code.html`: no classes, no config, and none of its `borderRadius`.
- The font is Inter. Light theme only.

**Badge tones used in this run**

Tone
Used for

Teal
Processed, Active, Admin role, Uploaded (upload queue)

Amber
Pending, Uploading, in-progress operations (Archiving…, Restoring…, Deleting…), expiring within 7 days

Red
Failed, Rejected, expiring within 2 days

Slate
Waiting, User role, Archived, filter type (Text / Number / Date), neutral

**Type:** page title 24/32 semibold; section 18/24; panel 15/20; body 13/18; small 12/16. Column headers and form labels are 11/14 semibold, uppercase, tracking 0.04em. Use `tabular-nums` for all numbers, dates, sizes and counts.

**Shape:** buttons and inputs 4px radius; badges 3px; popovers and modals 6px; table cells square; edge-docked drawers 0px. Surfaces are flat with 1px borders.

## Ground rules (apply to everything)

1. **Frontend only.** Nothing under `server/` changes. No changes to request/response contracts in `client/src/api/`. No new endpoints.
2. **Keep behaviour** (fetching, state, handlers, routes, URL params, permissions) unless this prompt says otherwise. Admin-only UI must stay absent from the DOM for non-admins.
3. **Build screens from shared components** in `client/src/components/ui/`. No one-off copies of button, input, badge, table, drawer or modal styles.
4. **In every file touched:** `window.confirm` → `ConfirmDialog`; `window.alert` → `InlineAlert` or a field error.
5. **No new npm dependencies.**
6. **Features with no backend yet:** render the control and route it to a named handler containing only `// TODO(backend): <what's needed>`. No "coming soon" text, toast or banner. The Jobs preview banner is the one exception (see E4).
7. **Copy:** UK English, sentence case. Dates `12 Oct 2026`, date-times `12 Oct 2026 14:22` (en-GB). Copy must describe current behaviour accurately.
8. **Row actions are always visible.** Icon-only buttons need `aria-label` + `title`. Dropdowns, popovers, drawers and modals close on Escape.
9. **Width:** works at 1280px and 1440px with the 192px sidebar. Mobile is out of scope.
10. `npm run build:full` from `server/` must pass after every group. The client `tsc` has `noUnusedLocals`/`noUnusedParameters`.

## Backend facts the UI must respect

- Search returns **max 20** results: `{ documentId, filename, snippet }`, and the snippet contains `<mark>`.
- **Document and project deletes are soft deletes** into the recycle bin (30 days).
- Archived projects can only be deleted from the archive page (409 otherwise). Deleting an archived project moves it to the recycle bin.
- Admin-created users are ACTIVE with `mustChangePassword: true`.
- **Deleting a user hard-deletes every document they uploaded** (`Document.uploadedBy` `onDelete: Cascade`, with no recycle bin and no deletion log). The UI must warn about this. Fixing it is a separate backend task.
- The password policy is 10+ characters, with an upper-case letter, a lower-case letter, a number and a special character.

## Confirmed decisions still relevant

- **D1:** the app name is "DocIndex Manager", with the subtitle "Site document register".
- **D9:** remove fake UI:

- Google/GitHub login, "Remember me" (unwired) and "Forgot password?" (no reset flow)
- the Documentation/Support links and the "© 2024" footer
- the fake "Logged in devices" list, 2FA and Language & Region
- the fake drawer fields: Edit, Share, "OCR Completed", Author, Dimensions, Version

---

## Group A — Components to build

These are built first because B–E consume them. Put them in `components/ui/` and export them from `index.ts`, unless a different folder is stated.

Component
Spec
First consumer

`PageHeader`
Title (24/32), optional description, optional back `TextAction` above the title, optional actions on the right
Search, Upload, admin layout

`Tabs`
Underline style, NavLink-based for routed tabs, optional count badge per tab
Admin tabs, profile modal (button-based tabs, not routed)

`SegmentedControl` (or a segmented variant of `Tabs`; the canvas decides, but build it once)
"Label (N)" segments
Pending/Rejected, recycle bin Documents/Projects

`Drawer`
Edge-docked right, 360px, white, 1px left border, 0 radius, header with title + close `IconButton`, scrollable body, footer. Closes on Escape. The page behind it stays usable.
Search `DocumentDrawer`, Jobs `JobDrawer`

`AuthLayout` (`components/layout/`)
Full-height `#f8fafc`-role background, centred column. Teal logo icon + app name + subtitle above a white card about 400px wide, with a 1px border, 6px radius and 24–32px padding. No footer.
All auth pages

`PasswordChecklist` + `utils/passwordRules.ts`
Move the duplicated `PASSWORD_RULES` (Register, ChangePassword, profile modal) into one module. The checklist shows one row per rule with a check icon (teal when met, slate when not) in 12/16 text. The rules stay identical.
Register, Change password, profile modal

Password field show/hide
An `IconButton` inside the input, frontend only. Either a `PasswordInput` component or an `Input` option.
Login, Change password, Create user, profile modal

## Group B — Search and Upload

### B1 — Search results (`pages/Search.tsx`)

1. **`PageHeader`:** title "Search results". Description `"<query>" — N results`. When exactly 20 results come back, show "Showing the top 20 results — refine your search" instead.
2. **Register table:** checkbox | Document | Actions.

- The Document cell shows the file name (13px medium) with the snippet beneath it (12/16, secondary colour, clamped to 2 lines). `<mark>` uses the global amber `mark` rule.
- Actions: "PREVIEW" and "DOWNLOAD" `TextAction`s. PREVIEW opens `DocumentPreviewModal`.
- Row click → `/search/:id`, as today.
- Remove the old PDF icon and arrow.
3. **Selection and bulk bar:** reuse the slice-02 bulk bar with "Download ZIP" and "Delete" only. There is no CSV, because search results don't carry those fields.

- Delete opens a `ConfirmDialog`: "They'll move to the recycle bin. An admin can restore them for 30 days."
- A partial failure shows an `InlineAlert`. This replaces today's `window.confirm` and `alert`.
4. **States:**

- Loading: skeleton rows.
- Error: `InlineAlert`.
- No query: `EmptyState` "Search your documents" / "Type at least 2 characters in the search bar to search file names and document text."
- No results: `EmptyState` "No results for "<query>"" / "Try a different word, or browse all documents.", plus a "Browse documents" button → `/documents`.

### B2 — `DocumentDrawer` (on the new `Drawer`)

1. **Header:** file name (truncated) + `StatusBadge` + close.
2. **Metadata:** a key/value list using **only real data** from `GET /documents/:id`: Project, Uploaded by, Date uploaded, Size, Pages (if present) and custom field values ("—" when empty). **Remove** Edit, Share, "Open Preview", "OCR Completed", Author, Dimensions and Version (D9).
3. **Extracted text:** the first ~600 characters, preserving whitespace, then a "Show full preview" `TextAction` that opens `DocumentPreviewModal`.
4. **Footer:**

- "Download" (primary).
- "Delete" (danger). It opens a `ConfirmDialog` with the recycle-bin copy from B1, replacing the old "cannot be undone" `window.confirm`.
- Keep the `onDelete` behaviour.
5. Escape and the close button return to `/search?q=…`, as today.

### B3 — Upload (`pages/Upload.tsx`)

1. **`PageHeader`:**

- "Back to documents" `TextAction` above the title.
- Title "Upload documents".
- Description "Add delivery notes, invoices and site photos to a project."
2. **Two columns:**

- **Left, "Upload details" panel:**

- Project `Select` (from `GET /projects?scope=uploadable`). It has a loading state and an empty state: "No projects available — ask an admin to add you to a project".
- "Document details": one field per custom filter (TEXT / NUMBER / DATE) in a 2-column grid, with the hint "Applied to every file in this batch."
- **Right, drop zone:**

- Dashed 1px strong-border line, 6px radius; teal border and tint while dragging.
- Upload icon, "Drag files here or browse" and "PDF, JPG or PNG". Clicking anywhere opens the file picker.
- **Remove the wrong "Maximum file size 50MB" copy.** There is no size limit.
3. **File queue table** (full width, below the columns): File name | Size | Status | remove `IconButton` (only while the file is waiting or has failed).

- Status uses `Badge`: Waiting (slate), Uploading (amber + spinner), Uploaded (teal), Failed (red, with the error in `title`).
4. **Footer:** "Clear list" (secondary) + "Upload N files" (primary, with a loading state). It is disabled until a project is chosen and there are waiting files.
5. **Validation without `alert()`:**

- Rejected file types → an `InlineAlert` listing the rejected file names.
- Missing project → a field error on the project control.
6. **Upload behaviour:**

- Keep the sequential upload and per-file status updates.
- On full success, show an `InlineAlert` "N files uploaded" and then redirect to `/documents`, as today.
- **If any file failed, do not redirect.** Keep the failures on the page so the user can retry or remove them.

## Group C — Auth and account

### C1 — Login (`pages/Login.tsx`, in `AuthLayout`)

1. Title "Sign in". Description "Use your work email to access your company's documents."
2. Email and Password fields (`FormField`), with show/hide on the password field.
3. Errors appear in an error `InlineAlert` that shows the backend message as-is, so the pending-approval and unverified-email messages stay distinct.
4. Full-width primary "Sign in" button with a loading state.
5. Footer: "Don't have an account? **Request access**" → `/register`.
6. Remove "Remember me", "Forgot password?", social login, the Documentation/Support links and the footer (D9).
7. **Redirect logic is unchanged:** `mustChangePassword` → `/change-password`, otherwise `/documents`. The token is still stored as today.

### C2 — Register (`pages/Register.tsx`)

1. Title "Request access". Description "An admin will review your request. You'll also need to verify your email."
2. Fields: Full name, Work email, and Password with the `PasswordChecklist` below it. Submit stays disabled until every rule passes, as today. The primary button is "Request access", with a loading state.
3. **Success state inside the card:**

- Icon `pending_actions` and heading "Request submitted".
- Text: "Check your inbox for a verification link. Once an admin approves your request you'll be able to sign in."
- A "Back to sign in" button.
4. Footer: "Already have an account? **Sign in**". Remove the D9 items.

### C3 — Change password (`pages/ChangePassword.tsx`)

Title "Set a new password". Description "Your account requires a new password before you can continue." Fields: Current (temporary) password and New password, both with show/hide, plus `PasswordChecklist`. Errors go in an `InlineAlert`. The primary button is "Update password". The logic is unchanged.

### C4 — Verify email (`pages/VerifyEmail.tsx`)

State
Content

Loading
`Spinner` + "Verifying your email address…"

Success
Teal check icon, "Email verified", "Your email is confirmed. You can sign in once an admin has approved your account.", primary "Go to sign in"

Error
Red icon, "Verification failed", the backend message, secondary "Back to sign in"

### C5 — Profile settings modal (`components/layout/ProfileSettingsModal.tsx`)

1. Rebuild it on `Modal` (about 640px wide) with button-based `Tabs`: "Profile" and "Security". Keep its open/close interface, so `AppShell` still re-fetches `/auth/me` when it closes.
2. **Profile tab:**

- Full name and Email fields. Under Email, the hint "Changing your email requires verifying the new address before you can sign in again."
- The role as a read-only `Badge` (Admin teal / User slate).
- Success and errors in an `InlineAlert`.
- Footer: "Discard" (secondary, disabled when nothing has changed) + "Save changes" (primary, with a loading state).
- **Remove Language & Region.**
3. **Security tab:**

- "Change password": current + new password with `PasswordChecklist`, an "Update password" button, and success/error `InlineAlert`.
- "Sign out of this session" (secondary, `logout` icon), keeping the real logout behaviour.
- The note "To delete your account, contact an administrator."
- **Remove "Logged in devices" and "Two-Factor Authentication".**
4. Keep every API call (`PATCH /auth/me`, `PATCH /auth/me/password`) and all state handling.

## Group D — Admin layout, Projects, Users, Pending

### D1 — Admin layout and tabs

1. Every admin page uses the same structure:

- `PageHeader` with title "Admin settings" and description "Manage projects, users and system settings."
- `Tabs` (routed): Projects, Users, Pending approvals, Recycle bin, Archive, Filter settings.
- A section toolbar: search and filters on the left, the primary action on the right.
- Then the content.
2. Rebuild `AdminTabs` on `Tabs`. The routes are unchanged.
3. "Pending approvals" shows a count badge when there are pending users. It uses the existing `getPendingUsers()`, fetched once when the admin layout mounts and refreshed after approve or reject actions.

### D2 — Common admin table rules (these also apply in group E)

1. Use the slice-02 Table primitives: a 28px uppercase header, 1px gridlines, and hover and selected states.
2. **Row actions are always visible.** Use `IconButton`s with `aria-label` + `title`, or `TextAction`s.
3. Dates are en-GB with `tabular-nums`.
4. Selection uses `Checkbox`, including on Pending, where it replaces the avatar-as-checkbox. **Keep shift-click range selection** where it exists (Users, Pending).
5. Bulk actions use the slice-02 floating bulk bar.
6. Every destructive action uses `ConfirmDialog`. Errors use `InlineAlert`.
7. Loading shows skeleton rows. Empty shows an `EmptyState`.

### D3 — Projects (`pages/admin/AdminProjects.tsx`)

1. **Toolbar:** "Search projects" (a client-side name filter; new, frontend only) on the left, and a primary "New project" button on the right.
2. **Table:** Project name | Members (count) | Created | Actions (Manage members, Rename, Archive, Delete).
3. **Empty state:** "No projects yet" / "Create a project, then add members so they can upload documents." + "New project".
4. **Modals:** all of them move onto `Modal`/`ConfirmDialog` and keep their API calls and state.

Modal
Behaviour and copy

Create project
A name field and the hint "You can add members after it's created."

Rename project
A name field, prefilled. Save is disabled when the name is unchanged.

Delete project
A danger `ConfirmDialog` with **corrected copy** (today's "cannot be undone / permanently remove" is wrong): "Delete "<name>"? The project and its documents will move to the recycle bin. An admin can restore them for 30 days." Show the 409 for archived projects as an `InlineAlert`.

Archive project
**Confirm step:** "Archive "<name>"? Its files are zipped and the project is hidden from users until restored." **Progress step:** `Spinner` + "Large projects can take a few minutes." **Result step:** a warning `InlineAlert` listing missing files, when there are any. Then "Done".

Manage members
Two sections. **"Current members":** each row shows an avatar, name/email, a role `Badge` and a remove `IconButton`. **"Add members":** a search box (`GET /users/search`), results with checkboxes, and "Already a member" as a disabled checked row. Footer: Cancel + "Save changes (N)". Keep the existing staged-additions logic, so staged users persist across searches.

### D4 — Users (`pages/admin/AdminUsers.tsx`)

1. **Toolbar:**

- Search box "Search by name or email".
- Role `Dropdown`: All roles / Admin / User.
- Status `Dropdown`: All statuses / Active / Pending / Rejected.
- Sort `Dropdown`: Newest / Oldest / Name A–Z / Name Z–A (client-side, as today).
- A primary "Create user" button on the right.
2. **Table:** checkbox | Name (`Avatar` + name; "No name" in secondary text) | Email | Role (`Badge`: Admin teal, User slate) | Status (`Badge`: Active teal, Pending amber, Rejected red) | Joined | Actions (Edit, Change role, Delete). Replace the page's local account-status `StatusBadge` with `Badge`.
3. **Bulk bar:** "N selected" | "Delete" (danger, `ConfirmDialog`) | clear.
4. **Modals:** all on `Modal`, with their API calls unchanged.

Modal
Behaviour and copy

Create user
Fields: Full name, Email, Temporary password (show/hide), Role (`Select`). Copy: "They can sign in straight away and will be asked to set their own password."

Edit user
Fields: Full name, Email, and an optional New temporary password with the hint "Minimum 8 characters. They'll be asked to set a stronger password at next sign-in."

Change role
Two radio cards with **corrected copy**. **User:** "Can view, upload and delete documents in projects they're assigned to." **Admin:** "Full access to all projects, documents, users and settings."

Delete user
A danger `ConfirmDialog`: "Delete <name or email>? Their account **and every document they uploaded** will be permanently deleted. This can't be undone." Bulk delete uses the same warning with the user count.

### D5 — Pending approvals (`pages/admin/AdminPending.tsx`)

1. `SegmentedControl`: "Pending (N)" / "Rejected (N)".
2. **Table:** checkbox | Name (`Avatar` + name) | Email | Requested (date) | Actions.

- Pending tab: "Approve" (primary, small) + "Reject" (secondary).
- Rejected tab: "Approve" + "Delete" (danger).
3. **Bulk bar:**

- Pending tab: Approve selected / Reject selected.
- Rejected tab: Approve selected / Delete selected.
- Both tabs: Clear.
4. Reject and delete (single and bulk) use a `ConfirmDialog`. Approve needs no confirmation, as today. The calls are unchanged (`PATCH /users/:id/status`).
5. **Empty states:** "No pending requests" / "New sign-ups will appear here for approval."; and "No rejected accounts".
6. Refresh the tab count badge (D1.3) after every action.

## Group E — Recycle bin, Archive, Filter settings, Jobs

Use the admin layout (D1) and the common table rules (D2).

### E1 — Recycle bin (`pages/admin/AdminRecycleBin.tsx`)

1. The `PageHeader` action is "Refresh" (secondary, `refresh` icon).
2. `SegmentedControl`: "Documents (N)" / "Projects (N)".
3. **Documents table:** checkbox | Document (name + size beneath) | Project | Deleted by (name, else email, else "—") | Deleted | Expires | Actions.

- **Expires:** "in N days". Use an amber `Badge` at 7 days or fewer, and red at 2 days or fewer.
- **Actions:** "RESTORE" and "DELETE" `TextAction`s. Restore is disabled, with a tooltip, when `restorable` is false.
4. **Restoring a document:**

- When `requiresProjectChoice` is true, open a `Modal` "Restore to which project?" with the explanation "The original project was deleted.", a project `Select` (active projects) and a "Restore" button.
- Otherwise, restore immediately and show a success `InlineAlert`.
5. **Delete permanently:** a danger `ConfirmDialog`: "Permanently delete "<file>"? This can't be undone."
6. **Bulk bar (documents):**

- "Restore selected" skips items that need a project choice and reports which ones it skipped.
- "Delete permanently" asks for confirmation with a `ConfirmDialog`.
- Both loop over the existing single-item API calls. There are no new endpoints.
7. **Projects table:** Project | Documents | Deleted by | Deleted | Expires | Actions ("VIEW", "RESTORE", "DELETE").

- Archived projects (`isArchived`) show a slate "Archived" `Badge`, with the tooltip "Stored in the project archive – restore the whole project".
8. **Drill-in (VIEW):**

- A "Back to recycle bin" `TextAction`.
- The project name as the section title.
- A read-only documents table (`GET /recycle-bin/projects/:id/documents`).
- The project-level Restore and Delete actions in the toolbar.
9. **Empty states:**

- Whole bin: "Recycle bin is empty" / "Deleted documents and projects stay here for 30 days before they're permanently removed."
- Per tab: "No deleted documents" / "No deleted projects".

### E2 — Archive (`pages/admin/AdminArchive.tsx`)

1. **Toolbar:** search box "Search archived projects".
2. **Table:** Project | Archived (date, with "by <name or email>" in secondary text) | Documents | Members | Size (formatted) | Actions ("DOWNLOAD ZIP", "RESTORE", "DELETE").
3. **When `operation` is set:**

- Show an amber `Badge` next to the name: "Archiving…", "Restoring…" or "Deleting…".
- Disable the actions.
- Download shows a loading state while it runs.
4. **Restore:**

- Confirm with a `ConfirmDialog`: "Restore "<name>"? Files are extracted and the project becomes active again. Large projects can take a few minutes."
- The result `InlineAlert` reports `restoredDocuments`, and lists `missingDocuments` as a warning when there are any.
5. **Delete:** a danger `ConfirmDialog`: "Move "<name>" to the recycle bin? It can be restored for 30 days."
6. **Empty state:** "No archived projects" / "Archive a completed project from the Projects tab to free up the working view."

### E3 — Filter settings (`pages/admin/AdminFilters.tsx`)

1. Section title "Custom filters", with the existing description: "Manage the custom filter fields available on the upload form and document list. Once created, a filter is available to every user." On the right, show the capacity "N / 5 filters".
2. **At 5 filters** (`MAX_ACTIVE_FILTERS`): show a warning `InlineAlert` "Maximum of 5 filters reached. Delete a filter to add a new one." and disable the add form.
3. **Table:** Name | Type (`Badge`: Text / Number / Date) | Created (if the API returns it) | Actions (Edit, Delete; always visible). Keep the existing `order`. There is no reordering, because there is no API for it.
4. **Inline edit** (as today): a name input + a type `Select` + Save / Cancel. If the type changes, show a warning `InlineAlert` in the row before saving: "Changing the type removes the values already entered for this filter on every document."
5. **Delete:** a danger `ConfirmDialog` (replaces `window.confirm`): "Delete the "<name>" filter? It will be removed from the upload form, the document filters and every document that has a value for it."
6. **Add row** below the table: Filter name (placeholder "e.g. Supplier") + a Type `Select` + a primary "Add filter" button. Validation errors appear inline.
7. **Empty state:** "No custom filters yet" / "Add fields like Supplier or Order no. so users can tag and filter documents."

### E4 — Jobs (`pages/Jobs.tsx`, `components/jobs/JobsTable.tsx`, `JobDrawer.tsx`)

1. Restyle the page with the shared table and badges. `JobDrawer` moves onto the new `Drawer`.
2. **Keep exactly one banner:** an info `InlineAlert` "Preview — jobs and background processing arrive in Phase 6. This page shows sample data." The current banner wrongly says "Phase 3"; fix it.
3. Remove the `ComingSoonToast` from this page, and remove the dead toolbar icons (refresh, filter, more).

## Group F — Clean-up (last)

1. **Tokens:**

- Grep for each legacy token before deleting it, and delete it only when it has zero usages: the Material colour keys, `background-light`/`-dark`, the legacy font sizes and families, and any key nothing references.
- The final `tailwind.config.js` holds only the role-based tokens.
- Remove `darkMode: 'class'` **only after** the grep shows zero `dark:` classes in `client/src`.
2. **Dead code:**

- Remove every remaining `dark:` class.
- Delete `components/common/ComingSoonToast.tsx` if nothing imports it, and `components/common/` if it ends up empty.
- Delete any component, type or helper the redesign left unused. Check the imports of every file in `components/` and `utils/`.
- No `window.confirm`/`window.alert` may remain anywhere in `client/src`.
- Replace hard-coded hex colours in components with tokens wherever a token exists.
3. **Consistency check:** visit every route as an admin and as a normal user:

- `/login`, `/register`, `/change-password`, `/verify-email`
- `/documents`, `/documents/:id`, `/search`, `/search/:id`, `/upload`, `/jobs`
- every `/admin/*` tab, the profile modal and every admin modal

On each, check the page title style, table style, button variants, badge tones, date format, the empty, loading and error states, and that Escape closes every overlay. Fix any inconsistencies.
4. **Docs:**

- `docs/project-plan.md` "Known Technical Notes": remove the items the redesign fixed (PDF icon for photos, wrong 50MB copy, Jobs banner phase). Add the frontend `TODO(backend)` hooks: retry processing and register PDF.
- `.github/copilot-instructions.md` "UI Rules": list the final components in `components/ui/`, and remove any mention of legacy tokens or `darkMode`.
- `docs/BACKLOG.md`: add any of these that are missing:

- retry-processing endpoint
- register PDF export
- custom filter values as table columns
- document list pagination (the 50-row cap)
- password reset flow
- storage usage indicator (only if the stakeholder asks)
- **user deletion cascades to uploaded documents** (backend data-loss risk). Likely fix: make `uploadedById` nullable with `onDelete: SetNull`, or deactivate users instead of deleting them.
5. **Design folder:** this is the very last step, after code review. Delete the `stitch_docindex_construction_document_manager/` folder and the `stitch_docindex_construction_document_manager.zip` at the repo root, if present, and check that nothing references them.

---

## Acceptance criteria

#
Criterion

AC1
Search uses the register table with highlighted snippets, the result count and the 20-result message. Selection, ZIP download and recycle-bin delete work. The drawer shows only real data, and "Show full preview" opens the preview modal.

AC2
Upload uses the two-column layout, drop zone, queue table and status badges, with no 50MB copy. Validation is inline. A successful batch redirects as before. Failed files stay on the page.

AC3
Login, Register, Change password and Verify email use `AuthLayout`. None of the D9 items remain. `PASSWORD_RULES` exists once, and `PasswordChecklist` is used in all three password forms. Login redirects and the pending/unverified messages work as before.

AC4
The profile modal uses `Modal` + `Tabs`. Profile update, password change and sign-out work. Devices, 2FA and Language & Region are gone.

AC5
Every admin page uses `PageHeader` + `Tabs`, with the pending count badge. Every admin modal is on `Modal`/`ConfirmDialog`. The project-delete, change-role and delete-user copy is corrected. The archived-project 409 shows inline.

AC6
Users search, filters, sort, shift-click selection and bulk delete work. Pending uses `Checkbox` with shift-click, bulk actions and tab counts.

AC7
Recycle bin: tabs, expiry badges, the project-choice restore modal, drill-in, permanent delete and bulk actions. Archive: in-progress badges, download/restore/delete with correct copy, missing-files reporting. Filters: capacity, the max-5 warning, the type-change warning, delete confirmation, the add row.

AC8
Jobs uses the new design with one accurate Phase 6 banner, no toast and no dead icons.

AC9
No hover-only actions, no `dark:` classes, no legacy tokens, no native dialogs and no unused components remain anywhere in `client/src`. `tailwind.config.js` holds only current tokens.

AC10
Every route passes the consistency check for both roles at 1280px and 1440px. The docs are updated. `npm run build:full` passes.

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

### Referenced file: `stitch_docindex_construction_document_manager/screen.png` (description of the patterns this run reuses)

The screenshot shows only the Documents page, which slices 01 and 02 already built. This run uses it as the pattern for every other screen:

- **Header (finished, not restyled here):** a teal square logo with a lock icon, the app name with a subtitle beneath, a wide search field, a dark navy "Upload Document" button with a plus icon, and the user's name with a round teal avatar. The mock says "SiteVault" and "Apex Construction"; D1 sets the app name to "DocIndex Manager" with the subtitle "Site document register".
- **Toolbar row:** compact white controls with a 1px border and 4px radius ("Project: All Projects", "Filter 2", "Sort: Date Uploaded (Newest)"), a muted count on the right ("Showing 12 documents") and a secondary "Export CSV" menu button.
- **Chips row:** light chips with a muted key and a dark value plus a small ×, then a teal uppercase "CLEAR ALL" text action.
- **Table:** a white table with a 1px border. The header row is a pale `#f8fafc` fill with 11px uppercase muted labels (DOCUMENT, STATUS, UPLOADED BY, DATE UPLOADED with a sort arrow, ACTIONS right-aligned) and a header checkbox. Rows are separated by 1px gridlines. The Document cell shows the file name with the size beneath in smaller muted text. Status pills are compact, with a coloured dot (teal "Processed", amber "Processing", red "Failed (OCR Error)"). Dates read `12 Oct 2026 14:22`. Row actions are always visible: teal "PREVIEW" and muted "DOWNLOAD" uppercase text actions separated by a slash, or a red "RETRY OCR".
- **Summary bar:** a pale strip under the table ("Total: 12 files • 15.4 MB stored • Last sync 2m ago" on the left, "Indexed & Synced" on the right).
- **Overall feel:** flat, white, dense; 1px `#e2e8f0` lines; teal for primary and positive states; no shadows except on floating overlays.

## Domain Concept Identification

### Existing Concepts (from codebase)

**Documents and search**

- **Document**: an uploaded file in a project. It has a status (Uploaded → Processing → Processed or Failed; Queued is defined but never set), a size, MIME type, uploader, upload time, page count and custom field values. Deleting it is a soft delete into the recycle bin for 30 days. The UI `Document` type, shared by Documents, Search and the preview modal, is a display shape built from the API document.
- **Search result**: a lightweight hit (document id, file name, snippet). The top 20 matches come back, only for queries of 2+ characters, and only from documents the caller can see. The snippet is a stretch of text, or "Filename: …", with the match wrapped in `<mark>`. The server doesn't HTML-escape the text around the tags.
- **Document detail** (`GET /documents/:id`): metadata, page count, a 150-character text preview and custom field values. It doesn't include the project name or the uploader (Q1).
- **Extracted text** (`GET /documents/:id/text`): the full text of a processed document. "Not found" means it has no text.
- **Document preview modal** (slice 02): takes a full UI document plus the filter definitions. It loads the file, the details and the full text itself. Search reuses it (A2).
- **Bulk document actions**: ZIP export through `ExportModal`, and bulk soft delete (`POST /documents/bulk-delete`), which reports how many were deleted and which failed.

**Upload**

- **Upload batch** (browser only): a queue of files, each with a status (waiting, uploading, uploaded, or failed with an error). Files go one at a time to `POST /documents/upload`, each with the chosen project and the batch's custom field values. Accepted types are PDF, JPEG and PNG, on both client and server. Neither side has a size limit.
- **Uploadable project**: `GET /projects?scope=uploadable`. For a normal user, the projects they belong to; for an admin, every live project. Today the first one is pre-selected.
- **Custom filter definition**: a name, type (Text / Number / Date), order and created date. There are at most 5 (`MAX_ACTIVE_FILTERS` on the client, with a matching constant on the server). Changing a filter's type deletes every stored value for it on the server.

**Accounts and authentication**

- **User account**: email, full name, role (Admin / User), account status (Pending / Active / Rejected), a must-change-password flag and a created date. Self-registered users start Pending and must verify their email. Admin-created users start Active with must-change-password set. Deleting a user is a hard delete that also deletes every document they uploaded.
- **Session**: the access token is kept in `sessionStorage` under `accessToken`; the refresh token is an HttpOnly cookie. Login returns the token plus `mustChangePassword`.
- **Password policy**: 10+ characters with an upper-case letter, a lower-case letter, a number and a special character. The server enforces it for registration and for changing your own password. The client copies it identically into Register, ChangePassword and the profile modal. Admin-set temporary passwords don't follow it (create accepts any non-empty value; edit needs 8+ characters), and the user has to replace them at sign-in.
- **Email verification**: a token link to `/verify-email?token=…`. The server sends it on registration and when a user changes their email.
- **Profile**: the signed-in user's name, email and role, plus language and timezone fields that nothing else uses. Saved through `PATCH /auth/me` and `PATCH /auth/me/password`.
- **Current user context** (slice 02): `AppShell` loads `/auth/me` and shares the result, and `useIsAdmin` reads it. It reloads when the profile modal closes.
- **Admin guard**: checks `/auth/me` and sends non-admins to `/`, so admin UI never renders for them.

**Administration**

- **Project** (admin view): name, created date and member count. Only live projects (not deleted, not archived) are listed. Deleting one is a soft delete that takes its active documents into the recycle bin with it. Archived or archiving projects return 409.
- **Project membership**: a user's access to a project, managed by add and remove calls. Finding users uses a search capped at 50 results.
- **Archived project**: the archive date and who archived it, the ZIP size, document and member counts, and an in-progress `operation` (archiving, restoring or deleting). Archiving and restoring report missing files; restoring also reports how many documents came back. Deleting an archived project moves it to the recycle bin.
- **Recycle bin entry**: either a deleted document (project, who deleted it, days remaining, `restorable`, `requiresProjectChoice`) or a deleted project (document count, who deleted it, days remaining, `isArchived`). Retention is 30 days. A deleted project can be opened to list the documents deleted with it. Restore and permanent delete are single-item calls.
- **Pending approval**: the Pending and Rejected user lists. Approving or rejecting changes the account status.
- **Admin navigation**: six routed tabs under `/admin/*`. Today each page draws them itself.

**Jobs**

- **Job** (mock): a type, status, owner, timings and a file list, held as sample data in the page. `/jobs/:id` opens its drawer. No backend exists yet (Phase 6).

**Design system**

- **Role-based tokens and type scale**: colours, type sizes, radii, the overlay shadow and the z-index scale in `tailwind.config.js`. The legacy Material keys sit alongside them, frozen, and `darkMode: 'class'` keeps the `dark:` classes inactive.
- **Shared UI library** (`components/ui/`): Button + ButtonLink, IconButton, Badge, StatusBadge, Avatar, Dropdown, Input, Checkbox, Spinner, InlineAlert, Modal, ConfirmDialog, Popover, Menu, Chip, the Table primitives (with skeleton rows), EmptyState, SummaryBar, TextAction, FormField and Select.
- **Formatting helpers** (`utils/format.ts`): dates as `12 Oct 2026`, date-times as `12 Oct 2026 14:22`, file sizes, and counts formatted for en-GB.

### New Concepts Required

- **PageHeader**: the title block of a page, with an optional description, back link and actions. Used by Search, Upload and the admin layout.
- **Tabs**: switches between sibling views. There are two modes. Routed tabs are links and can show a count badge. In-page tabs switch a panel. Used by the admin layout and the profile modal.
- **SegmentedControl**: a compact in-page switch with "Label (N)" segments, for Pending/Rejected and the recycle bin's Documents/Projects. It's built once (see Key Design Decisions for how it relates to Tabs).
- **Drawer**: a non-modal side panel docked at the right of the page area. It pushes the content aside (Q5), has a header, a scrollable body and a footer, and closes on Escape. Used by the Search document drawer and the Jobs drawer.
- **AuthLayout**: the centred card frame for the four signed-out pages, with the app identity above the card.
- **Password rules and PasswordChecklist**: one definition of the five client-side rules, and a checklist that shows whether each one is met. Used by Register, Change password and the profile modal.
- **Password show/hide input**: a password field with a reveal toggle, used on every password field (A4).
- **Generic bulk bar**: the slice-02 floating bar, made to take any set of actions (A1).
- **Admin layout**: the shared admin frame (Q2). It holds the PageHeader, the routed tabs and the pending-approvals count, and gives pages a way to refresh that count.
- **Section toolbar** (a layout pattern, not necessarily a component): search and filters on the left, the section's actions on the right, below the admin tabs.
- **Expiry urgency**: the days a recycle-bin entry has left, shown in slate, amber (7 days or fewer) or red (2 or fewer), with "Today" at 0 (A8).
- **Retryable upload**: a failed queue entry that the next upload run tries again (Q4).
- **Bulk outcome report**: the result of a bulk action made of single-item calls, listing what failed and, for restores, what was skipped. Shown in an `InlineAlert`.

### Key Business Rules

- **Only real data and real controls (D9, ground rule 6):** nothing may show invented values or unwired controls. A feature without a backend gets a control wired to a `TODO(backend)` stub, never "coming soon" text. The Jobs preview banner is the only exception. *Governs the Search drawer, auth pages, profile modal and Jobs.*
- **Admin-only UI never reaches non-admins:** admin pages stay behind `AdminGuard`, and only the admin layout fetches the pending count. *Governs the admin layout and routing.*
- **Document and project deletes can be undone for 30 days:** every document and project delete confirmation must say so. Only "Delete permanently" in the recycle bin is final. *Governs Search, the drawer, Projects, Archive and the recycle bin.*
- **User deletes are final and destroy that user's documents:** every user-delete confirmation must say so, including bulk deletes and the Pending page's Rejected tab (A6). *Governs Users and Pending.*
- **Archived projects can only be deleted from the Archive page:** the Projects page shows the 409 inline rather than hiding the action. *Governs Projects and Archive.*
- **A restored document needs a live project:** if its project is deleted or archived, the admin picks an active project. A document deleted along with an archived project can only come back with the whole project. *Governs the recycle bin.*
- **A running archive operation locks its row:** download, restore and delete are disabled while `operation` is set. *Governs Archive.*
- **At most 5 custom filters, and changing a filter's type erases its values:** adding is disabled at 5, and a type change shows a warning before saving. *Governs Filters.*
- **Upload rules:** PDF, JPG or PNG only; no size limit; a project is required; custom field values apply to every file in the batch; files upload one at a time; the page moves on to Documents only when every file succeeded. *Governs Upload.*
- **The same password policy applies wherever users set their own password,** and submit stays disabled until every rule passes. Admin temporary passwords keep today's looser checks. *Governs Register, Change password, the profile modal and the admin user modals.*
- **Sign-in outcomes:** the backend's message is shown unchanged, so the pending-approval and unverified-email messages stay distinct. Must-change-password goes to `/change-password`; anything else goes to `/documents`. *Governs Login.*
- **Changing your email needs re-verification before your next sign-in.** *Governs the profile modal.*
- **Search returns at most 20 results,** and the page says so when exactly 20 come back. *Governs Search.*
- **Copy and format:** UK English, sentence case, `12 Oct 2026` and `12 Oct 2026 14:22`, and `tabular-nums` for numbers. *Governs every screen.*
- **Implicit — a selection never survives a change of view:** Users and Pending clear the selection when the search, filters, sort or tab change, so a bulk action never touches rows the admin can't see. This stays, and applies to Search and the recycle bin too. *Governs Users, Pending, the recycle bin and Search.*
- **Implicit — shift-click selects the visible range,** in the current filtered and sorted order. *Governs Users and Pending.*
- **Implicit — staged members survive searching:** in Manage members, users ticked in one search stay ticked through later searches until they're saved or the modal closes. *Governs Manage members.*

## Strategic Approach

### Solution Direction

- **Six groups in dependency order (A → F), each leaving the build green.** A builds every shared piece first. B–E rebuild screens using only A and the slice-01/02 library. F runs last and removes whatever A–E left unused. Each group ends with `npm run build:full` passing.
- **The Documents page is the pattern.** Every screen copies its structure: a `main` page area with the same padding, a toolbar row, alerts, then the table or its empty, loading or error state. The bulk bar floats at the bottom and dialogs come last. Tables use the slice-02 primitives, skeleton rows and `EmptyState`.
- **Data flow is unchanged:** page → existing `api/` services → local state → `components/ui/`. No API contract changes. New behaviour stays in the browser: the project name filter, the user sort, retrying uploads, bulk actions that loop over existing single-item calls, the expiry colours and shortening the drawer text.
- **Behaviour is carried over deliberately.** Each rebuilt page keeps its fetching, state, handlers, routes and URL params. The behaviours under Key Business Rules (redirects, shift-click, staged members, the archive steps, the restore project choice, clearing the selection) are named per operation in the canvas, so a rewrite can't quietly drop them.
- **Overlays follow the slice-02 rules.** `Modal` and `ConfirmDialog` render at the end of the page body and manage focus and Escape. The new Drawer is non-modal, docked in the page, and closes on Escape only when nothing is open above it.
- **Clean-up is based on evidence.** A legacy token key is deleted only when a search shows nothing uses it. `darkMode` goes only when a search for `dark:` classes comes back empty. Dead files are found by checking imports.
- **Docs close the loop.** In F, the project plan, the UI Rules in the project instructions and the backlog are updated to describe the finished state.

### Key Design Decisions

- **The admin layout is a nested route (Q2):** a wrapper in each page is quicker to add, but re-runs the admin check and re-fetches the count on every tab switch, and every page has to remember to use it. A nested `/admin` route needs one change in `App.tsx`, then renders the guard, shell, header, tabs and count once, with every URL unchanged. → **Nested layout route.** The layout holds the pending count and its refresh, and pages reach the refresh through the router's outlet context or a small context. This is the run's only routing change.
- **The drawer pushes the content (Q5):** an overlay keeps the table's full width but covers its right-hand columns, including the row actions. Pushing narrows the table but hides nothing. → **Push.** The drawer is a docked column inside the page area, not rendered at the end of the page body. Tables must still work at about 728px. Search has three columns; for Jobs, the canvas picks which columns truncate while the drawer is open.
- **A generic bulk bar behind a compatibility wrapper (A1):** changing `BulkActionBar`'s props would mean editing the approved Documents page, and a second bar would be a duplicate. → **Move the bar's look into a generic `components/ui` bar that takes a list of actions, and keep `BulkActionBar` as a thin wrapper with today's props.** Documents and Search keep using the wrapper; the admin pages use the generic bar.
- **Tabs and SegmentedControl:** the requirement allows one component or two. In-page tabs and segments behave the same way (pick one view, move with the arrow keys, optional count) and differ only in look, while routed tabs are links. → **One `Tabs` component with a routed mode and an in-page mode, with `SegmentedControl` as the segmented look of the in-page mode,** exported under its own name so pages read clearly. Keyboard handling and counts are written once.
- **Show/hide is its own component:** adding a trailing button to `Input` would complicate every input for one case. → **A `PasswordInput` built on `Input`.** It owns the toggle's `aria-label` and `title` ("Show password" / "Hide password") and keeps the field's value and autocomplete.
- **Where the password rules live:** the rules are plain data used by three forms, and the checklist is UI. → **The rules go in `utils/passwordRules.ts` and the checklist in `components/ui/`.** The rules move unchanged, including the exact set of special characters.
- **Search loads the preview on demand (A2):** making `DocumentPreviewModal` load by id would change an approved slice-02 component and the Documents page, and loading every result's details up front costs up to 20 extra calls. → **Load the clicked document, then open the modal.** Filter definitions load once with the page.
- **Snippets render without raw HTML:** Search currently inserts the server snippet as HTML, and the server doesn't escape the text around `<mark>`. Markup in a file name or in document text would therefore run in the page. → **Split the snippet on the `<mark>` tags and render plain text with highlighted spans.** It looks the same, keeps the global `mark` style and closes the injection path, all in the frontend.
- **Uploads are retried through the main button (Q4):** a per-row Retry would add a control the requirement doesn't list. → **"Upload N files" takes waiting and failed files.** The automatic move to Documents (after a short pause with the "N files uploaded" alert) happens only when every file in the run succeeded.
- **The recycle bin's Refresh goes in its section toolbar (Q3):** the PageHeader is shared by every admin tab. → **Right-hand side of the section toolbar.**
- **Bulk recycle-bin actions loop over single-item calls,** because there are no bulk endpoints. → **Run them one at a time, collect the results, then report** what succeeded, what failed and what was skipped (documents that need a project choice, or can't be restored on their own). Reload once at the end.
- **One selection helper for Users and Pending:** each page has its own shift-click logic today. → **Write one small selection helper** while rebuilding Users, and reuse it on Pending. It keeps today's behaviour exactly (range over the visible list, cleared when the filters, sort or tab change) and works from both the checkbox and the row.
- **Profile modal width (A3):** → **Add a size to `Modal`** rather than a one-off class.
- **Legacy tokens are deleted one key at a time, each checked by search:** Tailwind silently ignores classes it doesn't know, so a forgotten legacy class doesn't fail the build; it just loses its style. → **Delete a key only when a search for its class names comes back empty,** counting prefixes such as `hover:` and opacity suffixes. Then check every route by eye (F3).
- **How the `dark:` check is written:** a plain search for `dark:` also matches the `dark` button variant key in `buttonStyles.ts`. → **Search for `dark:` followed by a class name** (`dark:` then a letter or `[`), so "zero" means no dark-mode classes. The variant key stays.
- **Hard-coded hex colours:** the auth pages' `#15202b` and `#0d141b` go away when those pages are rewritten. The scrollbar colour in `index.css` (`#cbd5e1`) is the `line-strong` token. → **Reference the token from CSS** (Tailwind's `theme()`), so no hex value remains where a token exists.
- **Removing the stitch folder:** it's tracked in git, and no zip exists. → **Delete it last, through git, after the code review.** The older `spdd/` analyses and canvases mention its path as history; they're records and aren't edited. This analysis copies `DESIGN.md` word for word, so the design reference survives.

### Alternatives Considered

- **A wrapper in each admin page:** rejected (Q2). It re-fetches the pending count and re-runs the admin check on every tab switch.
- **An overlay drawer:** rejected (Q5). It covers the Actions column.
- **"—" for Project and Uploaded by in the drawer:** rejected (Q1). It suggests the data exists and is empty.
- **Finding the drawer's project and uploader in the documents list:** rejected. The list is capped at 50 rows and filtered, so a search hit is often missing from it.
- **`DocumentPreviewModal` loading by id:** rejected. It changes an approved component and the Documents page for a single consumer.
- **A separate admin bulk bar:** rejected. It duplicates the slice-02 bar, against ground rule 3.
- **A Retry button on each failed upload:** rejected (Q4).
- **Polling archive operations:** not requested, and not how it works today. The page shows each `operation` as of its last load.
- **Applying the strong password policy to admin temporary passwords:** rejected. It changes behaviour the server doesn't enforce, and users must replace the temporary password anyway.
- **Keeping Language & Region because it works:** rejected by D9. Nothing else uses language or timezone, and the project plan already lists them for removal.
- **Restyling the legacy tokens instead of deleting them:** rejected by F1. The final config holds only role-based tokens.
- **Keeping `ComingSoonToast` for later:** rejected by F2 and ground rule 6.

## Risk & Gap Analysis

### Requirement Ambiguities

- **Admin searches that match nothing:** D3's project search, D4's user search and filters, and E2's archive search can all leave an empty table, but only the "no data at all" empty states are specified. → The canvas adds a "no matches" `EmptyState` on each page (for example "No projects match "<query>"" with a "Clear search" action), like the Documents page's filtered empty state. Archive already has "No archived projects match your search".
- **The pending badge at zero:** D1.3 shows it "when there are pending users". → No badge at 0, while loading, or after a failed fetch.
- **Pending users on the Users page:** they're listed there but can't be approved there. → Unchanged; approval stays on the Pending tab.
- **Profile email-change message:** C5 doesn't restate it. → Keep today's text ("Profile saved. Check your new inbox — you must verify the address before your next sign-in.") in a success `InlineAlert`.
- **Verify-email success text vs the API message:** the server says "Email verified successfully. You can now sign in once your account is approved."; C4 fixes the on-screen copy. → Use C4's copy on success, and the API message on error.
- **Archive delete copy:** today's text says the project can be restored "to the archive"; E2.5 says "It can be restored for 30 days". Both are accurate, and the requirement's text is used.
- **Recycle bin project view:** E1.8 puts project-level Restore and Delete in the toolbar and makes the documents table read-only. → No per-row actions or selection there.
- **Recycle bin selection across tabs:** only the Documents tab has a bulk bar. → No checkboxes on the Projects tab, and switching tabs clears the document selection.
- **"Check that nothing references them" (F5):** older `spdd/` files mention the stitch folder's path. → They're historical records and stay as they are. The check covers code, config and the current docs.
- **The Jobs table beside the drawer:** with the drawer pushing the content, Jobs has about 728px. → The canvas decides which columns truncate.

### Edge Cases

- **Search:** a deep link to `/search/:id` for a document that's been deleted, is out of scope or doesn't exist shows an error in the drawer with a close action, not a blank panel. PREVIEW on such a row shows an error `InlineAlert`. Exactly 20 results may mean exactly 20 exist; the message shows anyway, as B1 accepts. A query under 2 characters shows "Search your documents". Deleting the open document closes the drawer and removes the row, as today.
- **Search snippets:** a file-name match produces "Filename: …" as the snippet, which is shown as it is. A `<` or `&` in a file name or text must appear as typed (see the snippet decision).
- **Upload:** if every chosen file is rejected, only the rejected-files alert appears and no rows are added. Files added during an upload join as waiting and are sent on the next run, not the current one. With no uploadable projects, the empty project state shows and Upload stays disabled. If the project or filter list fails to load, an error `InlineAlert` shows. Leaving mid-upload behaves as today: the current request carries on and nothing is shown. Number and date fields keep today's browser validation.
- **Login and Change password:** opening Change password without a token redirects to `/login`, as today. Pending or unverified accounts get the backend message unchanged.
- **Profile modal:** closing with unsaved edits discards them, and reopening reloads from `/auth/me`. Changing the email and then closing makes the shell reload the user.
- **Admin layout:** if the pending-count call fails, there's no badge and no error on the other tabs. A non-admin opening any `/admin/*` URL is redirected before anything renders, as today.
- **Users:** a bulk delete with some failures shows a summary of the failures, and the failed users stay selected. An admin can delete their own account, because the server doesn't prevent it; that's unchanged here and noted for the backlog. A shift-click after a filter change starts a new range.
- **Pending:** approving the last pending user shows the Pending empty state and removes the badge. A bulk action with some failures shows a summary `InlineAlert`.
- **Projects:** deleting a project that's being archived, or that another admin just archived, shows the 409 message inline. Save stays disabled for a name that's empty after trimming.
- **Recycle bin:** with 0 days left, Expires reads "Today" in red. If a document needs a project choice and there are no active projects, the restore modal says so and disables Restore. If a bulk restore skips every item, it reports that and makes no calls. If an item expired or was purged after the page loaded, the server's error shows inline and the page reloads.
- **Archive:** while an operation runs and there's no ZIP size yet, Size shows "—". If a download fails, an error `InlineAlert` shows and the row returns to normal. A restore with missing files lists them as a warning in the result.
- **Filters:** editing is still allowed at 5 filters; only adding is blocked. A duplicate name or other server validation error shows inline under the row or the add form. The type-change warning appears only when the chosen type differs from the saved one.
- **Jobs:** `/jobs/:id` for an unknown id shows the list with no drawer, as today.
- **Escape order:** with a confirm dialog over a modal over a drawer, each Escape closes only the top layer. A Dropdown inside a modal closes before the modal.
- **Widths:** at 1280px the widest tables are Users (7 columns), recycle-bin Documents (7) and Archive (6, plus three text actions). Names and emails truncate and keep the full text in a `title`. Dates, sizes and counts never wrap.

### Technical Risks

- **Behaviour lost in large rewrites:** about 30 files are rewritten, several over 15 KB. → The canvas names each preserved behaviour per operation, and code review checks each against the old file.
- **Unstyled classes don't break the build:** after F deletes the legacy keys, any class that was missed still compiles but renders unstyled. → Check each key by search, then check every route by eye, as an admin and as a normal user (F3).
- **The admin layout routing change:** moving `AdminGuard` and `AppShell` into a parent route changes when they mount. The shell's current-user context must still wrap the admin pages, and the `/admin` redirect must still work. → URLs stay identical; open every admin tab directly by URL and by clicking through the tabs.
- **Generalising the bulk bar:** the Documents page must look and behave exactly the same after `BulkActionBar` becomes a wrapper. → Compare the Documents page before and after group A.
- **Each group must build on its own:** if a group removes the last use of a shared piece (for example `AdminTabs`, `ComingSoonToast`, or the local status badge in Users), a leftover import fails `tsc`. → Delete or rewire it in the group that removes the last use. F only removes things that are already unused.
- **Script injection through search snippets:** this exists today and is closed on the frontend by the snippet decision. The server should escape snippets too; that's a separate backend task, so it's added to the backlog.
- **Unused-variable build errors:** removing Language & Region, the toast, the fake drawer fields and the local status badge leaves state and imports that `noUnusedLocals` rejects. → Remove them in the same operation.
- **The drawer inside the shell's frame:** the shell's page area hides overflow, so the docked drawer must scroll on its own. The bulk bar and dialogs must stay above it in the z-index scale.
- **Stale archive operations:** there's no polling, so a row stays locked until the page reloads. This is unchanged, and acceptable for now.
- **Password rules drifting:** the client's set of special characters must still match the server's rule; moving the rules into one module must not change them.
- **Client error messages hide or misstate server errors** (found while writing the canvas): `api/projects.ts` `deleteProject` throws a fixed "Failed to delete project", so the archived-project 409 message can never reach the page (D3, AC5). `api/documents.ts` turns a 413 into "File too large. Maximum size is 50MB", the same wrong limit B3 removes. ? Change only these error texts: `deleteProject` passes the server's `message` through (the pattern `filters.ts` and `users.ts` already use), and the 413 text drops the 50MB claim. Requests and responses are unchanged, so ground rule 1 still holds.

### Acceptance Criteria Coverage

| AC# | Description | Addressable? | Gaps/Notes |
|-----|-------------|--------------|------------|
| AC1 | Search: register table, highlighted snippets, result count, 20-result message; selection, ZIP and recycle-bin delete; drawer shows only real data; "Show full preview" opens the preview modal | Yes | The drawer drops Project and Uploaded by (Q1). PREVIEW loads the document first (A2). Snippets render without raw HTML. |
| AC2 | Upload: two columns, drop zone, queue table, status badges, no 50MB copy, inline validation, redirect on success, failures stay | Yes | Failed files are retried through the main button (Q4). |
| AC3 | Auth pages in `AuthLayout`, no D9 items, `PASSWORD_RULES` once, `PasswordChecklist` in all three password forms, login redirects and messages unchanged | Yes | Every password field gets show/hide (A4). |
| AC4 | Profile modal on `Modal` + `Tabs`; profile update, password change and sign-out work; devices, 2FA and Language & Region gone | Yes | New ~640px modal size (A3). Discard resets the fields (A5). |
| AC5 | Admin pages use `PageHeader` + `Tabs` with the pending badge; every admin modal on `Modal`/`ConfirmDialog`; corrected copy; archived-project 409 inline | Yes | Nested layout route (Q2). The recycle bin's Refresh sits in its toolbar (Q3). |
| AC6 | Users: search, filters, sort, shift-click, bulk delete. Pending: checkboxes, shift-click, bulk actions, tab counts | Yes | One shared selection helper. Rejected-user deletes carry the documents warning (A6). |
| AC7 | Recycle bin: tabs, expiry badges, project-choice restore, drill-in, permanent delete, bulk actions. Archive: in-progress badges, actions and copy, missing files. Filters: capacity, max-5 warning, type-change warning, delete confirmation, add row | Yes | Restore copy corrected (Q6). Tooltip and "Today" wording (A8). Bulk actions loop over single-item calls. |
| AC8 | Jobs in the new design with one accurate Phase 6 banner, no toast and no dead icons | Yes | Unbacked actions become `TODO(backend)` stubs (A7). |
| AC9 | No hover-only actions, `dark:` classes, legacy tokens, native dialogs or unused components; the config holds only current tokens | Yes | The `dark:` check must ignore the `dark` button variant key. Hover-only actions also exist in `ManageMembersModal`, `DocumentDrawer` and `JobDrawer`, which this run rebuilds anyway. |
| AC10 | Every route passes the consistency check for both roles at 1280px and 1440px; docs updated; build passes | Partial | The check is manual, because the client has no test runner or visual tests. Besides the F4 list, the backlog gains the Q1 item (project and uploader on `GET /documents/:id`), server-side snippet escaping, and stopping admins deleting their own account or the last admin. |
