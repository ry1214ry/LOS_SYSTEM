# LOS System — Secure Loan Application API

Production-oriented NestJS + PostgreSQL API implementing a strict
Role-Based Access Control (RBAC) model for a **Loan Application** workflow and
an administrative **User Management** framework.

- **Framework:** NestJS 12 (ESM, `nodenext`)
- **Database:** PostgreSQL via TypeORM 1.x
- **Auth:** JWT access tokens + HttpOnly, rotating refresh-token cookies
- **Hardening:** Helmet, strict CORS, global rate limiting, globally validated
  environment, global exception envelope, Terminus health checks

---

## 1. Roles & permissions matrix

This is the authoritative policy. It lives in code at
[`src/auth/config/role-permissions.config.ts`](src/auth/config/role-permissions.config.ts)
and is locked by `role-permissions.config.spec.ts`, so a change here is a
deliberate, test-visible change.

| Role | View | Create | Edit | Submit | Approve | Reject | Comment | Delete Draft | Doc Download | Doc Upload | Assignee Add | Assignee Remove |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| **Super Administrator** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Administrator** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Loan Officer** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ |
| **Credit Analyst** | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ |
| **Approver** | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Operations User** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

> **Reject is denied to every role** by the current policy, so the
> `POST /loans/:id/reject` route exists but is unreachable until the matrix
> grants `loan:reject`. This is intentional, not an oversight.

---

## 2. Folder structure

```
los-system/
├─ src/
│  ├─ main.ts                          # bootstrap: helmet, CORS, cookies, pipes, filter
│  ├─ app.module.ts                    # root module + global guard pipeline
│  ├─ bootstrap.service.ts             # optional SEED_ON_BOOT provisioning
│  ├─ common/
│  │  ├─ decorators/current-user.decorator.ts
│  │  ├─ filters/all-exceptions.filter.ts
│  │  └─ utils/duration.ts
│  ├─ config/
│  │  ├─ configuration.ts              # CORS + TypeORM/pool options
│  │  └─ env.validation.ts             # class-validator env schema (fail-fast boot)
│  ├─ health/
│  │  ├─ health.controller.ts          # GET /health, /health/live
│  │  └─ health.module.ts
│  ├─ rbac/
│  │  ├─ entities/{role,permission}.entity.ts
│  │  ├─ rbac.controller.ts            # GET /rbac/matrix (introspection)
│  │  ├─ rbac.module.ts
│  │  ├─ rbac.service.ts               # cached, DB-backed permission resolution
│  │  └─ rbac-seed.service.ts
│  ├─ auth/
│  │  ├─ auth.{module,controller,service}.ts
│  │  ├─ config/role-permissions.config.ts      # ← the RBAC matrix
│  │  ├─ config/permission-catalog.config.ts
│  │  ├─ config/role-permissions.config.spec.ts
│  │  ├─ refresh-cookie.config.ts
│  │  ├─ refresh-token.service.ts      # rotation + reuse detection
│  │  ├─ token-denylist.service.ts
│  │  ├─ entities/refresh-token.entity.ts
│  │  ├─ decorators/{public,roles,permissions}.decorator.ts
│  │  ├─ dto/auth.dto.ts
│  │  ├─ enums/{role,permission}.enum.ts
│  │  ├─ guards/{jwt-auth,roles,permissions}.guard.ts
│  │  └─ strategies/jwt.strategy.ts
│  ├─ users/
│  │  ├─ entities/user.entity.ts
│  │  ├─ dto/provision-user.dto.ts
│  │  └─ users.{module,controller,service}.ts
│  └─ loans/
│     ├─ entities/{loan-application,loan-comment,loan-document,loan-assignee}.entity.ts
│     ├─ enums/loan-status.enum.ts
│     ├─ dto/loan.dto.ts
│     └─ loans.{module,service}.ts + loan.controller.ts
├─ scripts/seed.mjs                    # RBAC matrix + bootstrap admin
├─ test/                               # e2e specs
├─ Dockerfile                          # multi-stage, non-root, prod deps only
├─ docker-compose.yml                  # api + tuned postgres
└─ .env.example
```

---

## 3. Getting started

```bash
cp .env.example .env          # then edit DB_* and JWT_SECRET
npm install
npm run start:dev             # creates the schema (DB_SYNCHRONIZE=true in dev)
npm run seed                  # loads the RBAC matrix + Super Administrator
```

### With Docker

```bash
cp .env.example .env          # set DB_PASSWORD and JWT_SECRET at minimum
docker compose up --build     # API on :3000, seeded on first boot
```

