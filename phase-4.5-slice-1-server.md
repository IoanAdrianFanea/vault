# Phase 4.5 — Pilot readiness · Slice 1 of 3: server (Groups A and B)

This is one slice of the Phase 4.5 canvas, with the review amendments already applied. It is self-contained: implement only the operations below, in order, and don't open the full canvas. The Norms and Safeguards at the end apply to every operation.

### Group A — Accounts and data safety (server)

#### A1 Update Schema - `Document` (P1)
1. File: `server/prisma/schema.prisma`, model `Document`.
2. Fields:
   - `uploadedById`: `String?`, previously `String`.
   - `uploadedBy`: `User? @relation("UploadedBy", fields: [uploadedById], references: [id], onDelete: SetNull)`, previously `User` with `Cascade`.
   - `uploadedByEmail`: `String?`, new, no default. The uploader's email at upload time.
   - `uploadedByName`: `String?`, new, no default. The uploader's trimmed full name at upload time, with an empty name stored as null.
   - Keep `@@index([uploadedById])`. No other model changes.
3. Migration:
   - From `server/`, run `npx prisma migrate dev --create-only --name keep_documents_on_user_delete`. Prisma writes a SQLite `RedefineTables` block (`new_Document` with foreign keys off, copy, drop, rename, then recreate the indexes).
   - Append the backfill below to the end of the **new** `migration.sql`, after the generated block. Then run `npx prisma migrate dev` to apply it and regenerate the client.
   - Never edit an already-applied migration.
   ```sql
   -- Backfill the uploader snapshot from the live account (P1).
   UPDATE "Document"
   SET "uploadedByEmail" = (SELECT "email" FROM "User" WHERE "User"."id" = "Document"."uploadedById"),
       "uploadedByName"  = (SELECT NULLIF(TRIM("fullName"), '') FROM "User" WHERE "User"."id" = "Document"."uploadedById")
   WHERE "uploadedById" IS NOT NULL;

   -- Admin-created and approved accounts count as verified (P3).
   UPDATE "User"
   SET "emailVerifiedAt" = strftime('%Y-%m-%dT%H:%M:%f+00:00', 'now')
   WHERE "accountStatus" = 'ACTIVE'
     AND "emailVerifiedAt" IS NULL
     AND "emailVerificationToken" IS NULL;
   ```
4. Backfill: every existing Document has a non-null `uploadedById` today, so every row gets a snapshot. The date format matches what the Prisma 7 SQLite adapter writes (ISO text with `+00:00`).
5. Completion:
   - `npx prisma migrate dev` reports the migration applied.
   - In the dev database, `SELECT COUNT(*) FROM "Document" WHERE "uploadedByEmail" IS NULL` returns 0.
   - `DocumentText` and `DocumentFilterValue` row counts are unchanged.

#### A2 Create Util and Update DTOs - email normalisation (RQ2)
1. File: `server/src/common/email.util.ts` (new).
   - `normalizeEmail(value: unknown): unknown`: returns `value.trim().toLowerCase()` for strings, otherwise `value` unchanged (so `@IsEmail` still reports bad types).
2. DTOs: add `@Transform(({ value }) => normalizeEmail(value))` (from `class-transformer`) directly above `@IsEmail()` on the `email` field of:
   - `server/src/auth/dto/register.dto.ts`
   - `server/src/auth/dto/login.dto.ts`
   - `server/src/auth/dto/UpdateMe.dto.ts` (`ProfileDto`)
   - `server/src/users/dto/CreateUser.dto.ts`
   - `server/src/users/dto/AdminEditUser.dto.ts`
3. Constraint: the global `ValidationPipe` already has `transform: true`, so handlers receive the normalised value. Nothing else in the DTOs changes.

#### A3 Update Service - `UsersService` (P1, P3, P4, RQ2, RQ3)
1. File: `server/src/users/users.service.ts`.
2. Add `private readonly logger = new Logger(UsersService.name);` and these module constants:
   - `SELF_DELETE_MESSAGE = "You can't delete your own account."`
   - `SELF_ROLE_MESSAGE = "You can't change your own role."`
   - `SELF_STATUS_MESSAGE = "You can't change your own account status."`
   - `LAST_ADMIN_MESSAGE = 'At least one active admin is required.'`
