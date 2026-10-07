# Phase 4.5 — Pilot readiness · Slice 3 of 3: client (Groups D and E)

This is one slice of the Phase 4.5 canvas, with the review amendments already applied. It is self-contained: implement only the operations below, in order, and don't open the full canvas. The Norms and Safeguards at the end apply to every operation.

### Group D — Sessions and admin guards (client)

#### D1 Create Client API Helper - `client/src/api/http.ts` (P5, RQ9)
1. Exports:
   - `API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:3000')`, so a production build without the variable still works on any hostname. This is the only definition; the per-file constants are removed in D2.
   - `TOO_MANY_ATTEMPTS_MESSAGE = 'Too many attempts. Wait a few minutes and try again.'` and `SESSION_ENDED_MESSAGE = 'Your session has ended. Sign in again.'`.
   - `getAccessToken(): string | null`, `setAccessToken(token: string): void` and `clearAccessToken(): void`. They use `sessionStorage` key `'accessToken'` (unchanged, so open tabs keep working). Nothing else in the client touches this key.
   - `readErrorMessage(response: Response, fallback: string): Promise<string>`:
     - Parses JSON (`.catch(() => null)`).
     - Returns `message` when it's a string, `message.join(' ')` when it's a string array, else `fallback`.
   - `type RefreshResult = { kind: 'ok'; token: string } | { kind: 'signed-out' } | { kind: 'unavailable' }` and `SERVER_UNAVAILABLE_MESSAGE = "Can't reach the server right now. Try again in a moment."` (exported).
   - `refreshAccessToken(): Promise<RefreshResult>`:
     - **Single-flight:** a module-level `inFlight` promise is reused by concurrent callers in this tab and cleared in `finally`.
     - **The refresh itself:** `fetch(\`${API_URL}/auth/refresh\`, { method: 'POST', credentials: 'include' })`.
       - On `ok`, `setAccessToken(body.accessToken)` and return `{ kind: 'ok', token }`.
       - On **401 or 403**, return `{ kind: 'signed-out' }`. Only these mean the session has really ended.
       - On a 429, any 5xx or a network error, return `{ kind: 'unavailable' }`. Render stops the app for a few seconds on every deploy and the office shares one IP, so these must never sign anyone out.
     - **Across tabs:** when `'locks' in navigator`, run the refresh inside `navigator.locks.request('docindex-auth-refresh', run)`, so tabs sharing the cookie rotate it one after another. Otherwise run it directly.
   - `ensureSession(): Promise<'signed-in' | 'signed-out' | 'unavailable'>`: `'signed-in'` if `getAccessToken()`; otherwise map the `refreshAccessToken()` result (`ok` → `'signed-in'`).
   - `apiFetch(path: string, init: RequestInit & { auth?: boolean } = {}): Promise<Response>`:
     1. Split out `auth` (default `true`) and `headers`.
     2. `send(token)` builds `new Headers(headers)`, sets `Authorization: Bearer <token>` when `auth && token`, and calls `fetch(\`${API_URL}${path}\`, { ...rest, headers, credentials: 'include' })`.
     3. When `auth`, use `getAccessToken()`; if there's none, call `refreshAccessToken()`. `signed-out` → `handleSessionEnded()` and throw `new Error(SESSION_ENDED_MESSAGE)`. `unavailable` → throw `new Error(SERVER_UNAVAILABLE_MESSAGE)` without clearing the token or redirecting.
     4. `response = await send(token)`. If `fetch` rejects (network error), throw `new Error(SERVER_UNAVAILABLE_MESSAGE)`.
     5. When `auth && response.status === 401`, refresh once.
        - `signed-out`: `handleSessionEnded()` and throw `SESSION_ENDED_MESSAGE`.
        - `unavailable`: throw `SERVER_UNAVAILABLE_MESSAGE` without clearing the token or redirecting.
        - `ok`: retry once with the new token. A second 401 also leads to `handleSessionEnded()` and a throw.
     6. `413` → throw `new Error(await readErrorMessage(response, 'The file is too large to upload.'))`.
     7. `429` → throw `new Error(await readErrorMessage(response, TOO_MANY_ATTEMPTS_MESSAGE))`.
     8. Otherwise return `response`. Callers keep their own `ok` / status handling.
   - `handleSessionEnded()` (not exported):
     - `clearAccessToken()`.
     - If a module flag `redirecting` is set, or the current path is public (`/login`, `/register`, `/verify-email`), return.
     - Otherwise set the flag and `window.location.assign('/login?next=' + encodeURIComponent(pathname + search))`.
2. Constraints:
   - Request and response shapes stay unchanged.
   - Bodies are strings or `FormData`, so retrying is safe. `Content-Type` isn't set for `FormData`.

#### D2 Migrate Every Client API Module to `apiFetch`
1. Rules for every function:
   - Remove the local `API_URL`, the `sessionStorage` reads, the `if (!accessToken) throw …` guards, the `Authorization` headers and `credentials`.
   - Call `apiFetch('/path', { method, headers: { 'Content-Type': … } when JSON, body })`.
   - Keep every existing non-ok branch and message, apart from the changes listed below.