The `api` service sets `DB_SYNCHRONIZE=true` and `SEED_ON_BOOT=true` so the
matrix and Super Administrator are provisioned automatically. **In real
production replace `synchronize` with migrations and keep `SEED_ON_BOOT`
off.**

### Environment variables

All variables are validated at boot; an invalid or missing value aborts the
process. See [`src/config/env.validation.ts`](src/config/env.validation.ts) and
[`.env.example`](.env.example). Highlights:

| Variable | Notes |
|---|---|
| `JWT_SECRET` | required, ≥ 32 chars |
| `DATABASE_URL` | optional; overrides the `DB_*` block |
| `DB_POOL_MAX` / `DB_POOL_MIN` / `DB_IDLE_TIMEOUT_MS` / `DB_CONNECTION_TIMEOUT_MS` | pg connection pool |
| `DB_SYNCHRONIZE` | keep `false` in production |
| `CORS_ORIGINS` | comma-separated allow-list; required in production |
| `BCRYPT_ROUNDS` | default 12 |
| `SEED_ON_BOOT` | run the seed during startup |

---

## 4. API surface

| Method & path | Guard |
|---|---|
| `POST /auth/login` | public, 5 req/min |
| `POST /auth/refresh` | public, requires the refresh cookie |
| `POST /auth/logout` | authenticated |
| `GET /auth/me` | authenticated |
| `POST /users/provision` | Super Administrator or Administrator |
| `GET /users`, `GET /users/:id` | Super Administrator or Administrator |
| `GET /rbac/matrix` | Super Administrator or Administrator |
| `POST /loans` | `loan:create` |
| `GET /loans`, `GET /loans/:id` | `loan:view` |
| `PATCH /loans/:id` | `loan:edit` (draft only) |
| `DELETE /loans/:id` | `loan:delete-draft` (draft only) |
| `POST /loans/:id/submit` | `loan:submit` |
| `POST /loans/:id/approve` | `loan:approve` |
| `POST /loans/:id/reject` | `loan:reject` (granted to nobody) |
| `POST /loans/:id/comments` · `GET …/comments` | `loan:comment` / `loan:view` |
| `POST /loans/:id/documents` | `doc:upload` |
| `GET /loans/:id/documents/:documentId/download` | `doc:download` |
| `POST /loans/:id/assignees` · `DELETE …/assignees/:id` | `assignee:add` / `assignee:remove` |
| `GET /health`, `GET /health/live` | public |

### Provisioning a user

```http
POST /users/provision
Authorization: Bearer <access token>
Content-Type: application/json

{ "email": "analyst@example.com", "role": "Credit Analyst" }
```

Returns `201` with the created user and, when no `temporaryPassword` was
supplied, a generated `temporaryPassword` that is shown **exactly once**. The
password is stored only as a bcrypt hash and the account is flagged
`mustChangePassword: true`. Only a Super Administrator may provision another
Super Administrator.

---

## 5. Security model

- **Deny by default.** Global guards run in order: throttle → authenticate →
  roles → permissions. A route needs a valid token unless marked `@Public()`,
  and an explicit permission for every sensitive action.
- **Refresh-token rotation.** Refresh tokens are 48 random bytes; only their
  SHA-256 is stored. Each rotation revokes the previous token, and replaying a
  rotated token revokes the whole family (theft detection). The cookie is
  `HttpOnly`, `SameSite=Strict` and `Secure` in production.
- **Role changes are immediate.** `JwtStrategy` reloads the user on every
  request, so deactivating a user or changing their role takes effect
  instantly rather than at token expiry.
- **Least privilege on writes.** The `User.passwordHash` column is
  `select: false`, and the service layer re-checks provisioning authority so
  the rule survives any future endpoint that reuses it.
- **Fail-fast configuration.** Boot aborts on an invalid environment.

---

## 6. Tests

```bash
npm test          # unit — includes the RBAC matrix contract test (no DB)
npm run test:e2e  # e2e — requires a running, seeded database
npm run lint
```

---

## 7. Operational notes

- **Connection pooling** is configured on the `pg` driver
  (`DB_POOL_*`). Behind PgBouncer keep `DB_POOL_MAX` small — the pooler owns the
  server-side pool.
- **Health checks:** use `/health/live` for liveness (no dependencies) and
  `/health` for readiness (pings Postgres, checks memory) so an orchestrator
  never restarts a healthy container because of a transient database blip.
- **Token denylist** (`TokenDenylistService`) is in-memory. For multi-instance
  deployments back it with Redis or a `revoked_tokens` table.
- **Document bytes** live in object storage; the API stores metadata and would
  mint short-lived pre-signed URLs for download.