3. Methods:
   - `findByEmailInsensitive(email: string): Promise<User | null>` (new):
     1. `normalized = email.trim().toLowerCase()`.
     2. Fast path: `prisma.user.findUnique({ where: { email: normalized } })`. Return it if found.
     3. Fallback for mixed-case emails stored before normalisation: `prisma.user.findMany({ where: { email: { contains: normalized } }, take: 20 })`, then return the first user with `u.email.toLowerCase() === normalized`, else `null`. Add a one-line comment: SQLite `LIKE` (used by `contains`) is case-insensitive for ASCII.
   - `findByEmail`: delete it once A6 has moved its two callers to `findByEmailInsensitive`.
   - `createUser(dto)`:
     - Before hashing, `if (await this.findByEmailInsensitive(dto.email)) throw new ConflictException('User with this email already exists')`. Today a duplicate returns a raw 500.
     - Add `emailVerifiedAt: new Date()` to the `create` data (P3). The other fields are unchanged.
   - `adminEditUser(id, dto)`:
     - Load the current user first: `findUnique({ where: { id }, select: { id: true, email: true } })`, else `NotFoundException('User not found')`.
     - When `dto.email` is given (already normalised by A2) and differs from `current.email.toLowerCase()`:
       - Check uniqueness with `findByEmailInsensitive`. If another user owns it, throw `ConflictException('Email is already in use')`.
       - Set `data.email`, `data.emailVerifiedAt = new Date()` and `data.emailVerificationToken = null` (RQ3: the admin vouches).
     - When `dto.email` equals the current email (case-insensitively), don't touch the email or verification fields.
     - Name and password handling are unchanged.
   - `deleteUser(actorId: string, id: string): Promise<void>`:
     1. `if (actorId === id) throw new ConflictException(SELF_DELETE_MESSAGE)`.
     2. `await this.prisma.$transaction(async (tx) => { … })` that:
        - loads `target` (`id, email, role, accountStatus`), else `NotFoundException('User not found')`;
        - calls `await this.assertNotLastActiveAdmin(tx, target)`;
        - sets `keptDocuments = await tx.document.count({ where: { uploadedById: id } })`;
        - runs `await tx.user.delete({ where: { id } })`;
        - returns `{ email: target.email, keptDocuments }`.
     3. After the transaction: `this.logger.log(\`User ${email} deleted by admin ${actorId}; ${keptDocuments} uploaded document(s) kept\`)`.
     - Memberships and refresh tokens still cascade, and documents are kept through `SetNull`.
   - `setUserRole(actorId: string, id: string, dto: SetUserDto)`:
     1. `if (actorId === id) throw new ConflictException(SELF_ROLE_MESSAGE)`.
     2. In a transaction:
        - load the target (`role, accountStatus`), else `NotFoundException('User not found')`;
        - if `target.role === 'ADMIN' && dto.role !== 'ADMIN'`, call `assertNotLastActiveAdmin(tx, target)`;
        - update with `select: userSelect` and return it.
   - `updateAccountStatus(actorId: string, id: string, status: AccountStatus)`:
     1. `if (actorId === id) throw new ConflictException(SELF_STATUS_MESSAGE)`.
     2. In a transaction:
        - load the target (`role, accountStatus`), else `NotFoundException('User not found')`;
        - if `status !== 'ACTIVE'`, call `assertNotLastActiveAdmin(tx, target)`;
        - update with `select: userSelectWithStatus`;
        - if `target.accountStatus === 'ACTIVE' && status !== 'ACTIVE'`, run `tx.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } })` (P2);
        - return the updated user.
   - `private async assertNotLastActiveAdmin(tx: Prisma.TransactionClient, target: { role: UserRole; accountStatus: AccountStatus }): Promise<void>`:
     - Return at once unless `target.role === 'ADMIN' && target.accountStatus === 'ACTIVE'`.
     - Otherwise `count = await tx.user.count({ where: { role: 'ADMIN', accountStatus: 'ACTIVE' } })`, and `if (count <= 1) throw new ConflictException(LAST_ADMIN_MESSAGE)`.
4. Transactions: the three guarded writes each use one interactive `$transaction`, so the check and the write are atomic.
5. Constraints:
   - `create` (self-registration) is unchanged, apart from receiving an email that's already normalised.
   - `findAll`, `searchUsers`, `findByAccountStatus` and `findByIdSafe` are unchanged.

#### A4 Update Controller - `UsersController`
1. File: `server/src/users/users.controller.ts`.
2. Pass the acting admin's id, `req.user.id`, as the first argument:
   - `setUserRole(req.user.id, id, setUserDto)`
   - `updateAccountStatus(req.user.id, id, dto.status)`
   - `deleteUser(req.user.id, id)`