2. `client/src/api/auth.ts`:
   - `register`, `login` and `verifyEmail` use `{ auth: false }`.
   - `getMe()`, `logout()`, `updateMe(profileData)` and `changePassword(currentPassword, newPassword)` lose their `accessToken` parameter.
   - The `User`, `LoginResponse` and `RegisterResponse` types are unchanged.
3. `client/src/api/documents.ts`: all methods.
   - In `uploadDocument`, delete the `401` and `413` branches, which `apiFetch` now handles. Keep the `400` branch and the generic fallback.
4. `client/src/api/exports.ts`: `getDocumentBlob`, `downloadDocument` and `exportDocuments`. The filename decoding from B9 stays.
5. `client/src/api/archive.ts`: delete `authHeaders` and `readError`. Use `apiFetch` with `readErrorMessage`, keeping the same fallbacks.
6. `client/src/api/filters.ts`, `projects.ts` and `recycleBin.ts`: all functions. Each file's local token helper is deleted.
7. `client/src/api/users.ts`: all functions, plus these changes:
   - `setUserRole`: `throw new Error(await readErrorMessage(response, 'Failed to update user role'))`.
   - `deleteUser`: `throw new Error(await readErrorMessage(response, 'Failed to delete user'))`.
   - `bulkDeleteUsers` returns `{ succeeded, failed, firstError?: string }`. `firstError` is the `message` of the first rejected result.
8. Completion: a grep of `client/src` for `sessionStorage.getItem('accessToken')` and `sessionStorage.setItem('accessToken'` matches only `api/http.ts`.

#### D3 Create Route Guard - `client/src/components/layout/RequireAuth.tsx`, and update `App.tsx`
1. `RequireAuth({ children }: { children: ReactNode })`:
   - State: `'checking' | 'signed-in' | 'signed-out' | 'unavailable'`, initialised to `getAccessToken() ? 'signed-in' : 'checking'`.
   - Effect: while `'checking'`, `ensureSession()` sets the result, with an `active` flag for unmount. Under StrictMode the second effect reuses D1's in-flight refresh.
   - While checking, render `<div className="flex h-screen items-center justify-center bg-canvas"><Spinner label="Checking your session" /></div>`.
   - When unavailable, render the same centred layout with an `InlineAlert tone="warning"` showing `SERVER_UNAVAILABLE_MESSAGE` and a `Button variant="secondary"` "Try again" that sets the state back to `'checking'`. Never redirect in this state.
   - When signed out, render `<Navigate to={\`/login?next=${encodeURIComponent(location.pathname + location.search)}\`} replace />`.
   - Otherwise render `children`.
2. `client/src/App.tsx`:
   - Wrap every `AppShell` route element in `RequireAuth`: `/search`, `/search/:id`, `/upload`, `/documents`, `/documents/:id`, `/jobs`, `/jobs/:id`.
   - Wrap `/change-password` in `RequireAuth`.
   - The admin route becomes `<RequireAuth><AdminGuard><AppShell><AdminLayout /></AppShell></AdminGuard></RequireAuth>`.
   - The `/` route becomes `<RequireAuth><Navigate to="/documents" replace /></RequireAuth>`, so reopening the site silently signs back in (AC4).
   - `AdminGuard`: `isChecking` starts `true`, it calls `authService.getMe()` (no token argument), and it no longer reads `sessionStorage`.

#### D4 Update Pages and Shell - token plumbing
1. `client/src/pages/Login.tsx`:
   - Read `next` from `useSearchParams()`. A local `safeNextPath(value)` accepts it only if it starts with `/`, doesn't start with `//` and doesn't start with `/login`; otherwise `null`.
   - On mount: state `isCheckingSession = true`, then `ensureSession()`. `'signed-in'` → `navigate(safeNext ?? '/documents', { replace: true })`. `'signed-out'` → show the form. `'unavailable'` → show the form with a warning `InlineAlert` (`SERVER_UNAVAILABLE_MESSAGE`) and a "Try again" button that re-runs the check. While checking, render the `AuthLayout` with a centred `Spinner` instead of the form.
   - On submit: `setAccessToken(accessToken)`. Then `navigate('/change-password')` when `mustChangePassword`, else `navigate(safeNext ?? '/documents', { replace: true })`.
   - A 429 shows in the existing error `InlineAlert` through `err.message` (`TOO_MANY_ATTEMPTS_MESSAGE`).
2. `client/src/pages/ChangePassword.tsx`: remove the token read and the redirect, and call `authService.changePassword(currentPassword, newPassword)`. The server keeps this browser signed in (A8).
3. `client/src/components/layout/AppShell.tsx`:
   - `userState` starts as `{ status: 'loading' }`.
   - The mount effect and `refreshCurrentUser` call `authService.getMe()` with no token checks.
4. `client/src/components/layout/ProfileSettingsModal.tsx`:
   - Remove every `sessionStorage` read and the "not authenticated" branches.
   - `getMe()`, `updateMe(payload)` and `changePassword(currentPw, newPw)` are called with no token.
   - Sign out: `try { await authService.logout(); } catch { /* ignore */ }`, then `clearAccessToken(); onClose(); navigate('/login');`.

