# DevSecOps demonstration API

NestJS task API backed by PostgreSQL, with registration, password authentication,
15-minute JWTs, owner-scoped task CRUD, schema migrations, and OpenAPI documentation.
This is the first application milestone for the AI-assisted DevSecOps platform.

## Run with Docker Compose

Prerequisites: Node.js 22, npm, Docker Engine, and Docker Compose with `--wait` support.

From this repository:

```bash
npm ci
npm run env:init
docker compose up --build --wait --wait-timeout 120
npm run smoke
```

`env:init` creates an ignored, mode-0600 `.env` containing distinct random database
passwords and a random signing secret. Running it again preserves existing settings.
The migration container applies pending migrations before the API starts. PostgreSQL
storage persists in the `postgres-data` volume.

- API: <http://localhost:3000/v1/tasks>
- Liveness: <http://localhost:3000/health/live>
- Readiness: <http://localhost:3000/health/ready>
- Swagger UI: <http://localhost:3000/docs>
- OpenAPI JSON for later ZAP discovery: <http://localhost:3000/docs-json>

Change `PORT` in `.env` if port 3000 is occupied. The API is published only on the
host's loopback address. PostgreSQL has no published port in the default setup.
Set `DOCS_ENABLED=false` to disable the UI and specification outside the local lab.

Stop the local services while retaining database data:

```bash
docker compose down
```

`docker compose down --volumes` deletes this lab's persisted database. Regenerating
passwords in `.env` does not rotate credentials inside an existing PostgreSQL volume;
rotate database roles explicitly when retaining data.

## Run the API on the host

Use this mode when editing TypeScript. Stop a running Compose API first to free
the API port. The override publishes PostgreSQL only on `127.0.0.1:15432`.

```bash
npm ci
npm run env:init
docker compose -f compose.yaml -f compose.dev.yaml up --detach --wait db
npm run build
npm run migrate
npm run start:dev
```

`start:dev` executes TypeScript through ts-node; restart it after changes. The
generated `.env` supplies the host database URLs. `npm run migrate` uses the
administrative `MIGRATION_DATABASE_URL`; the API uses the restricted `DATABASE_URL`.

## API routes

| Method and path | Authentication | Behavior |
| --- | --- | --- |
| `POST /v1/auth/register` | Public | Create an account; 201, duplicate email 409 |
| `POST /v1/auth/login` | Public | Return `access_token`, `token_type`, `expires_in`, and public user fields |
| `GET /v1/tasks?limit=20&offset=0` | Bearer | List only the caller's tasks; maximum limit 100 |
| `POST /v1/tasks` | Bearer | Create a task with title and optional description |
| `GET /v1/tasks/{id}` | Bearer | Retrieve an owned task |
| `PATCH /v1/tasks/{id}` | Bearer | Update title, description, or completed |
| `DELETE /v1/tasks/{id}` | Bearer | Delete an owned task; 204 |
| `GET /health/live` | Public | Process is alive; 200 |
| `GET /health/ready` | Public | Database/schema ready; 200 or 503 |

Register and log in through Swagger, then paste `access_token` into **Authorize**
to exercise the protected endpoints. Passwords must contain 12–128 characters.
Emails are trimmed, normalized, and lowercased. Unknown body/query fields are
rejected. Task IDs must be UUIDv4 values. Missing and other users' tasks return 404.

## Verification

```bash
npm run typecheck
npm run build
npm test
npm run test:integration
```

Unit tests cover configuration and password hashing. The integration runner creates
an isolated Compose project, random database credentials, a loopback port selected
by Docker, and a PostgreSQL database in temporary memory-backed storage. It then
runs the HTTP scenarios and removes the test containers/network. It does not use
the development database or `.env` credentials.

Integration scenarios exercise authentication, invalid/expired/scoped tokens,
task CRUD, ownership isolation, SQL-like input, strict validation, upload limits,
OpenAPI, rate limiting, migration checksums, database outages, and restricted
runtime database permissions. `npm run smoke` exercises the running API and leaves
one synthetic account per invocation; its task is removed after successful checks.

## Implementation boundaries

The image uses pinned Node/PostgreSQL digests and npm's dependency lockfile. The
runtime image excludes development dependencies and source files, runs as the
`node` user, and has a read-only filesystem with dropped Linux capabilities in
Compose. The database role used by the API cannot alter schema or migration history.

Password hashes use Node's scrypt with `N=32768`, `r=8`, `p=3`, random salts, and
constant-time comparison. JWT verification checks signature algorithm, issuer,
audience, expiry, subject format, and continued user existence. See
[OWASP password-storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
and the [NestJS JWT module](https://github.com/nestjs/jwt).

Authentication endpoints allow 10 requests per minute per route/IP; other API
routes allow 120. The limiter is in process memory and forwarding headers are not
trusted. Configure a trusted ingress and shared limiter storage before adding
replicas. Local HTTP will need TLS at the cloud ingress. Email verification,
password reset, refresh tokens, and explicit token revocation are future features.

Cloud staging now runs this API with PostgreSQL on K3s. The deployment renderer is
in `deploy/`; the [staging runbook](../infrastructure/docs/K3S_RUNBOOK.md) describes
SSH access, isolated credentials, migration ordering, and persistence verification.
Jenkins, scanners, registry delivery, release policy enforcement, and AI integration
remain subsequent milestones. Package audit results alone do not establish release
eligibility.