3. The existing admin checks, routes and status codes are unchanged.

#### A5 Create Util - `server/src/auth/duration.util.ts`
1. `parseDurationMs(value: string): number`:
   - Accepts `^(\d+)([smhd])$`.
   - Returns the duration in milliseconds.
   - Throws `new Error(\`Invalid duration "${value}"\`)` otherwise.
2. It replaces `AuthService.calculateExpirationDate`, which is deleted, and it's also used for the cookie `maxAge`.

#### A6 Update Service - `AuthService` (P2, P5, RQ2, RQ3)
1. File: `server/src/auth/auth.service.ts`.
2. Constants:
   - `ACCOUNT_NOT_ACTIVE_MESSAGE = 'Your account is no longer active. Contact an administrator.'`
   - `EMAIL_CHANGE_NEEDS_SMTP_MESSAGE = "Your email can't be changed here right now. Ask an admin to change it for you."`
   - Extend the payload type: `interface RefreshJwtPayload extends JwtPayload { jti?: string }`.
3. Methods:
   - `register(dto)`: the duplicate check uses `this.usersService.findByEmailInsensitive(dto.email)`. Everything else is unchanged.
   - `login(dto)`: the user lookup uses `findByEmailInsensitive(dto.email)`. The checks and messages are unchanged.
   - `validateUser(userId)`:
     - If the user isn't found, throw `UnauthorizedException('User not found')`, as today.
     - New: `if (user.accountStatus !== 'ACTIVE') throw new UnauthorizedException(ACCOUNT_NOT_ACTIVE_MESSAGE)`.
   - `refresh(refreshToken: string | undefined)`:
     1. No token: `UnauthorizedException('Refresh token not provided')`.
     2. Verify with `JWT_REFRESH_SECRET`. On failure: `UnauthorizedException('Invalid refresh token')`.
     3. If `!payload.jti`: `UnauthorizedException('Invalid refresh token')`. This covers cookies issued before the deploy.
     4. `stored = prisma.refreshToken.findFirst({ where: { id: payload.jti, userId: payload.sub, revokedAt: null, expiresAt: { gt: new Date() } } })`. If it's missing: `UnauthorizedException('Refresh token not found or expired')`.
     5. Compare `sha256Hex(refreshToken)` with `stored.tokenHash` using `crypto.timingSafeEqual` on two equal-length buffers (different lengths count as no match). If they don't match: `UnauthorizedException('Invalid refresh token')`.
     6. Load the user (`UnauthorizedException('User not found')`). If not ACTIVE: `UnauthorizedException(ACCOUNT_NOT_ACTIVE_MESSAGE)`.
     7. Claim the row: `claimed = prisma.refreshToken.updateMany({ where: { id: stored.id, revokedAt: null }, data: { revokedAt: new Date() } })`. If `claimed.count === 0`: `UnauthorizedException('Refresh token not found or expired')`. Only this row is revoked.
     8. `return this.generateTokens(user)`.
   - `logout(userId)`: unchanged (revokes all rows).
   - `private generateTokens(user)`:
     - The access token is unchanged.
     - `sessionId = crypto.randomUUID()`.
     - Sign the refresh token with `{ sub, email }` and options `{ secret: JWT_REFRESH_SECRET, expiresIn: refreshExpiration, jwtid: sessionId }`. `jwtid` sets the `jti` claim.
     - `tokenHash = sha256Hex(refreshToken)`, using a private helper `sha256Hex(value) = crypto.createHash('sha256').update(value).digest('hex')`. argon2 stays for passwords only: refresh tokens are random signed JWTs, and argon2 uses about 64 MB of memory per hash.
     - `expiresAt = new Date(Date.now() + parseDurationMs(refreshExpiration))`.
     - `prisma.refreshToken.create({ data: { id: sessionId, userId: user.id, tokenHash, expiresAt } })`.
     - Return the same shape as today.
   - `changePassword(userId, dto): Promise<{ refreshToken: string }>`:
     - Wrong current password: `BadRequestException('Current password is incorrect')`. It was 401, which would trigger a client refresh and sign the user out.
     - Hash, update and the "revoke all refresh tokens" step are unchanged.
     - Then `const { refreshToken } = await this.generateTokens(updatedUser)` and return `{ refreshToken }`. This browser stays signed in, and every other session ends.
   - `updateMe(userId, dto)`:
     - `newEmail = dto.email` (already trimmed and lowercased by A2).
     - When `newEmail !== existingUser.email.toLowerCase()`:
       - first, `if (!this.emailService.isConfigured()) throw new BadRequestException(EMAIL_CHANGE_NEEDS_SMTP_MESSAGE)` (RQ3);
       - replace the `contains` candidate loop with `this.usersService.findByEmailInsensitive(newEmail)`. Another owner gives `ConflictException('Email is already in use')`.
     - The rest is unchanged: reset verification, send the email, trim name, language and timezone.