#### D5 Create Helper and Update Admin Users UI (P4)
1. File: `client/src/components/admin/userProtection.ts` (new):
   - Constants: `OWN_ACCOUNT_DELETE_REASON = "You can't delete your own account"`, `OWN_ROLE_REASON = "You can't change your own role"` and `LAST_ADMIN_REASON = 'At least one admin is required'`.
   - `countActiveAdmins(users: UserSummary[]): number`: counts `role === 'ADMIN' && accountStatus === 'ACTIVE'`.
   - `getUserProtection(user, currentUserId: string | null, activeAdminCount: number): { deleteBlockedReason: string | null; roleBlockedReason: string | null }`:
     - `user.id === currentUserId` → `{ OWN_ACCOUNT_DELETE_REASON, OWN_ROLE_REASON }`.
     - An ACTIVE admin while `activeAdminCount <= 1` → both are `LAST_ADMIN_REASON`.
     - Otherwise both are `null`.
2. `client/src/pages/admin/AdminUsers.tsx`:
   - `currentUserId` comes from `useCurrentUser()`: the `id` when `status === 'ready'`, else `null`. Compute `activeAdminCount` with `useMemo` over `users`.
   - **Row actions:** the Change role and Delete `IconButton`s get `disabled={Boolean(reason)}` and, **only when there is a reason**, `title={reason}`. That's written as `{...(reason ? { title: reason } : {})}`, because `IconButton` spreads `rest` after its own `title={label}`. Edit stays enabled.
   - **Bulk:** `bulkDeletableIds` is the selected ids without a `deleteBlockedReason`, and `bulkSkippedCount` is the rest. The BulkBar Delete action is `disabled: bulkDeletableIds.length === 0`.
   - **Bulk confirm** (`ConfirmDialog`):
     - Title: `Delete ${formatCountLabel(bulkDeletableIds.length, 'user', 'users')}?`.
     - Message, first paragraph: "They'll lose access straight away. Documents they uploaded stay in the register." The title already asks the question from the brief's sentence.
     - When `bulkSkippedCount > 0`, a second `<p>`: `${formatCountLabel(bulkSkippedCount, 'selected user', 'selected users')} will be skipped: you can't delete your own account or the last active admin.`
   - **`handleBulkDelete`:**
     - Deletes only `bulkDeletableIds`.
     - Builds `pageAlert` from up to two sentences joined by a space:
       - when `failed > 0`: `${formatCountLabel(res.failed, 'user', 'users')} couldn't be deleted.`, followed by `res.firstError` when it's set;
       - when `bulkSkippedCount > 0`: `${formatCountLabel(bulkSkippedCount, 'user', 'users')} skipped: you can't delete your own account or the last active admin.`
     - Selection keeps the failed and skipped ids.
3. `client/src/components/admin/ChangeRoleModal.tsx`: the catch becomes `setError(err instanceof Error ? err.message : 'Failed to update role. Please try again.')`, so a server 409 is shown in its `InlineAlert`.
4. `client/src/components/admin/DeleteUserModal.tsx` already shows `err.message`. With D2 that's the server's 409 text.

#### D6 Update Copy - delete user
1. `client/src/components/admin/DeleteUserModal.tsx`: the message becomes `<p>Delete {displayName}? They'll lose access straight away. Documents they uploaded stay in the register.</p>`. The bold "and every document they uploaded" clause is removed.
2. `client/src/pages/admin/AdminPending.tsx`:
   - The single delete message becomes `<p>Delete {singleDisplayName}? They'll lose access straight away. Documents they uploaded stay in the register.</p>`.
   - The bulk delete message becomes `<p>They'll lose access straight away. Documents they uploaded stay in the register.</p>` (the title keeps `Delete N users?`).
   - Reject copy is unchanged.
3. `client/src/components/admin/CreateUserModal.tsx`: unchanged. Its "They can sign in straight away…" is true after A3.

#### D7 Create Util and Update Upload Page - size limit (P7)
1. File: `client/src/utils/uploadLimits.ts` (new):
   - `MAX_UPLOAD_MB`: `Number(import.meta.env.VITE_MAX_UPLOAD_MB)` when it's a finite number above 0, else `50`.
   - `MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024`.
2. `client/src/pages/Upload.tsx`:
   - **`addFiles`:**
     - A file whose type isn't allowed goes to `rejected` (as today).
     - Otherwise a file with `size > MAX_UPLOAD_BYTES` goes to a new `oversize` list.
     - Otherwise it's accepted.
     - `setOversizeFileNames(oversize)` is set next to `setRejectedFileNames`.
   - **New state** `oversizeFileNames: string[]`. `clearList` resets it.
   - **New alert:** a dismissible warning `InlineAlert` after the existing rejected-type alert: `These files are larger than {MAX_UPLOAD_MB} MB and weren't added: {names.join(', ')}`.
   - **Drop-zone hint:** `PDF, JPG or PNG` becomes `PDF, JPG or PNG, up to {MAX_UPLOAD_MB} MB`.
   - A server 413 (if the limits differ) still shows on the file's row through `err.message`.

#### Group D gate
- From `server/`, `npm run build:full` passes. No unused imports or parameters remain after the token parameters are removed.
- **Session checks** (set `JWT_ACCESS_TOKEN_EXPIRATION="1m"` in the local `.env` for this):
  - After 2 minutes idle, the next action works without signing in again.
  - A new tab opens signed in.
  - Closing and reopening the browser at `/` lands on Documents.
  - Two different browsers both stay signed in.
  - Revoking a session (sign out in the other browser) and then acting sends you to `/login?next=…`, and signing in returns to that page (AC4).
  - In dev (StrictMode), opening a new tab triggers exactly one `/auth/refresh` request.
  - Stop the server while signed in and click around: you see "Can't reach the server right now…" and stay signed in. Start it again: everything works without signing in.
- **Admin checks** in `/admin/users`:
  - Your own row has Delete and Change role disabled, with the tooltips.
  - A bulk selection including yourself reports one skipped.
  - Rejecting your own account through the API returns 409.
- **Upload check:** a 60 MB file is refused when added, with the listed alert. The hint reads "PDF, JPG or PNG, up to 50 MB".
- **Wrong password** in account settings shows "Current password is incorrect" and doesn't sign you out.

---

### Group E — "Save to folder" setting (client, P10)

#### E1 Update Service and Client Types - `projectName` for Search downloads (RQ5)
1. `server/src/documents/documents.service.ts`:
   - `searchDocuments`: the `findMany` gains `include.project: { select: { name: true } }`, and each result gains `projectName: doc.project.name`.
   - `getDocument`: the `include` gains `project: { select: { name: true } }`, and the response gains `projectName: document.project.name`.
   - Both changes are additive. Visibility and soft-delete filters are unchanged.
2. `client/src/api/documents.ts`: `SearchResult` gains `projectName: string`. The API `Document.projectName?` already exists, so `toUiDocument` now fills it for drawer and preview documents loaded by id.
3. Completion: the Search drawer and preview modal of a document both have `document.projectName` set.

#### E2 Create Types - `client/src/types/file-system-access.d.ts`
1. A global declaration file (no imports or exports) that adds only what TypeScript 5.9's DOM library lacks:
   ```ts
   type FileSystemPermissionMode = 'read' | 'readwrite';
   interface FileSystemHandlePermissionDescriptor { mode?: FileSystemPermissionMode }
   interface FileSystemHandle {
     queryPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
     requestPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
   }
   interface DirectoryPickerOptions { id?: string; mode?: FileSystemPermissionMode }
   interface Window { showDirectoryPicker?: (options?: DirectoryPickerOptions) => Promise<FileSystemDirectoryHandle> }
   ```
2. Constraints:
   - Don't redeclare `FileSystemDirectoryHandle`, `FileSystemFileHandle`, `createWritable` or `navigator.locks`; they already exist.
   - No `@types` package.

#### E3 Create Util - `client/src/utils/saveFolderStore.ts` (IndexedDB)
1. The database is `'docindex'`, version 1. It has object store `'settings'` (created in `onupgradeneeded`) and key `'saveFolder'`.
2. Exports:
   - `loadSaveFolderHandle(): Promise<FileSystemDirectoryHandle | null>`
   - `storeSaveFolderHandle(handle: FileSystemDirectoryHandle): Promise<void>`
   - `deleteSaveFolderHandle(): Promise<void>`
3. Each one opens the database, runs one request in a transaction, and resolves on success. On any IndexedDB error or when IndexedDB is unavailable, `load` resolves `null` and the others resolve quietly. No library.

#### E4 Create Util - `client/src/utils/saveFile.ts`
1. Types: `SaveTarget { folder: FileSystemDirectoryHandle | null; warning: string | null }` and `SaveResult { savedTo: string | null; warning: string | null }`.
2. Constants:
   - `PERMISSION_WARNING = "Permission to use your save folder wasn't given, so the file went to your Downloads folder."`
   - `WRITE_WARNING = "Couldn't save to your folder, so the file went to your Downloads folder."`