4. Dependency injection: unchanged.

#### A7 Update Service - `EmailService.isConfigured()`
1. File: `server/src/email/email.service.ts`.
2. Add `isConfigured(): boolean { return this.configured; }`. No other change in Group A; B3 changes the fallback logging.

#### A8 Update Controller - `AuthController`
1. File: `server/src/auth/auth.controller.ts`.
2. Inject `private readonly config: ConfigService`.
3. `setRefreshTokenCookie`: `maxAge: parseDurationMs(this.config.get<string>('JWT_REFRESH_TOKEN_EXPIRATION') ?? '7d')`. The other cookie options are unchanged.
4. `changePassword`:
   - Add `@Res({ passthrough: true }) res: Response`.
   - `const { refreshToken } = await this.authService.changePassword(req.user.id, dto); this.setRefreshTokenCookie(res, refreshToken);`.
   - Keep `@HttpCode(HttpStatus.NO_CONTENT)`.
5. The other routes are unchanged.

#### A9 Update Service - `DocumentsService` (P1, extraction errors)
1. File: `server/src/documents/documents.service.ts`.
2. `uploadDocument`:
   - The user lookup selects `{ role: true, email: true, fullName: true }`.
   - `documentCreateData` adds `uploadedByEmail: user.email` and `uploadedByName: user.fullName?.trim() || null`.
   - In the outer `catch`, when `documentId` is set:
     - Log the raw error: `this.logger.error(\`Processing failed for document ${documentId}: ${error instanceof Error ? error.message : String(error)}\`)`.
     - Store `errorMessage: file.mimetype === 'application/pdf' ? "Couldn't read text from this file." : "Couldn't process this image."`.
     - Still rethrow the error (the HTTP response is unchanged).
3. `listDocuments`:
   - The select adds `uploadedByEmail: true`.
   - The mapping becomes `uploadedByEmail: doc.uploadedBy?.email ?? doc.uploadedByEmail ?? null`.
4. Constraints:
   - Visibility, soft-delete filters and project rules are unchanged.
   - Existing FAILED rows keep their stored messages (no data rewrite).

#### A10 Create Tests (Jest, unit level)
1. Follow `archive.service.spec.ts`: construct services directly with `jest.fn()` Prisma mocks, and use a `$transaction` mock that runs the callback with the mock (or `Promise.all` for arrays).
2. `server/src/users/users.service.spec.ts` (new):
   - `deleteUser` with `actorId === id` throws 409 `SELF_DELETE_MESSAGE` and makes no Prisma calls.
   - `deleteUser` of the only ACTIVE ADMIN (count 1) throws 409 `LAST_ADMIN_MESSAGE`. With count 2 it calls `user.delete` and never calls any `document` delete method.
   - `setUserRole` on self throws 409. Demoting the last active admin throws 409. Promoting a USER doesn't count admins.
   - `updateAccountStatus` on self throws 409. Setting the last active admin to `REJECTED` throws 409.
   - `updateAccountStatus` from ACTIVE to REJECTED revokes refresh tokens (`refreshToken.updateMany` with `revokedAt: null` filter). From PENDING to ACTIVE it doesn't.
   - `createUser` sets `emailVerifiedAt`, and throws 409 on a case-insensitive duplicate.
3. `server/src/auth/auth.service.spec.ts` (new):
   - Use a real `JwtService` from `@nestjs/jwt`, real `argon2`, a config mock with two different 32+ character secrets, and an in-memory `refreshToken` store implementing `create`, `findFirst` (by `id`, `userId`, `revokedAt: null`, `expiresAt`) and `updateMany`.
   - `validateUser` rejects a REJECTED user with 401 `ACCOUNT_NOT_ACTIVE_MESSAGE`.
   - `refresh` rejects a valid token whose user is now PENDING with 401.
   - **Two concurrent sessions (P5):** two `login` calls give tokens T1 and T2. `refresh(T1)` and `refresh(T2)` both succeed. A second `refresh(T1)` fails with 401.
   - A refresh token without `jti` fails with 401 `Invalid refresh token`.
   - `changePassword` with the wrong current password throws `BadRequestException`. On success it returns a new `refreshToken` and revokes the earlier rows.
4. `server/src/documents/documents.service.spec.ts` (new):
   - `listDocuments`, with an ADMIN user and no filters, maps `uploadedBy: null, uploadedByEmail: 'gone@site.test'` to `uploadedByEmail: 'gone@site.test'` (deleted uploader). A live relation wins over the snapshot.
   - `uploadDocument` for a PDF passes `uploadedByEmail` and `uploadedByName` to `document.create`.
   - When `extractTextFromPdfBuffer` rejects, the document is updated with `status: FAILED` and `errorMessage: "Couldn't read text from this file."`, and the error is rethrown.

#### A11 Update Task - prune old refresh-token rows
1. File: `server/src/recycle-bin/purge.task.ts`. Inject `PrismaService` (it's global) if the task doesn't have it yet.
2. At the end of the daily run: `const { count } = await this.prisma.refreshToken.deleteMany({ where: { OR: [{ expiresAt: { lt: now } }, { revokedAt: { lt: oneDayAgo } }] } })`, where `oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)`. Log `Pruned ${count} old refresh token(s)`.
3. Every refresh adds a row, so this stops the table growing forever. A failure here is logged and doesn't stop the rest of the purge.

#### Group A gate
- From `server/`, `npm test` and `npm run build:full` pass.
- Dev check (`npm run start:dev`):
  1. As admin, create user B. Sign in as B with the temporary password: it works and goes to change password (AC3).
  2. Add B to a project and upload a document as B.
  3. As admin, delete B. The document is still listed, with B's email as uploader (AC1).
  4. Deleting yourself returns 409 with the self message.
- Two browsers signed in as the same user can both call `POST /auth/refresh`.
- Sign in as an **existing** user whose `emailVerifiedAt` was set by the backfill SQL, then open Admin → Users. This proves the adapter reads the date format the SQL wrote. If it errors, fix the backfill format before going any further.

---

### Group B — Hardening and config (server)

#### B1 Install Dependencies
1. From `server/`: `npm install helmet @nestjs/throttler`. These are the only new packages in this phase.
2. Completion: both appear under `dependencies` in `server/package.json`, and `package-lock.json` is updated.

#### B2 Create Config Validation - `server/src/config/env.validation.ts`
1. Class `EnvironmentVariables` (class-validator and class-transformer decorators):
   - `NODE_ENV?`: `@IsOptional() @IsIn(['development', 'production', 'test'])`.
   - `DATABASE_URL`, `STORAGE_ROOT`: `@IsString() @IsNotEmpty()`.
   - `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`: `@IsString() @MinLength(32)`.
   - `JWT_ACCESS_TOKEN_EXPIRATION = '15m'`, `JWT_REFRESH_TOKEN_EXPIRATION = '7d'`: `@IsOptional() @Matches(/^\d+[smhd]$/)`.
   - `FRONTEND_URL?`: `@ValidateIf((e) => e.NODE_ENV === 'production' || e.FRONTEND_URL !== undefined) @IsUrl({ require_tld: false, require_protocol: true, protocols: ['http', 'https'] })`.
   - `PORT?`: `@IsOptional() @IsInt() @Min(1) @Max(65535)`.
   - `SMTP_HOST?`, `SMTP_USER?`, `SMTP_PASS?`, `SMTP_FROM?`: `@ValidateIf(hasAnySmtpValue) @IsString() @IsNotEmpty()`. `hasAnySmtpValue` is true when any of those four is set. `SMTP_PORT` alone doesn't count.
   - `SMTP_PORT = 587`: `@IsOptional() @IsInt() @Min(1) @Max(65535)`.
   - `MAX_UPLOAD_MB = 50`: `@IsOptional() @IsInt() @Min(1) @Max(1024)`.
   - `BACKUP_DIR?`: `@IsOptional() @IsString()`.
   - `BACKUP_KEEP = 14`: `@IsOptional() @IsInt() @Min(1) @Max(365)`.
   - `COMPRESSION_THRESHOLD_BYTES?`: `@IsOptional() @IsInt() @Min(0)`.
   - `COMPRESSION_MIN_SAVINGS_RATIO?`: `@IsOptional() @IsNumber() @Min(0) @Max(1)`.
2. `validateEnv(raw: Record<string, unknown>): EnvironmentVariables`:
   1. Copy `raw`, dropping every key whose value is a string that's empty after trimming. Blank `.env` lines count as unset.
   2. `env = plainToInstance(EnvironmentVariables, cleaned, { enableImplicitConversion: true })`. Unknown keys such as `PATH` are kept.
   3. `problems = validateSync(env).flatMap((e) => Object.values(e.constraints ?? {}))`.
   4. If both secrets are present and equal, push `'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different'`.
   5. If `problems.length > 0`, throw `new Error(\`Invalid environment configuration:\n${problems.map((p) => \`  - ${p}\`).join('\n')}\`)`.
   6. Normalise: `env.FRONTEND_URL = env.FRONTEND_URL?.replace(/\/+$/, '')` and `env.BACKUP_DIR = path.resolve(env.BACKUP_DIR ?? path.join(env.STORAGE_ROOT, 'backups'))`.
   7. Return `env`.
3. Wire-up: `server/src/app.module.ts` → `ConfigModule.forRoot({ isGlobal: true, envFilePath: …, validate: validateEnv })`.
4. Test file: `server/src/config/env.validation.spec.ts` (new).
   - Missing secrets: one error lists both secret problems.
   - Equal secrets are rejected.
   - Production without `FRONTEND_URL` is rejected.
   - `SMTP_HOST` set without `SMTP_PASS` is rejected.
   - Blank strings are ignored.
   - Defaults are applied (`MAX_UPLOAD_MB` 50, `BACKUP_KEEP` 14, `BACKUP_DIR` under `STORAGE_ROOT`).
   - A trailing slash is removed from `FRONTEND_URL`.
5. Update `server/.env.example` to match, with no real values:
   - Secrets are blank, with a comment: "at least 32 characters each, different from each other; generate with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`".
   - Every `SMTP_*` line is blank except `SMTP_PORT=587`, with the comment "all or nothing; leave all blank to disable email".
   - Add `MAX_UPLOAD_MB=50` ("keep the client's `VITE_MAX_UPLOAD_MB` the same"), `BACKUP_DIR=` ("default `<STORAGE_ROOT>/backups`") and `BACKUP_KEEP=14`.
   - The `STORAGE_ROOT`, `FRONTEND_URL` and compression lines stay.

#### B3 Update Service - `EmailService` fallback (P8)
1. File: `server/src/email/email.service.ts`.
2. Constructor:
   - `port = config.get<number>('SMTP_PORT') ?? 587`. It's now a real number, so `secure: port === 465` works as the README already documents.
   - `this.isProduction = config.get<string>('NODE_ENV') === 'production'`.
   - When not configured:
     - in production, log `this.logger.warn('SMTP is not configured: emails will not be sent. Create accounts from the admin page.')`;
     - otherwise keep today's warning.
3. `send(to, subject, html, type: 'verification' | 'admin-approval')`:
   - `sendVerificationEmail` passes `'verification'` and `sendAdminApprovalNotification` passes `'admin-approval'`.
   - When not configured:
     - in production, log only `\`email not sent (SMTP not configured): ${type} to ${to}\``;
     - otherwise keep today's full console log for local development.
4. Constraint: no production code path logs `html`, `link` or a token.

#### B4 Update Bootstrap - `server/src/main.ts`
1. After `NestFactory.create`:
   - `const config = app.get(ConfigService); const isProduction = config.get('NODE_ENV') === 'production'; const frontendUrl = config.get<string>('FRONTEND_URL');`.
   - Replace the module-level `isProduction` constant with this.
2. In production, run `app.set('trust proxy', 1)` before anything else, then the existing `setGlobalPrefix('api')`.
3. `app.use(helmet(buildHelmetOptions(frontendUrl)))`, before CORS. `buildHelmetOptions` lives in `server/src/common/security-headers.ts` (new) and returns:
   ```ts
   {
     contentSecurityPolicy: {
       useDefaults: true,
       directives: {
         defaultSrc: ["'self'"],
         scriptSrc: ["'self'"],
         styleSrc: ["'self'", 'https://fonts.googleapis.com'],
         fontSrc: ["'self'", 'https://fonts.gstatic.com'],
         imgSrc: ["'self'", 'data:', 'blob:'],
         frameSrc: ["'self'", 'blob:'],
         objectSrc: ["'self'", 'blob:'],
         connectSrc: ["'self'"],
         upgradeInsecureRequests: frontendUrl?.startsWith('https://') ? [] : null,
       },
     },
   }
   ```
   - Sources: `client/index.html` loads the Inter and Material Symbols stylesheets from `fonts.googleapis.com`, with font files from `fonts.gstatic.com`.
   - `DocumentPreviewModal` shows images in `<img src="blob:…">` and PDFs in `<iframe src="blob:…">`. Chrome's PDF viewer inside a `blob:` frame inherits the page policy and counts as a plugin, which is why `object-src` allows `blob:`.
   - No inline scripts or styles are allowed (React's `style` props use CSSOM, which CSP doesn't block).
   - `upgrade-insecure-requests` is dropped when the site isn't served over HTTPS, so a local production run on `http://localhost` works.
4. CORS:
   ```ts
   app.enableCors({
     origin: (origin, callback) => {
       if (!origin) return callback(null, true);
       if (frontendUrl && origin === frontendUrl) return callback(null, true);
       if (!isProduction && DEV_ORIGIN_PATTERNS.some((p) => p.test(origin))) return callback(null, true);
       return callback(null, false);
     },
     credentials: true,
     exposedHeaders: ['Content-Disposition'],
   });
   ```
   `DEV_ORIGIN_PATTERNS` is today's three regexes, moved into a constant.
5. Cookie parser, `ValidationPipe`, static serving and `listen` are unchanged, apart from using the local `isProduction`.

#### B5 Add Rate Limiting (P6)
1. File: `server/src/common/throttle.ts` (new):
   - `TOO_MANY_ATTEMPTS_MESSAGE = 'Too many attempts. Wait a few minutes and try again.'`
   - `ONE_MINUTE_MS = 60_000` and `FIFTEEN_MINUTES_MS = 15 * 60_000`.
   - `loginThrottleTracker(req: Record<string, any>): string`: returns `` `${req.ip ?? 'unknown'}|${email}` ``, where `email` is `req.body.email` trimmed and lowercased, or `''` when it isn't a string.
2. `server/src/app.module.ts`:
   - Imports gain `ThrottlerModule.forRoot({ throttlers: [{ name: 'default', ttl: ONE_MINUTE_MS, limit: 300 }], errorMessage: TOO_MANY_ATTEMPTS_MESSAGE })`.
   - Providers gain `{ provide: APP_GUARD, useClass: AppThrottlerGuard }` (not the plain `ThrottlerGuard`).
3. File: `server/src/common/app-throttler.guard.ts` (new): `@Injectable() export class AppThrottlerGuard extends ThrottlerGuard`.
   - It overrides `protected async getTracker(req: Record<string, any>): Promise<string>`.
   - For `POST` requests whose path (`req.path`, or `req.originalUrl` without the query string) ends with `/auth/login`, return `loginThrottleTracker(req)` (IP + lowercased email).
   - Otherwise return `req.ip ?? 'unknown'`.
   - Why: `@Throttle()` only documents `limit` and `ttl`, so the per-route key can't be passed in the decorator.
4. `server/src/auth/auth.controller.ts`:
   - `login`, `register` and `verifyEmail`: `@Throttle({ default: { limit: 10, ttl: FIFTEEN_MINUTES_MS } })`.
   - `refresh`: no override. It uses the global 300 per minute per IP: every new tab, every `/login` visit and every 15-minute expiry calls refresh, and the whole office shares one IP. Refresh tokens are signed and unguessable, so a tight limit adds nothing.
5. Notes:
   - `req.ip` is the real client IP because of `trust proxy` (B4).
   - Storage is the default in-memory store, which suits one instance; counters reset on restart.
   - The static SPA is served by Express middleware and isn't throttled.

#### B6 Create Interceptor - `server/src/documents/upload-file.interceptor.ts` (P7)
1. `@Injectable() export class DocumentUploadInterceptor implements NestInterceptor`.
   - **Constructor** (`config: ConfigService`):
     - `this.maxMb = config.get<number>('MAX_UPLOAD_MB') ?? 50`.
     - `const Inner = FileInterceptor('file', { limits: { fileSize: this.maxMb * 1024 * 1024, files: 1 } }); this.inner = new Inner();`.
   - **`async intercept(context, next)`:**
     - `try { return await this.inner.intercept(context, next); }`.
     - `catch (error)`: if `error instanceof PayloadTooLargeException`, throw `new PayloadTooLargeException(\`File is larger than ${this.maxMb} MB.\`)`. Otherwise rethrow.
2. `server/src/documents/documents.controller.ts`: `@UseInterceptors(FileInterceptor('file'))` becomes `@UseInterceptors(DocumentUploadInterceptor)`.
3. Constraint: memory storage stays. Multer stops reading once the limit is hit, so an oversize file is never fully buffered.

#### B7 Create Util - `server/src/documents/file-signature.util.ts` (P7)
1. `detectFileType(buffer: Buffer): 'application/pdf' | 'image/jpeg' | 'image/png' | null`:
   - **PNG:** the first 8 bytes equal `89 50 4E 47 0D 0A 1A 0A`.
   - **JPEG:** the first 3 bytes equal `FF D8 FF`.
   - **PDF:** `%PDF-` appears within the first 1024 bytes. PDF readers accept a short preamble before the header, so valid files that upload today keep working.
   - Otherwise `null`.
2. `documents.controller.ts` `uploadDocument`, after the existing `allowedMimeTypes` check:
   - `if (detectFileType(file.buffer) !== file.mimetype) throw new BadRequestException("This file isn't a valid PDF, JPG or PNG.")`.
   - The existing type-list message ("Only PDF, JPEG, and PNG files are supported") is unchanged.
3. Test file: `server/src/documents/file-signature.util.spec.ts` (new). Cases:
   - Each valid signature is detected.
   - A PDF with a 10-byte preamble is detected.
   - A text file, an empty buffer and a PNG declared as JPEG don't match.

#### B8 Update Controllers - download headers
1. `server/src/documents/documents.controller.ts` `downloadDocument`: `res.attachment(filename); res.setHeader('Content-Type', mimeType); res.send(buffer);`.
2. `server/src/archive/archive.controller.ts` `downloadArchive`: `res.attachment(filename);` replaces the hand-built `Content-Disposition`. `Content-Type` and `Content-Length` stay set explicitly.
3. `server/src/exports/exports.controller.ts` `createExport`: `res.attachment(filename);` replaces the hand-built header. `Content-Type` stays.
4. Constraint: `res.attachment` sets `Content-Type` from the extension, so any explicit `Content-Type` is set **after** it.

#### B9 Create Client Util - `client/src/utils/contentDisposition.ts`
1. `getFilenameFromContentDisposition(header: string | null, fallback: string): string`:
   1. `filename*=` (`/filename\*\s*=\s*[^']*'[^']*'([^;]+)/i`): return `decodeURIComponent(match.trim())`. If decoding throws, fall through.
   2. Quoted `filename="…"` (`/filename\s*=\s*"((?:\\.|[^"\\])*)"/i`): return it with backslash escapes removed.
   3. Bare `filename=…` (`/filename\s*=\s*([^;]+)/i`): return it trimmed.
   4. Otherwise `fallback`.
2. Use it in place of the three `filename="?(.+?)"?$` regexes:
   - `client/src/api/exports.ts` (`getDocumentBlob` and `exportDocuments`);
   - `client/src/api/archive.ts` (`downloadProjectArchive`).
   - The fallbacks are unchanged.

#### Group B gate
- **Local `.env` first.** The local `server/.env` must have two different secrets of 32+ characters (generate with the command in `.env.example`). The current ones are too short, and the server refuses to start until they're replaced. This also signs out local sessions.
- From `server/`, `npm test` and `npm run build:full` pass.
- **Start-up checks:**
  - Starting with a 20-character secret prints one error listing the problem (AC7).
  - `curl -I http://localhost:3000/documents` shows `Content-Security-Policy`, `X-Content-Type-Options` and `Strict-Transport-Security`.
- **Uploads and downloads:**
  - Uploading a 60 MB file returns 413 "File is larger than 50 MB.".
  - A `.txt` renamed to `.pdf` returns 400 "This file isn't a valid PDF, JPG or PNG.".
  - A file named `Café d'été №1.pdf` downloads with that exact name (AC6). Windows doesn't allow `"` in file names. Double-quote escaping is covered by `res.attachment` and the quoted branch of B9.
- **Rate limit:** the 11th wrong sign-in for one email within 15 minutes returns 429 with `TOO_MANY_ATTEMPTS_MESSAGE`. Another email still works.

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