3. The module cache holds `cachedFolder: FileSystemDirectoryHandle | null` and `cachedPermission: PermissionState | null`.
4. Exports:
   - `isSaveFolderSupported(): boolean`: `typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function'`.
   - `initSaveFolder(): Promise<void>`: when supported, loads the handle into `cachedFolder` and sets `cachedPermission = await handle.queryPermission({ mode: 'readwrite' })`. Errors are swallowed.
   - `getSaveFolderName(): string | null`: `cachedFolder?.name ?? null`.
   - `chooseSaveFolder(): Promise<string | null>`:
     - Calls `window.showDirectoryPicker!({ id: 'docindex-save-folder', mode: 'readwrite' })`.
     - An `AbortError` returns `null`. Other errors are rethrown.
     - On success it stores the handle, sets `cachedFolder` and `cachedPermission = 'granted'`, and returns `handle.name`.
   - `clearSaveFolder(): Promise<void>`: deletes from IndexedDB and clears both cached values.
   - `beginSave(): Promise<SaveTarget>`. **Call it as the first statement of a click handler, before any `await`.**
     - When there's no support or no `cachedFolder`, resolve `{ folder: null, warning: null }`.
     - Otherwise, call `cachedFolder.queryPermission({ mode: 'readwrite' })` when `cachedPermission === 'granted'`, or `cachedFolder.requestPermission({ mode: 'readwrite' })` otherwise. Either call is made **synchronously** inside the click.
     - Map the result: update `cachedPermission`. `'granted'` gives `{ folder: cachedFolder, warning: null }`; anything else, or a rejection, gives `{ folder: null, warning: PERMISSION_WARNING }`.
   - `sanitiseFileName(name: string, fallback: string): string`:
     1. Remove `<>:"/\|?*` and characters `\x00`–`\x1F`.
     2. Trim, then remove trailing dots and spaces.
     3. If the part before the first dot is a Windows reserved device name (`CON`, `PRN`, `AUX`, `NUL`, `COM1`–`COM9`, `LPT1`–`LPT9`, case-insensitive), append `_` to that part.
     4. If the result is empty, return `fallback`.
   - `commonProjectName(names: Array<string | null | undefined>): string | undefined`: returns the single distinct non-empty name, else `undefined` (RQ6).
   - `triggerBrowserDownload(blob: Blob, fileName: string): void`: the existing anchor and object-URL download, moved here unchanged.
   - `saveFile(blob: Blob, fileName: string, options: { projectName?: string; target?: Promise<SaveTarget>; fallbackToDownload?: boolean } = {}): Promise<SaveResult>`:
     1. `target = await (options.target ?? beginSave())`. `fallbackToDownload` defaults to `true`.
     2. If `target.folder` is set, in a `try`:
        - `dir = target.folder`.
        - If there's a `projectName`, `folderName = sanitiseFileName(projectName, 'Project')` and `dir = await dir.getDirectoryHandle(folderName, { create: true })`.
        - `finalName = await nextFreeName(dir, sanitiseFileName(fileName, 'file'))`.
        - `fileHandle = await dir.getFileHandle(finalName, { create: true })`.
        - `writable = await fileHandle.createWritable()`, then write the blob and close.
        - If writing fails, run `writable.abort()` and `dir.removeEntry(finalName)` (both ignoring errors), then rethrow.
        - Return `{ savedTo: [target.folder.name, folderName].filter(Boolean).join('/'), warning: null }`.
        - The `catch` sets `warning = WRITE_WARNING`.
     3. If `fallbackToDownload`, call `triggerBrowserDownload(blob, fileName)`.
     4. Return `{ savedTo: null, warning: target.warning ?? warning ?? null }`. It never throws.
   - `nextFreeName(dir, name)` (not exported):
     - Splits off the extension at the last dot, when that dot isn't the first character.
     - Tries `name`, then `base (2).ext`, `base (3).ext` and so on up to 999.
     - A name counts as taken when `dir.getFileHandle(candidate)` resolves, or rejects with `TypeMismatchError` (a folder of that name). A `NotFoundError` means it's free.
     - It throws after 999 attempts.
   - `describeSaveResult(result: SaveResult): { tone: 'success' | 'warning'; message: string } | null`:
     - When `savedTo` is set, `{ tone: 'success', message: \`Saved to ${savedTo}\` }`.
     - When `warning` is set, `{ tone: 'warning', message: warning }`.
     - Otherwise `null`.
5. Constraints:
   - It never overwrites (it only creates a name that's free) and never moves or deletes anything except the half-written file it just created.

#### E5 Initialise - `client/src/main.tsx`
1. Run `void initSaveFolder();` before `createRoot(...).render(...)`. Clicks before it resolves simply download normally.

#### E6 Create Component and Update Modal - Files tab
1. File: `client/src/components/layout/SaveLocationSettings.tsx` (new, named export, `SaveLocationSettingsProps` with no props).
   - **State:** `folderName = getSaveFolderName()`, `isBusy` and `error`.
   - **Content:**
     - `<h3 className="text-panel text-ink">Save location</h3>`.
     - `<p className="text-body text-ink-body">`: "Choose a folder on this computer. Files you download, and copies of files you upload, are saved there in a folder per project. Changing the folder doesn't move files you've already saved."
     - The current folder: a `text-label uppercase text-ink-muted` "Current folder" label, then either `folderName` in `text-body font-medium text-ink`, or "Not set — files go to your browser's Downloads folder" in `text-body text-ink-muted`.
     - Buttons:
       - `Button variant="primary"`, labelled "Choose folder" when there's no folder and "Change folder" when there is one. On click it calls `chooseSaveFolder()`. On success it updates `folderName`. On an error other than cancel, it sets `error` to "Couldn't use that folder. Choose another one."
       - `Button variant="secondary"` "Stop saving to a folder", disabled when there's no folder. On click it runs `clearSaveFolder()` and sets `folderName` to `null`.
     - A note: `<p className="text-small text-ink-muted">` "Only works in Chrome or Edge on a computer. The setting is saved in this browser only."
     - `error` is shown in `InlineAlert tone="error"`.
   - **When `!isSaveFolderSupported()`:** both buttons are disabled, and the note is shown as `InlineAlert tone="info"` with the same text.
2. `client/src/components/layout/ProfileSettingsModal.tsx`:
   - `SettingsTab` becomes `'profile' | 'security' | 'files'`. The `Tabs` items add `{ value: 'files', label: 'Files' }`.
   - Add a `files` tab panel (`role="tabpanel"`, ids from `getTabPanelId`/`getTabId`, `className="space-y-4 pt-4"`) rendering `<SaveLocationSettings />`. The existing panels move from a two-way to a three-way conditional.
   - The modal description becomes "Manage your profile, password and where files are saved."
   - The footer stays profile-only.

#### E7 Wire Downloads and Exports Through `saveFile`
1. Client API (each returns `Promise<SaveResult>` and takes a trailing `options: { projectName?: string; target?: Promise<SaveTarget> } = {}`):
   - `client/src/api/exports.ts`:
     - `downloadDocument(documentId, options)` runs `getDocumentBlob`, then `saveFile(blob, filename, options)`.
     - `exportDocuments(documentIds, options)` runs the fetch, decodes the name, then `saveFile(blob, filename, options)`.
   - `client/src/api/archive.ts`: `downloadProjectArchive(id, fallbackName, options)` uses `saveFile(blob, filename, { target: options.target })`. Archives always go to the folder root.
   - `client/src/utils/csv.ts`: `downloadCsv(fileName, content, options)` uses `saveFile(new Blob([content], { type: 'text/csv;charset=utf-8' }), fileName, options)`.
   - The anchor code in these three files is deleted in favour of `triggerBrowserDownload` inside `saveFile`.
2. Call sites. Each handler's **first statement** is `const target = beginSave();`. A non-null `describeSaveResult(result)` is shown in the alert the place already has. Errors keep today's handling.
   - **`client/src/pages/Documents.tsx`:**
     - `PageAlert.tone` widens to `'error' | 'warning' | 'success'`.
     - `handleDownloadDocument(docId)` passes `{ projectName: rows.find((d) => d.id === docId)?.projectName, target }`.
     - `handleExportShownCsv` and `handleExportSelectedCsv` pass `{ projectName: commonProjectName(rows/selectedRows.map((d) => d.projectName)), target }` and show the result with `.then`.
     - `<ExportModal projectName={commonProjectName(selectedRows.map((d) => d.projectName))} onSaved={showSaveResult} …/>`.
   - **`client/src/pages/Search.tsx`:**
     - `handleDownload(documentId)` passes `{ projectName: results.find((r) => r.documentId === documentId)?.projectName, target }`.
     - `ExportModal` gets `projectName={commonProjectName(<selected results>.map((r) => r.projectName))}` and `onSaved` routed to `pageAlert`.
   - **`client/src/components/documents/ExportModal.tsx`:**
     - New optional props: `projectName?: string` and `onSaved?: (result: SaveResult) => void`.
     - `handleExport` starts with `const target = beginSave();`, calls `exportDocuments(documentIds, { projectName, target })`, then `onSaved?.(result)` and `handleClose()`.
   - **`client/src/components/documents/DocumentDrawer.tsx`:**
     - `handleDownload` starts with `beginSave()` and passes `projectName: readyDocument.projectName`.
     - New state `downloadNotice: { documentId: string; tone: 'success' | 'warning'; message: string } | null` is rendered as an `InlineAlert` where `downloadError` renders, for the current document only. It's cleared at the start of each download.
   - **`client/src/components/documents/DocumentPreviewModal.tsx`:**
     - `handleDownload` starts with `beginSave()` and passes `projectName: document.projectName`.
     - New state `downloadNotice` is rendered as a dismissible `InlineAlert` above the grid, next to `downloadError`.
   - **`client/src/pages/admin/AdminArchive.tsx`:** `handleDownload(project)` starts with `beginSave()`, calls `downloadProjectArchive(project.id, project.name, { target })`, and sets `pageAlert` from `describeSaveResult`.
3. Constraint: when no folder is set, every download behaves exactly as today, with no new messages.

#### E8 Update Upload Page and Documents Notice - upload copies
1. File: `client/src/utils/routeNotice.ts` (new):
   - `RouteNotice { tone: 'success' | 'warning'; message: string }`.
   - `readRouteNotice(state: unknown): RouteNotice | null`: returns `state.notice` when it has a valid `tone` and a string `message`.
2. `client/src/pages/Upload.tsx` `handleUploadAll`:
   - **First statement:** `const saveTarget = beginSave();`. Set `projectName = projects.find((p) => p.id === selectedProjectId)?.name`.
   - **After each successful upload:**
     - `const copy = await saveFile(item.file, item.file.name, { projectName, target: saveTarget, fallbackToDownload: false })`.
     - Count `copiesSaved` when `copy.savedTo` is set, remembering `savedTo`. Count `copiesFailed` when `copy.warning` is set.
     - A copy never changes the item's upload status.
   - **When every upload succeeded:**
     - `message` starts as `${formatCountLabel(n, 'file', 'files')} uploaded`.
       - If `copiesFailed > 0`, append `, but ${formatCountLabel(copiesFailed, 'copy', 'copies')} couldn't be saved to your folder.` with tone `warning`.
       - Else, if `copiesSaved > 0`, append `. Copies saved to ${savedTo}.` with tone `success`.
       - Otherwise keep today's message and tone `success`.
     - Show it in `runResult`, then after 1.5 s run `navigate('/documents', { state: { notice: { tone, message } } })`.
   - **When some uploads failed:** keep today's warning. If `copiesFailed > 0`, append ` ${formatCountLabel(copiesFailed, 'copy', 'copies')} couldn't be saved to your folder.`
3. `client/src/pages/Documents.tsx`:
   - `pageAlert`'s initial state is `readRouteNotice(location.state)`.
   - A mount effect clears the history state when there was a notice: `navigate(location.pathname + location.search, { replace: true, state: null })`. This stops a reload showing it again.

#### E9 Update Docs
1. `docs/BACKLOG.md`: "Project and Uploader on GET /documents/:id" becomes "Uploader on GET /documents/:id". `projectName` is now returned; the uploader still isn't.
2. `docs/project-plan.md`:
   - Mark the Phase 4.5 rows "silent session refresh", "admin guard UI" and "save to folder" ✅ done.
   - Set "Current Position" to "Phases 2, 3, 4 and 4.5 are complete. Phase 5 is next."
3. `README.md`: under "What It Does", add "In Chrome or Edge, downloads and copies of uploads can be saved straight into a chosen folder on the computer, one folder per project".

#### Group E gate
- From `server/`, `npm test` and `npm run build:full` pass.
- **In Chrome** (AC9):
  1. Choose a folder in Account settings → Files.
  2. Download a document from Documents, from the drawer, from the preview and from Search. Each lands in `<folder>/<project>/` and shows "Saved to …".
  3. Download the same document twice: you get `name (2).pdf`, and nothing is overwritten.
  4. Export a ZIP and a CSV from one project: they go to the project folder. Export from two projects: they go to the folder root.
  5. Upload two files: copies appear in `<folder>/<project>/`, and Documents shows "Copies saved to …".
  6. Change the folder: earlier files stay where they were, and new files go to the new folder.
  7. Click "Stop saving to a folder": downloads go to Downloads again.
- **In Firefox:** the Files tab shows the explanation with disabled buttons, and downloads work as before.
- **Final grep over touched client files:** no `dark:`, `window.confirm`, `window.alert` or `opacity-0` (AC10).

---

## Norms

1. **Server structure:**
   - Feature modules: `auth`, `users`, `documents`, `backup`, `config`, `common`.
   - Services call `PrismaService` directly; there's no repository layer.
   - Role, ownership and admin-safety checks live in services, with the acting user's id passed from the controller.
   - Use only NestJS built-in exceptions (`BadRequestException`, `UnauthorizedException`, `ConflictException`, `NotFoundException`, `PayloadTooLargeException`). Messages are user-facing, in sentence case, with a full stop, and never include paths or stack traces.
2. **Transactions:** wherever a check must hold at the moment of a write (last active admin, revoking on a status change), use one interactive `prisma.$transaction(async (tx) => …)`. A refresh-token claim uses a conditional `updateMany` and checks `count`.
3. **Configuration:**
   - Read settings through `ConfigService.get` after `validateEnv`, never `process.env` in services.
   - Exceptions: `main.ts` reads through `app.get(ConfigService)`. The restore runner reads `process.env`, because it runs before Nest.
   - Defaults are defined once, in `EnvironmentVariables`.
4. **Validation:** DTOs use class-validator. Emails are normalised with `@Transform(normalizeEmail)`, and every accepted field is declared (`whitelist` and `forbidNonWhitelisted` stay on).
5. **Files:**
   - Document files go only through `BLOB_STORE`.
   - `fs` is allowed only in `LocalBlobStore`, `BackupService`, the restore hook and the existing storage-migration script (RQ7). Each file says so in its header comment.
   - Paths are built from config and constants, never from request data.
6. **Logging:**
   - Use Nest `Logger` per class.
   - Never log passwords, tokens, cookies, verification links or email bodies in production. Email fallback logs carry only the type and recipient. The user-deletion log carries only the deleted email, the acting admin's id and a count.
7. **Tests:**
   - `*.spec.ts` sits next to the code, under `server/src`.
   - Services are constructed directly with `jest.fn()` Prisma mocks (the `archive.service.spec.ts` pattern), with real `argon2` and `JwtService` where behaviour depends on them.
   - File-system tests use `os.tmpdir()` folders and clean up.
8. **Client API:**
   - Every request goes through `apiFetch` in `client/src/api/http.ts`, and only `http.ts` touches the access token.
   - One module per resource. Modules keep their own error mapping and pass server messages through with `readErrorMessage` where they already show them.
9. **Client UI:**
   - Build from `components/ui` (barrel import outside `components/ui`). Use `InlineAlert` for every notice, `ConfirmDialog` for destructive confirmations, `IconButton` with `disabled` and a conditional `title` for blocked actions, and `Spinner` while checking a session.
   - Helpers and constants live in `.ts` files.
   - Tailwind role tokens only. No `dark:`, no hex values, no native dialogs, no hover-only actions.
   - UK English, sentence case. Numbers and counts use `utils/format.ts`.
10. **Save helper:** any click that may write to the save folder calls `beginSave()` as its first statement and passes the result to the API or `saveFile`. Nothing awaits before it.
11. **Migrations:**
    - Use `prisma migrate dev --create-only` and add the backfill SQL before applying.
    - Never edit an applied migration.
    - New columns are nullable or have defaults.
12. **Comments:** only where the reason isn't obvious: the SQLite `LIKE` fallback, `jwtid`, the `object-src blob:` reason, the `fs` exceptions, and calling `beginSave` before `await`.

## Safeguards

1. **Functional constraints:**
   - Deleting a user never deletes, soft-deletes or hides a Document, its `DocumentText`, its filter values or its file. The list shows the uploader from the relation, or else from the snapshot.
   - A non-ACTIVE account gets 401 on its next authenticated request and on refresh. Leaving ACTIVE revokes every refresh token for that user.
   - An admin can't delete, change the role of, or change the status of their own account. The last ACTIVE admin can't be deleted, demoted or set to non-ACTIVE. Each case returns 409 with the fixed messages from A3.
   - Admin-created users can sign in with their temporary password and are sent to change it.
   - Sessions: access tokens last 15 minutes and refresh silently. Each browser keeps a sliding 7-day session. Several devices work at once. Logout ends all sessions. A password change ends the others and keeps the current one.
   - Uploads over `MAX_UPLOAD_MB` get 413 "File is larger than N MB." and are blocked in the client. Content that doesn't match the declared type gets 400 "This file isn't a valid PDF, JPG or PNG.".
   - "Save to folder" never overwrites, never moves existing files, never fails the upload or download it accompanies, and falls back to a normal download whenever the folder can't be used. Upload copies are the exception: they don't fall back to a download.
2. **Performance constraints:**
   - Login is limited to 10 attempts per 15 minutes per IP + email. Register and verify-email: 10 per 15 minutes per IP. Refresh uses the global limit. Everything else: 300 per minute per IP, per route.
   - Uploads are capped at `MAX_UPLOAD_MB` (default 50) while streaming.
   - A backup runs at most once at a time, doesn't block start-up, and keeps at most `BACKUP_KEEP` automatic copies.
   - Concurrent refreshes in one tab make one network request.
3. **Security constraints:**
   - Only ACTIVE accounts act. Admin endpoints keep their existing role checks. Non-admin visibility rules for documents and projects are unchanged.
   - Production CORS allows only the normalised `FRONTEND_URL` and requests with no origin. Other origins are refused without an error page.
   - Security headers are on every response.
   - The CSP allows only the app's own origin, plus `fonts.googleapis.com` styles, `fonts.gstatic.com` fonts, and `blob:`/`data:` images and frames for previews. No inline scripts.
   - `trust proxy` is `1` in production only.
   - JWT secrets are at least 32 characters and different from each other.
   - The refresh cookie stays `httpOnly`, `sameSite: 'strict'`, and `secure` in production. Its `maxAge` comes from `JWT_REFRESH_TOKEN_EXPIRATION`.
   - The restore marker accepts only a bare `.sqlite` file name, so there's no path traversal. Backup paths never contain request data. There's no HTTP endpoint for backups or restore.
   - No secret, token, link or email body is logged in production.
4. **Integration constraints:**
   - Request and response shapes are unchanged except for these additive fields: `projectName` on search results and on `GET /documents/:id`, a nullable `uploadedByEmail` on the list, and a `Set-Cookie` on the 204 from `PATCH /auth/me/password`.
   - Status codes change in these places:
     - 409 on guarded admin actions.
     - 400 for a wrong current password (was 401).
     - 400 for a self email change without SMTP.
     - 413 and 400 on upload.
     - 429 on the rate limits.
     - 401 for non-ACTIVE accounts.
   - Stored files and storage keys are unchanged, so no file migration is needed.
   - Refresh cookies issued before the deploy fail once (no `jti`), and the user signs in again.
   - The `/api` prefix stays production-only. Static SPA serving is unchanged.
5. **Business rule constraints:**
   - The uploader snapshot is written once at upload (and by the migration backfill) and never updated afterwards.
   - Emails are compared case-insensitively. Stored emails are not rewritten.
   - A self email change is refused while SMTP isn't configured. An admin's email change marks the address verified.
   - Multi-project exports go to the save folder's root. Archives always go to the root.
6. **Error handling constraints:**
   - Use NestJS built-in exceptions with clear, user-facing messages.
   - Error messages must not expose file paths, stack traces or other internal details. Extraction failures store "Couldn't read text from this file." or "Couldn't process this image.", and the raw error goes only to the log.
   - Failed operations must not leave files or database rows half-finished:
     - A rejected upload (size or signature) creates no row or blob.
     - A failed backup leaves no `.tmp` file.
     - A failed restore stops the start command before migrations.
     - A failed folder write removes its own partial file.
   - The client never shows a native dialog. Session failures redirect once to `/login?next=…`. Auth endpoints never trigger refresh-on-401.
7. **Technical constraints:**
   - Exactly two new dependencies (`helmet` and `@nestjs/throttler`).
   - No IndexedDB wrapper and no File System Access `@types` package.
   - The `server/.env` file is never committed.
   - `npm run build:full` passes after every group, as does `npm test` from `server/`.
   - The client keeps `noUnusedLocals` and `noUnusedParameters` clean.
8. **Data constraints:**
   - The migration backfill fills every Document's snapshot and verifies only ACTIVE users with no pending verification token.
   - Dates written in SQL use the adapter's ISO format (`strftime('%Y-%m-%dT%H:%M:%f+00:00','now')`).
   - Backup files follow the `docindex-YYYYMMDD-HHmm.sqlite` pattern (UTC). Manual copies use other names and are never pruned.
   - Saved file and folder names are sanitised for Windows, including reserved device names.
9. **API constraints:**
   - 429 bodies carry "Too many attempts. Wait a few minutes and try again.".
   - Download endpoints send `Content-Disposition` built by `res.attachment`, which is RFC 6266 and 5987 safe and includes `filename*` for non-ASCII names. In development the header is exposed through CORS.
   - No new endpoints. Existing routes, methods and guards are unchanged apart from the throttling decorators and the changes listed above.
